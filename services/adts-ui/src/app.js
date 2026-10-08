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
    .valid('show_all', 'draft', 'submitted', 'in_progress', 'cancelled', 'samples_overdue', 'tests_complete')
    .default('show_all'),
  'submitted-date': Joi.string()
    .valid('1_day', '1_week', '14_days', '1_month', '6_months', '1_year', '18_months')
    .allow('')
    .default('18_months')
})

const createServer = async (options = {}) => {
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET

  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be configured and at least 32 characters long')
  }

  const server = Hapi.server({
    port: process.env.PORT
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

  server.route({
    method: 'GET',
    path: '/',
    // FIX: Removed the validate object here to prevent Joi defaults from clearing the cache
    handler: (request, h) => {
      // 1. Pull the cached search history parameters straight from the session store
      const cached = request.yar.get(HOME_FILTER_STATE_KEY)
      let filterValues

      if (cached) {
        filterValues = cached
      } else {
        filterValues = Joi.attempt({}, homeFilterSchema)
      }

      return h.view('home.njk', {
        user: request.auth.credentials,
        filteredValues: {
          client: filterValues.client,
          clinician: filterValues.clinician,
          status: filterValues.status,
          submitted_date: filterValues['submitted-date'] || ''
        }
      })
    }
  })

  server.route({
    method: 'GET',
    path: '/results',
    options: {
      validate: {
        query: homeFilterSchema,
        failAction: (request, h, err) => {
          request.log(['results-filter', 'validation-warning'], err.message)
          return err.localised || h.continue
        }
      }
    },
    handler: async (request, h) => {
      request.yar.set(HOME_FILTER_STATE_KEY, request.query)
      request.yar.touch()

      const queryParams = new URLSearchParams(request.query).toString()
      const adapterBaseUrl = process.env.SUBMISSIONS_SERVICE_URL
      const adapterUrl = `${adapterBaseUrl}/submissions?${queryParams}`

      const viewContext = {
        filteredValues: {
          client: request.query.client,
          clinician: request.query.clinician,
          status: request.query.status,
          submitted_date: request.query['submitted-date'] || ''
        }
      }

      try {
        const response = await fetch(adapterUrl)

        if (!response.ok) {
          throw new Error(`Backend responded with status: ${response.status}`)
        }

        const payload = await response.json()

        return h.view('results.njk', {
          ...viewContext,
          results: payload.results,
          totalCount: payload.totalCount
        })
      } catch (error) {
        console.error('Error contacting backend server:', error.message)

        return h.view('results.njk', {
          ...viewContext,
          results: [],
          totalCount: 0,
          error: 'Unable to load submissions at this time.'
        })
      }
    }
  })

  return server
}

export default createServer
