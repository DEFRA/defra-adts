import { clientDetailsSchema, renderClientForm } from './clientForm.js'

const pagePath = '/create-client'

// Standalone page: independent of the submission journey and its session state.
const createClient = (server) => {
  server.route([
    {
      method: 'GET',
      path: pagePath,
      handler: (request, h) => renderClientForm(h, {}, { isEdit: false, formAction: pagePath })
    },
    {
      method: 'POST',
      path: pagePath,
      options: {
        validate: {
          payload: clientDetailsSchema
        }
      },
      handler: (request, h) => {
        // TODO: persist the new client once the backend exposes a create client endpoint.
        return h.redirect('/')
      }
    }
  ])
}

export default createClient
