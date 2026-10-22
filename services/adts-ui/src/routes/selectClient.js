import Joi from 'joi'

const pageName = 'submission-01-client-details'
const newClientOptionId = 'new-client'

const submissionClientSchema = Joi.object({
  clientId: Joi.string().allow('').required()
})

const getClients = async () => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/GetClients`)
  const clients = await response.json()

  return clients.map((client) => {
    const county = client.county ?? client.countyId

    return {
      ...client,
      clientId: String(client.clientId),
      name: client.name,
      ...(county === undefined || county === null ? {} : { county: String(county) })
    }
  })
}

const getClientOptions = (clients, selectedClientId, newClient, selectedClientName) => [
  { value: '', text: 'Select a client', selected: !selectedClientId },
  ...(newClient
    ? [{
        value: newClientOptionId,
        text: newClient.name || newClient.cph || 'New client',
        selected: true
      }]
    : []),
  ...clients.map((client) => ({
    value: String(client.clientId),
    text: String(client.clientId) === String(selectedClientId) && selectedClientName
      ? selectedClientName
      : client.name,
    selected: String(client.clientId) === String(selectedClientId)
  }))
]

const getClientDetailsViewContext = (submissionFormState, clients) => {
  const formData = submissionFormState.formData || {}
  const isNewClient = Boolean(formData.clientDetails && !formData.clientDetails.clientId)
  const selectedClient = formData.clientDetails

  return {
    clientOptions: getClientOptions(
      clients,
      isNewClient ? newClientOptionId : selectedClient?.clientId || '',
      isNewClient ? selectedClient : undefined,
      selectedClient?.name
    ),
    selectedClientName: selectedClient?.name || '',
    selectedClient: selectedClient?.clientId && {
      ...selectedClient,
      address: [
        selectedClient.addressLine1,
        selectedClient.addressLine2,
        selectedClient.addressLine3
      ].filter(Boolean).join(', '),
      county: selectedClient.countyName || (
        selectedClient.county && Number.isNaN(Number(selectedClient.county))
          ? selectedClient.county
          : ''
      )
    },
    submissionFormState
  }
}

const selectClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        let clients = []

        try {
          clients = await getClients()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)
        }

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
        let clients = []

        try {
          clients = await getClients()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)
        }

        const selectedClient = request.payload.clientId === newClientOptionId &&
          formData.clientDetails &&
          !formData.clientDetails.clientId
          ? formData.clientDetails
          : clients.find((client) => String(client.clientId) === request.payload.clientId)

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: {
            ...formData,
            clientDetails: selectedClient
          }
        })
        request.yar.touch()

        return h.redirect(`/${pageName}`)
      }
    }
  ])
}

export default selectClient
