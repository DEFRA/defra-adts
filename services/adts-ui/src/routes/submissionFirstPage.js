import Joi from 'joi'

const pageName = 'submission-01-client-details'
const newClientOptionId = 'new-client'

const submissionClientSchema = Joi.object({
  clientId: Joi.string().allow('').required()
})

const getClients = async () => {
  const adapterBaseUrl = process.env.SUBMISSIONS_SERVICE_URL
  const response = await fetch(`${adapterBaseUrl}/GetClients`)
  const clients = await response.json()

  return clients.map((client) => ({
    clientId: String(client.clientId),
    name: client.name
  }))
}

const getClientOptions = (clients, selectedClientId, newClient) => [
  { value: '', text: 'Select a client', selected: !selectedClientId },
  ...(newClient
    ? [{
        value: newClientOptionId,
        text: newClient.name || newClient.cph || 'New client',
        selected: true
      }]
    : []),
  ...clients.map((client) => ({
    value: client.clientId,
    text: client.name,
    selected: client.clientId === selectedClientId
  }))
]

const getClientDetailsViewContext = (formDetails, clients) => {
  const isNewClient = Boolean(formDetails.client && !formDetails.client.clientId)

  return {
    clientOptions: getClientOptions(
      clients,
      isNewClient ? newClientOptionId : formDetails.client?.clientId || '',
      isNewClient ? formDetails.client : undefined
    ),
    selectedClientName: formDetails.client?.name || '',
    formDetails
  }
}

const submissionFirstPage = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const formDetails = request.yar.get(submissionFormStateKey) || {}
        let clients = []

        try {
          clients = await getClients()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)
        }

        return h.view('submissionFirstPage.njk', {
          ...getClientDetailsViewContext(formDetails, clients)
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
        const formDetails = request.yar.get(submissionFormStateKey) || {}
        let clients = []

        try {
          clients = await getClients()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)
        }

        const selectedClient = request.payload.clientId === newClientOptionId &&
          formDetails.client &&
          !formDetails.client.clientId
          ? formDetails.client
          : clients.find((client) => client.clientId === request.payload.clientId)

        request.yar.set(submissionFormStateKey, {
          ...formDetails,
          client: selectedClient
        })
        request.yar.touch()

        return h.redirect(`/${pageName}`)
      }
    }
  ])
}

export default submissionFirstPage
