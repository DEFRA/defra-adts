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
      return { message: 'You have hit the backend page' }
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
    path: '/submissions_health',
    handler: async (_request, h) => {
      const adapterBaseUrl = process.env.SUBMISSIONS_SERVICE_URL
      const adapterUrl = `${adapterBaseUrl}/health`

      try {
        const response = await fetch(adapterUrl)

        if (!response.ok) {
          throw new Error(`Submissions responded with status: ${response.status}`)
        }

        const payload = await response.json()
        return h.response({ submissions: payload })
      } catch (error) {
        console.error('Error contacting submissions server:', error.message)

        return h.response({ message: 'Unable to reach submissions at this time.' })
      }
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
        console.error('Error contacting ui server:', error.message)

        return h.response({ message: 'Unable to reach ui at this time.' })
      }
    }
  })

  return server
}

export default createServer
