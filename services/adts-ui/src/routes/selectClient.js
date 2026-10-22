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

const getNewClientOption = (newClient) => ({
  value: newClientOptionId,
  text: newClient.name || newClient.cph || 'New client',
  selected: true
})

const getClientOptions = (clients, selectedClientId, newClient, selectedClientName) => [
  { value: '', text: 'Select a client', selected: !selectedClientId },
  ...(newClient ? [getNewClientOption(newClient)] : []),
  ...clients.map((client) => {
    const selected = String(client.clientId) === String(selectedClientId)

    return {
      value: String(client.clientId),
      text: (selected && selectedClientName) || client.name,
      selected
    }
  })
]

const isNewClient = (clientDetails) => Boolean(clientDetails && !clientDetails.clientId)

const getCountyText = (client) => {
  if (client.countyName) {
    return client.countyName
  }

  return Number.isNaN(Number(client.county)) ? client.county || '' : ''
}

const getSelectedClientView = (client) => {
  if (!client?.clientId) {
    return undefined
  }

  return {
    ...client,
    address: [client.addressLine1, client.addressLine2, client.addressLine3]
      .filter(Boolean)
      .join(', '),
    county: getCountyText(client)
  }
}

const getClientDetailsViewContext = (submissionFormState, clients) => {
  const selectedClient = submissionFormState.formData?.clientDetails
  const newClient = isNewClient(selectedClient) ? selectedClient : undefined

  return {
    clientOptions: getClientOptions(
      clients,
      newClient ? newClientOptionId : selectedClient?.clientId || '',
      newClient,
      selectedClient?.name
    ),
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

const findSelectedClient = (clients, clientId, currentClientDetails) => {
  if (clientId === newClientOptionId && isNewClient(currentClientDetails)) {
    return currentClientDetails
  }

  return clients.find((client) => String(client.clientId) === clientId)
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
        const selectedClient = findSelectedClient(
          clients,
          request.payload.clientId,
          formData.clientDetails
        )

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
