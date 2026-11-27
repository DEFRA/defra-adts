import { constants } from 'node:http2'
import { getLimsIdForCiId } from '../data/ciLimsMapping.js'

export const createPvsIdHandler = (getDynamoClient) => async (request, h) => {
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

  return h.response({ pvsId })
}
