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
    farmName: client?.farmName || '',
    address: [
      client?.addressLine1,
      client?.addressLine2,
      client?.addressLine3,
      client?.county,
      client?.postcode
    ]
      .filter(Boolean)
      .join(', ') || 'No address set',
    cph: client?.cph || 'No CPH number set'
  }
}

const getClientSummaryFromDetails = (clientDetails) => ({
  name: clientDetails.name || 'No client name set',
  farmName: clientDetails.farmName || '',
  address: [
    clientDetails.addressLine1,
    clientDetails.addressLine2,
    clientDetails.addressLine3,
    clientDetails.county,
    clientDetails.postcode
  ].filter(Boolean).join(', ') || 'No address set',
  cph: clientDetails.cph || 'No CPH number set'
})

const CLIENT_DETAILS_UNAVAILABLE = 'Client details unavailable'

export const loadClientSummary = async (submissionFormState) => {
  const clientDetails = submissionFormState.formData?.clientDetails
  const hasSubmittedClientDetails = clientDetails && [
    'name',
    'farmName',
    'addressLine1',
    'addressLine2',
    'addressLine3',
    'county',
    'postcode',
    'cph'
  ].some((fieldName) => Object.hasOwn(clientDetails, fieldName))

  if (hasSubmittedClientDetails) {
    return { clientSummary: getClientSummaryFromDetails(clientDetails) }
  }

  const clientsResult = await safeLoad(getClients)

  if (clientsResult.error) {
    return {
      clientSummary: {
        name: CLIENT_DETAILS_UNAVAILABLE,
        address: CLIENT_DETAILS_UNAVAILABLE,
        cph: CLIENT_DETAILS_UNAVAILABLE
      },
      clientSummaryError: clientsResult.error
    }
  }

  return {
    clientSummary: getClientSummary(clientsResult.data, clientDetails?.clientId)
  }
}
