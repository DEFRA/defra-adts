import { constants } from 'http2'
import { getCountyNames } from '../data/counties.js'
import { mapLimsClient } from '../data/limsClients.js'

export const createClientsHandler = (getDynamoClient) => async (_request, h) => {
  const url = `${process.env.SUBMISSIONS_SERVICE_URL}/GetClients`

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
