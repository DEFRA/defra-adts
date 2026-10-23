import { constants } from 'node:http2'
import { getClients } from '../backend/clients.js'

const updateClients = (server) => {
  server.route({
    method: 'GET',
    path: '/update-client',
    handler: async (_request, h) => {
      let clients

      try {
        clients = await getClients()
      } catch (error) {
        console.error('Error contacting backend server:', error.message)
        return h.response('Unable to load clients').code(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      }

      return h.view('update-clients.njk', {
        clients: clients.map((client) => ({
          ...client,
          displayName: client.name || `Client ${client.clientId}`,
          editUrl: `/edit-client/${encodeURIComponent(client.clientId)}`
        }))
      })
    }
  })
}

export default updateClients
