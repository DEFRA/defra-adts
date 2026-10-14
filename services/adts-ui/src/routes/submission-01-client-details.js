import Joi from 'joi'

const pageName = 'submission-01-client-details'

const submissionClientSchema = Joi.object({
  clientId: Joi.string().allow('').required()
})

const getClients = async () => {
  const adapterBaseUrl = process.env.SUBMISSIONS_SERVICE_URL

  if (!adapterBaseUrl) {
    throw new Error('SUBMISSIONS_SERVICE_URL must be configured')
  }

  const response = await fetch(`${adapterBaseUrl}/GetClients`)

  if (!response.ok) {
    throw new Error(`Backend responded with status: ${response.status}`)
  }

  const clients = await response.json()

  return clients.map((client) => ({
    clientId: String(client.clientId),
    name: client.name
  }))
}

const getClientOptions = (clients, selectedClientId = '') => [
  { value: '', text: 'Select a client', selected: !selectedClientId },
  ...clients.map((client) => ({
    value: client.clientId,
    text: client.name,
    selected: client.clientId === selectedClientId
  }))
]

const getClientDetailsViewContext = (formDetails, clients = []) => ({
  clientOptions: getClientOptions(clients, formDetails.client?.clientId || ''),
  selectedClientName: formDetails.client?.name || '',
  formDetails
})

const registerSubmissionPageOne = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: '/submission-01-client-details',
      handler: async (request, h) => {
        const formDetails = request.yar.get(submissionFormStateKey) || {}
        let clients = []

        try {
          clients = await getClients()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)
        }

        return h.view(`${pageName}.njk`, {
          ...getClientDetailsViewContext(formDetails, clients)
        })
      }
    },
    {
      method: 'POST',
      path: '/submission-01-client-details',
      options: {
        validate: {
          payload: submissionClientSchema
        }
      },
      handler: async (request, h) => {
        const formDetails = request.yar.get(submissionFormStateKey) || {}
        let clients

        try {
          clients = await getClients()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)

          return h.response().code(503)
        }

        const selectedClient = clients.find((client) => client.clientId === request.payload.clientId)

        if (!selectedClient) {
          return h.response().code(400)
        }

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

export default registerSubmissionPageOne
