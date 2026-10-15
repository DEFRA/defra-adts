import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import { constants } from 'http2'

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
