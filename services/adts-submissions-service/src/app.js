import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import { loadConfig } from './config.js'
import { createLimsClient } from './clients/lims-client.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerReferenceDataRoutes } from './routes/reference-data.js'
import { registerSubmissionReadRoutes } from './routes/submissions-read.js'
import { registerResultsRoutes } from './routes/results.js'
import { registerReportRoutes } from './routes/reports.js'
import { registerDraftRoutes } from './routes/drafts.js'
import { registerSubmissionActionRoutes } from './routes/submission-actions.js'
import { logDiagnosticEvent } from './observability.js'
import { createServiceError, normalizeLimsBusinessError, normalizeUpstreamStatus } from './errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const createServer = async ({ config = loadConfig(), limsClient = createLimsClient(config.lims) } = {}) => {
  const server = Hapi.server({
    port: process.env.PORT
  })

  server.ext('onPreResponse', (request, h) => {
    const response = request.response
    const statusCode = response.isBoom ? response.output.statusCode : response.statusCode

    if (statusCode >= 400) {
      logDiagnosticEvent(console, {
        level: statusCode >= 500 ? 'error' : 'warn',
        event: 'request.failed',
        correlationId: request.info.id,
        statusCode
      })
    }

    return h.continue
  })

  await server.register([Inert])
  server.route({
    method: 'GET',
    path: '/assets/js/{param*}',
    handler: {
      directory: {
        path: path.join(__dirname, 'public/js')
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/',
    handler: async () => {
      return { message: 'You have hit the landing page' }
    }
  })

  registerHealthRoutes(server, limsClient)
  registerReferenceDataRoutes(server, limsClient)
  registerSubmissionReadRoutes(server, limsClient)
  registerResultsRoutes(server, limsClient)
  registerReportRoutes(server, limsClient)
  registerDraftRoutes(server, limsClient)
  registerSubmissionActionRoutes(server, limsClient)

  server.route({
    method: 'GET',
    path: '/GetClients',
    handler: async (_request, h) => {
      const { LIMS_API_URL, LIMS_PVS_ID } = process.env
      if (!LIMS_API_URL || !LIMS_PVS_ID) {
        console.error('LIMS_API_URL and LIMS_PVS_ID must be configured to retrieve clients')
        return h.response({ error: 'LIMS client lookup is not configured' })
          .code(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      }

      try {
        const query = new URLSearchParams({ pvsId: LIMS_PVS_ID, filter: '' })
        const response = await fetch(`${LIMS_API_URL}/general/getClients?${query}`)
        if (!response.ok) {
          return h.response({ error: 'LIMS integration error' }).code(response.status)
        }

        return await response.json()
      } catch (error) {
        console.error('Error retrieving clients from LIMS:', error.message)
        return h.response({ error: 'LIMS connectivity failure' })
          .code(constants.HTTP_STATUS_BAD_GATEWAY)
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/submissions',
    handler: async (request, h) => {
      let response
      try {
        response = await limsClient.request('submissions', {
          method: 'GET',
          query: request.query
        })
      } catch (error) {
        const category = error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? 'upstream_timeout'
          : 'upstream_transport_error'
        const result = createServiceError({
          category,
          message: category === 'upstream_timeout' ? 'The LIMS request timed out.' : 'The LIMS request could not be completed.',
          correlationId: request.info.id
        })
        return h.response(result.body).code(result.statusCode)
      }

      let payload
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const businessError = normalizeLimsBusinessError(payload, request.info.id)
      if (businessError) {
        return h.response(businessError.body).code(businessError.statusCode)
      }

      if (!response.ok || payload === null) {
        const result = normalizeUpstreamStatus(
          response.status,
          request.info.id,
          'LIMS could not complete the submission search.'
        )
        return h.response(result.body).code(result.statusCode)
      }

      return h.response(payload).code(200)
    }
  })
  return server
}

export default createServer
