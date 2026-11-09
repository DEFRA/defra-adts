import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Joi from 'joi'
import { constants } from 'node:http2'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const createServer = async () => {
  const server = Hapi.server({
    port: process.env.PORT
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

  server.route({
    method: 'GET',
    path: '/health',
    handler: (_request, h) => {
      return h.response({ status: 'UP' })
    }
  })

  server.route({
    method: 'GET',
    path: '/connection_health',
    options: {
      validate: {
        query: Joi.object({
          protocol: Joi.string().trim().required(),
          host: Joi.string().trim().required(),
          port: Joi.string().trim().required()
        }).required()
      }
    },
    handler: async (request, h) => {
      const { protocol, host, port } = request.query
      const connectionUrl = `${encodeURIComponent(protocol)}://${encodeURIComponent(host)}:${encodeURIComponent(port)}/health`

      try {
        const response = await fetch(connectionUrl)

        if (!response.ok) {
          throw new Error(`${host} responded with status: ${response.status}`)
        }

        return h.response(await response.json())
      } catch (error) {
        console.error('Error contacting %s server: %s', host, error.message)
        return h.response({ message: `Unable to reach ${host} at this time.` })
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/GetClients',
    handler: async (_request, h) => {
      const { LIMS_BASE_URL, LIMS_PVS_ID } = process.env
      if (!LIMS_BASE_URL || !LIMS_PVS_ID) {
        console.error('LIMS_BASE_URL and LIMS_PVS_ID must be configured to retrieve clients')
        return h.response({ error: 'LIMS client lookup is not configured' })
          .code(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      }

      try {
        const query = new URLSearchParams({ pvsId: LIMS_PVS_ID, filter: '' })
        const response = await fetch(`${LIMS_BASE_URL}/general/getClients?${query}`)
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
      const queryParams = new URLSearchParams(request.query).toString()
      try {
        const response = await fetch(`${process.env.LIMS_BASE_URL}/submissions?${queryParams}`)
        if (!response.ok) {
          return h.response({ error: 'LIMS integration error' }).code(response.status)
        }
        const data = await response.json()
        return data
      } catch (error) {
        return h.response({ error: 'LIMS connectivity failure' }).code(constants.HTTP_STATUS_BAD_GATEWAY)
      }
    }
  })
  return server
}

export default createServer
