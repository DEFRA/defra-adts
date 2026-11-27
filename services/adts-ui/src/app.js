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
import selectClient from './routes/selectClient.js'
import selectClientAddressRoutes from './routes/selectClientAddressRoutes.js'
import submissionSpecies from './routes/submissionSpecies.js'
import submissionAnimalDetails from './routes/submissionAnimalDetails.js'
import submissionClinicalHistory from './routes/submissionClinicalHistory.js'
import drafts from './routes/drafts.js'
import { registerAuthentication } from './auth.js'
import {
  clearPvsIdSessionAfterSignOut,
  createPvsIdSessionHook
} from './auth/pvsIdSession.js'

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
        name: 'adts-ui-session',
        maxCookieSize: 4096,
        cookieOptions: {
          password: sessionSecret,
          isSecure: process.env.NODE_ENV !== 'development',
          isHttpOnly: true,
          isSameSite:
            process.env.AUTH_MODE === 'live' && process.env.NODE_ENV !== 'development'
              ? 'None'
              : 'Lax',
          path: '/'
        }
      }
    }
  ])

  const authentication = await registerAuthentication(server)
  server.ext('onPostAuth', createPvsIdSessionHook(authentication.getAuthSession))
  server.ext('onPreResponse', clearPvsIdSessionAfterSignOut(authentication.getAuthSession))

  server.views({
    engines: {
      njk: {
        compile: (src, options) => (context) => options.environment.renderString(src, context),
        prepare: (options, next) => {
          options.compileOptions.environment = nunjucks.configure(
            [
              path.join(__dirname, 'views'),
              path.join(__dirname, '../node_modules/govuk-frontend/dist'),
              authentication.viewsPath
            ],
            { autoescape: true }
          )
          return next()
        }
      }
    },
    relativeTo: __dirname,
    path: ['views', authentication.viewsPath]
  })

  staticAssets(server)
  home(server, authentication.buildAccount)
  selectClient(server, SUBMISSION_FORM_STATE_KEY)
  selectClientAddressRoutes(server, SUBMISSION_FORM_STATE_KEY)
  submissionSpecies(server, SUBMISSION_FORM_STATE_KEY)
  submissionAnimalDetails(server, SUBMISSION_FORM_STATE_KEY)
  submissionClinicalHistory(server, SUBMISSION_FORM_STATE_KEY)
  drafts(server, SUBMISSION_FORM_STATE_KEY)
  results(server)
  health(server)

  server.app.buildAccount = authentication.buildAccount
  server.app.getAuthSession = authentication.getAuthSession
  server.app.authMode = authentication.mode

  return server
}

export default createServer
