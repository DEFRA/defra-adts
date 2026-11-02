import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 3300)

export const expectedPvsId = 'E2E-PVS-001'

export const clients = [
  {
    clientId: 'client-001',
    name: 'Example Farm',
    farmName: 'North Field',
    addressLine1: '1 Test Lane',
    addressLine2: 'Teston',
    county: 'Example County',
    postcode: 'ZZ1 1ZZ',
    cph: '12/345/6789'
  },
  { clientId: 42, name: 'Second Example Farm' }
]

const requests = []

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`)

  if (url.pathname === '/health') {
    return send(response, 200, { status: 'ok' })
  }

  if (url.pathname === '/general/getClients') {
    requests.push(Object.fromEntries(url.searchParams))
    return send(response, 200, clients)
  }

  // Lets tests assert on what the submissions service sent to LIMS
  if (url.pathname === '/__requests') {
    return send(response, 200, requests)
  }

  return send(response, 404, { error: 'Not found' })
})

server.listen(port, () => {
  console.log(`Mock LIMS listening on ${port}`)
})
