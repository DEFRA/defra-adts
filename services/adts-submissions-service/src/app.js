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

  server.route({
    method: 'GET',
    path: '/ui_health',
    handler: async (_request, h) => {
      const adapterBaseUrl = process.env.UI_SERVICE_URL
      const adapterUrl = `${adapterBaseUrl}/health`

      try {
        const response = await fetch(adapterUrl)

        if (!response.ok) {
          throw new Error(`UI responded with status: ${response.status}`)
        }

        const payload = await response.json()
        return h.response({ ui: payload })
      } catch (error) {
        console.log('Error contacting UI server:', error.message)

        return h.response({ message: 'Unable to reach UI at this time.' })
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/backend_health',
    handler: async (_request, h) => {
      const adapterBaseUrl = process.env.BACKEND_SERVICE_URL
      const adapterUrl = `${adapterBaseUrl}/health`

      try {
        const response = await fetch(adapterUrl)

        if (!response.ok) {
          throw new Error(`Backend responded with status: ${response.status}`)
        }

        const payload = await response.json()
        return h.response({ backend: payload })
      } catch (error) {
        console.log('Error contacting backend server:', error.message)

        return h.response({ message: 'Unable to reach backend at this time.' })
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
