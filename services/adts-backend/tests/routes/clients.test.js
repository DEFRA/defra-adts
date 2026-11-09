import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const limsClients = [
  {
    clientId: 'client-001',
    name: 'Example Farm',
    farm: 'North Field',
    address: '1 Test Lane, Teston, Upper Road',
    county: 'DEV',
    postcode: 'ZZ1 1ZZ',
    cphh: '12/345/6789'
  },
  { clientId: 42, name: 'Second Example Farm' }
]

const countyItems = [
  { PK: 'REF#COUNTY', SK: 'ORDER#0001#AB', code: 'AB', name: 'Argyll and Bute' },
  { PK: 'REF#COUNTY', SK: 'ORDER#0002#DEV', code: 'DEV', name: 'Devon' }
]

describe('GET /GetClients', () => {
  let server
  const docClient = { send: jest.fn() }

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer({ docClient })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    docClient.send.mockReset()
  })

  test('maps LIMS clients to form field names and resolves county names', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(limsClients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    docClient.send.mockResolvedValue({ Items: countyItems })

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3100/GetClients')
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([
      {
        clientId: 'client-001',
        name: 'Example Farm',
        farmName: 'North Field',
        addressLine1: '1 Test Lane',
        addressLine2: 'Teston',
        addressLine3: 'Upper Road',
        county: 'Devon',
        postcode: 'ZZ1 1ZZ',
        cph: '12/345/6789'
      },
      {
        clientId: 42,
        name: 'Second Example Farm',
        farmName: '',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        county: '',
        postcode: '',
        cph: ''
      }
    ])

    const { input } = docClient.send.mock.calls[0][0]
    expect(input.ExpressionAttributeValues).toEqual({ ':pk': 'REF#COUNTY' })
  })

  test('returns an empty county when the LIMS county code is not in reference data', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ ...limsClients[0], county: 'XXX' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    docClient.send.mockResolvedValue({ Items: countyItems })

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.result[0].county).toBe('')
  })

  test('preserves an error status returned by the submissions service', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'LIMS integration error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'LIMS integration error' })
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('returns 502 when reference data for counties cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(limsClients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    docClient.send.mockRejectedValue(new Error('DynamoDB unavailable'))

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve clients' })
  })

  test('returns 502 when the submissions service cannot be reached', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to reach submissions service' })
    expect(console.error).toHaveBeenCalledWith('Error contacting submissions service:', 'ECONNREFUSED')
  })
})
