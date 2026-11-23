import { constants } from 'node:http2'
import { getCountyNames } from '../data/counties.js'
import { mapLimsClient } from '../data/limsClients.js'

export const createClientsHandler = (getDynamoClient) => async (_request, h) => {
  const pvsId = process.env.LIMS_PVS_ID
  if (!pvsId) {
    console.error('LIMS_PVS_ID must be configured to retrieve clients')
    return h.response({ error: 'LIMS client lookup is not configured' })
      .code(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
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
