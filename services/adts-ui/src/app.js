import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Hapi from '@hapi/hapi'
import Vision from '@hapi/vision'
import Inert from '@hapi/inert'
import Yar from '@hapi/yar'
import nunjucks from 'nunjucks'
import staticAssets from './routes/assets.js'
import health from './routes/health.js'
import home from './routes/home.js'
import results from './routes/results.js'
import createClient from './routes/createClient.js'
import selectClient from './routes/selectClient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SUBMISSION_FORM_STATE_KEY = 'submissionFormState'

const createServer = async () => {
  const sessionSecret = process.env.SESSION_SECRET

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

  staticAssets(server)
  home(server)
  createClient(server, SUBMISSION_FORM_STATE_KEY)
  selectClient(server, SUBMISSION_FORM_STATE_KEY)
  results(server)
  health(server)

  return server
}

export default createServer
