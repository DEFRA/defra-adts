import { constants } from 'node:http2'
import { getCountyNames } from '../data/counties.js'
import { getLimsIdForCiId } from '../data/ciLimsMapping.js'
import { mapLimsClient } from '../data/limsClients.js'

export const createClientsHandler = (getDynamoClient) => async (request, h) => {
  let pvsId
  try {
    pvsId = await getLimsIdForCiId(getDynamoClient(), request.auth.credentials.subject)
  } catch (error) {
    console.error('Error retrieving CI-to-LIMS mapping:', error.message)
    return h.response({ error: 'Unable to retrieve LIMS ID mapping' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
  }

  if (!pvsId) {
    return h.response({ error: 'No LIMS practice is associated with this account' })
      .code(constants.HTTP_STATUS_FORBIDDEN)
  }

  const url = `${process.env.SUBMISSIONS_SERVICE_URL}/v1/clients?${new URLSearchParams({ pvsId })}`

  let response
  try {
    response = await fetch(url)
  } catch (error) {
    console.error('Error contacting submissions service:', error.message)
    return h.response({ error: 'Unable to reach submissions service' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
  }

  const payload = await response.json()
  if (!response.ok) {
    return h.response(payload).code(response.status)
  }

  try {
    const countyNames = await getCountyNames(getDynamoClient())
    return h.response(payload.map((client) => mapLimsClient(client, countyNames)))
  } catch (error) {
    console.error('Error loading county reference data:', error.message)
    return h.response({ error: 'Unable to retrieve clients' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
  }
}
