import path from 'path'
import { fileURLToPath } from 'url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const createServer = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3100,
    host: '0.0.0.0'
  })

  await server.register([Inert])

  // Our compiled JS, built into src/public by `npm run build`
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
    path: '/submissions',
    handler: async (request, h) => {
      // Fallback to a default if the variable isn't set yet
      const limsBaseUrl = process.env.LIMS_BASE_URL || 'https://thirdparty-lims.gov.uk'
      const queryParams = new URLSearchParams(request.query).toString()

      try {
        // Forward the query straight down the pipe to the real third-party service
        const response = await fetch(`${limsBaseUrl}/submissions?${queryParams}`)

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
