import path from 'path'
import { fileURLToPath } from 'url'
import Hapi from '@hapi/hapi'
import Vision from '@hapi/vision'
import Inert from '@hapi/inert'
import Yar from '@hapi/yar'
import Joi from 'joi'
import nunjucks from 'nunjucks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME_FILTER_STATE_KEY = 'homeFilterState'
const homeFilterSchema = Joi.object({
  client: Joi.string().max(200).allow('').default(''),
  clinician: Joi.string().max(200).allow('').default(''),
  status: Joi.string()
    .valid('show all', 'draft', 'submitted', 'in_progress', 'completed', 'samples_overdue', 'tests_complete', 'available')
    .default('show all'),
  submitted_date: Joi.string().valid('18_months').default('18_months')
})

const createServer = async (options = {}) => {
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET

  if (!sessionSecret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be configured in production')
  }

  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  })

  await server.register([
    Vision,
    Inert,
    {
      plugin: Yar,
      options: {
        cookieOptions: {
          password: sessionSecret,
          isHttpOnly: true,
          isSameSite: 'Lax',
          isSecure: process.env.NODE_ENV === 'production',
          path: '/'
        }
      }
    }
  ])

  server.views({
    engines: {
      njk: {
        compile: (src, options) => (context) => options.environment.renderString(src, context),
        prepare: (options, next) => {
          options.compileOptions.environment = nunjucks.configure(
            [path.join(__dirname, 'views'), path.join(__dirname, '../node_modules/govuk-frontend/dist')],
            { autoescape: true }
          )
          return next()
        }
      }
    },
    relativeTo: __dirname,
    path: 'views'
  })

  // Static Assets and Compiled UI files
  server.route([
    {
      method: 'GET',
      path: '/assets/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../node_modules/govuk-frontend/dist/govuk/assets')
        }
      }
    },
    {
      method: 'GET',
      path: '/assets/css/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, 'public/css')
        }
      }
    },
    {
      method: 'GET',
      path: '/assets/js/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, 'public/js')
        }
      }
    }
  ])

  // Main Home Page Route
  server.route({
    method: 'GET',
    path: '/',
    options: {
      validate: {
        query: homeFilterSchema,
        // Suppresses 400 Bad Request errors for malformed strings and recovers gracefully using safe defaults
        failAction: (request, h, err) => {
          request.log(['home-filter', 'validation-warning'], err.message)
          return err.localised || h.continue
        }
      }
    },
    handler: (request, h) => {
      // Check if the user initiated an explicit submission via form search
      const isFormSubmission = request.orig.query && Object.keys(request.orig.query).length > 0

      let query

      if (isFormSubmission) {
        // Form submitted: save the clean Joi-sanitized query directly to the session
        query = request.query
        request.yar.set(HOME_FILTER_STATE_KEY, query)
      } else {
        // Page hit cleanly: pull last selections from session cache
        const cached = request.yar.get(HOME_FILTER_STATE_KEY)

        if (cached) {
          query = cached
        } else {
          // Absolute first load: build out safe, default empty parameters using the Joi schema
          query = Joi.attempt({}, homeFilterSchema)
        }
      }

      return h.view('home.njk', {
        user: request.auth.credentials,
        query
      })
    }
  })

  return server
}

export default createServer
