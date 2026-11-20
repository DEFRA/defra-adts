import { fetchFromBackend } from './auth.js'

// The backend returns fully formed client records, so no further lookups are needed.
export const getClients = async (request) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetchFromBackend(`${backendBaseUrl}/GetClients`, request)
  const clients = await response.json()

  return clients.map((client) => ({
    ...client,
    clientId: String(client.clientId)
  }))
}
