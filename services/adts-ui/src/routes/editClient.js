import Joi from 'joi'
import { getClients } from '../backend/clients.js'
import { clientDetailsSchema, renderClientForm } from './clientForm.js'

const pagePath = '/edit-client/{clientId}'

const clientParamsSchema = Joi.object({
  clientId: Joi.string().required()
})

const findClient = async (clientId) => {
  try {
    const clients = await getClients()
    return clients.find((client) => client.clientId === clientId)
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
    return undefined
  }
}

// Standalone page: independent of the submission journey and its session state.
const editClient = (server) => {
  server.route([
    {
      method: 'GET',
      path: pagePath,
      options: {
        validate: {
          params: clientParamsSchema
        }
      },
      handler: async (request, h) => {
        const { clientId } = request.params
        const client = await findClient(clientId)

        if (!client) {
          return h.response('Client not found').code(404)
        }

        return renderClientForm(h, client, {
          isEdit: true,
          formAction: `/edit-client/${encodeURIComponent(clientId)}`
        })
      }
    },
    {
      method: 'POST',
      path: pagePath,
      options: {
        validate: {
          params: clientParamsSchema,
          payload: clientDetailsSchema
        }
      },
      handler: async (request, h) => {
        const client = await findClient(request.params.clientId)

        if (!client) {
          return h.response('Client not found').code(404)
        }

        // TODO: persist the changes once the backend exposes an update client endpoint.
        return h.redirect('/')
      }
    }
  ])
}

export default editClient
