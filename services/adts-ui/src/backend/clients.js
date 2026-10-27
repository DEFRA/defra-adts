// The backend returns fully formed client records, so no further lookups are needed.
export const getClients = async () => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/GetClients`)
  const clients = await response.json()

  return clients.map((client) => ({
    ...client,
    clientId: String(client.clientId)
  }))
}
