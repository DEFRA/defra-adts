import path from 'path'
import { fileURLToPath } from 'url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'

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
    handler: async (request, h) => {
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

  // E.g. localhost:9181/connection_health?protocol=http&host=<host DN>&port=9180
  server.route({
    method: 'GET',
    path: '/connection_health',
    options: {
      validate: {
        query: Joi.object({
          protocol: Joi.string()
            .trim()
            .required(),
          host: Joi.string()
            .trim()
            .required(),
          port: Joi.string()
            .trim()
            .required()
        }).required()
      }
    },
    handler: async (request, h) => {
      const { protocol, host, port } = request.query
      const pr = encodeURIComponent(protocol)
      const hs = encodeURIComponent(host)
      const pt = encodeURIComponent(port)
      const connectionUrl = `${pr}://${hs}:${pt}/health`

      try {
        const response = await fetch(connectionUrl)

        if (!response.ok) {
          throw new Error(`${host} responded with status: ${response.status}`)
        }

        const payload = await response.json()
        return h.response(payload)
      } catch (error) {
        console.error('Error contacting %s  server: %s', host, error.message)

        return h.response({ message: `Unable to reach ${host}  at this time.` })
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/lims',
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
        return h.response({ error: 'LIMS connectivity failure' }).code(502)
      }
    }
  })

  return server
}

export default createServer
