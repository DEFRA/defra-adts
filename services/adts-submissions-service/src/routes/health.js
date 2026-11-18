import { constants } from 'node:http2'

export const registerHealthRoutes = (server, limsClient) => {
  server.route([
    {
      method: 'GET',
      path: '/health',
      handler: () => ({ status: 'UP' })
    },
    {
      method: 'GET',
      path: '/ready',
      handler: () => ({ status: 'READY' })
    },
    {
      method: 'GET',
      path: '/health/lims',
      handler: async (_request, h) => {
        try {
          const response = await limsClient.request('general/getpingOK')
          if (!response.ok) {
            return h.response({ status: 'DOWN', dependency: 'lims' }).code(constants.HTTP_STATUS_SERVICE_UNAVAILABLE)
          }

          return { status: 'UP' }
        } catch {
          return h.response({ status: 'DOWN', dependency: 'lims' }).code(constants.HTTP_STATUS_SERVICE_UNAVAILABLE)
        }
      }
    }
  ])
}
