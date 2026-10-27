import { getClients } from '../backend/clients.js'

export const BAD_REQUEST_STATUS = 400
export const BAD_GATEWAY_STATUS = 502

export const safeLoad = async (loader) => {
  try {
    return { data: await loader() }
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
    return { error }
  }
}

export const getClientSummary = (clients, clientId) => {
  const client = clients.find((item) => item.clientId === clientId)

  return {
    name: client?.name || 'No client name set',
    address: [client?.addressLine1, client?.addressLine2, client?.addressLine3, client?.postcode]
      .filter(Boolean)
      .join(', ') || 'No address set',
    cph: client?.cph || 'No CPH number set'
  }
}

export const loadClientSummary = async (submissionFormState) => {
  const clientsResult = await safeLoad(getClients)

  if (clientsResult.error) {
    return {
      clientSummary: {
        name: 'Client details unavailable',
        address: 'Client details unavailable',
        cph: 'Client details unavailable'
      },
      clientSummaryError: clientsResult.error
    }
  }

  return {
    clientSummary: getClientSummary(
      clientsResult.data,
      submissionFormState.formData?.clientDetails?.clientId
    )
  }
}
