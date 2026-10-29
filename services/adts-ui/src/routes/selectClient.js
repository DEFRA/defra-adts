import Joi from 'joi'
import { getClients } from '../backend/clients.js'

const pageName = 'submission-01-client-details'
const nextPageName = 'submission-02-species'

const submissionClientSchema = Joi.object({
  clientId: Joi.string().allow('').required()
})

const getClientOptions = (clients, selectedClientId) => [
  { value: '', text: 'Select a client', selected: !selectedClientId },
  ...clients.map((client) => ({
    value: client.clientId,
    text: client.name,
    selected: client.clientId === selectedClientId
  }))
]

const getSelectedClientView = (client) => {
  if (!client) {
    return undefined
  }

  return {
    ...client,
    address: [client.addressLine1, client.addressLine2, client.addressLine3]
      .filter(Boolean)
      .join(', ')
  }
}

// Only the clientId is persisted; display details always come from the backend client record.
const getClientDetailsViewContext = (submissionFormState, clients) => {
  const selectedClientId = submissionFormState.formData?.clientDetails?.clientId || ''
  const selectedClient = clients.find((client) => client.clientId === selectedClientId)

  return {
    clientOptions: getClientOptions(clients, selectedClientId),
    selectedClientName: selectedClient?.name || '',
    selectedClient: getSelectedClientView(selectedClient),
    submissionFormState
  }
}

const loadClients = async () => {
  try {
    return await getClients()
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
    return []
  }
}

const selectClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const clients = await loadClients()

        return h.view('select-client.njk', {
          ...getClientDetailsViewContext(submissionFormState, clients)
        })
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      options: {
        validate: {
          payload: submissionClientSchema
        }
      },
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const formData = submissionFormState.formData || {}
        const clients = await loadClients()
        const selectedClient = clients.find((client) => client.clientId === request.payload.clientId)

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: {
            ...formData,
            clientDetails: selectedClient ? { clientId: selectedClient.clientId } : undefined
          }
        })
        request.yar.touch()

        return h.redirect(selectedClient ? `/${nextPageName}` : `/${pageName}`)
      }
    }
  ])
}

export default selectClient
