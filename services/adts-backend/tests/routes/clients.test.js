import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const limsClients = [
  {
    clientId: 'client-001',
    name: 'Example Farm',
    farm: 'North Field',
    address: '1 Test Lane, Teston, Upper Road',
    county: 'DORS',
    postcode: 'ZZ1 1ZZ',
    cphh: '12/345/6789'
  },
  { clientId: 42, name: 'Second Example Farm' }
]

const countyItems = [
  { PK: 'REF#COUNTY', SK: 'ORDER#0001#AB', code: 'AB', name: 'Argyll and Bute' },
  { PK: 'REF#COUNTY', SK: 'ORDER#0003#DORS', code: 'DORS', name: 'Dorset' }
]

describe('GET /GetClients', () => {
  let server
  const docClient = { send: jest.fn() }
  const originalLocalDraftOwnerId = process.env.LOCAL_DRAFT_OWNER_ID

  const mockMappingAndCountyData = (counties = countyItems) => {
    docClient.send.mockImplementation(({ input }) => {
      if (input.Key) {
        return Promise.resolve({ Item: { PK: 'USER-456', limsId: 'PVS001' } })
      }
      return Promise.resolve({ Items: counties })
    })
  }

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    process.env.LOCAL_DRAFT_OWNER_ID = 'USER-456'
    server = await createServer({ docClient })
  })

  afterAll(async () => {
    await server.stop()
    if (originalLocalDraftOwnerId === undefined) {
      delete process.env.LOCAL_DRAFT_OWNER_ID
    } else {
      process.env.LOCAL_DRAFT_OWNER_ID = originalLocalDraftOwnerId
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
    docClient.send.mockReset()
  })

  test('returns the authenticated user PVS ID from the mapping table', async () => {
    mockMappingAndCountyData()

    const response = await server.inject({ method: 'GET', url: '/GetPvsId' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ pvsId: 'PVS001' })
    expect(docClient.send.mock.calls[0][0].input).toEqual({
      TableName: 'adts-ci-lims-mapping',
      Key: { PK: 'USER-456' }
    })
  })

  test('maps LIMS clients to form field names and resolves county names', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(limsClients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    mockMappingAndCountyData()

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3100/v1/clients?pvsId=PVS001')
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([
      {
        clientId: 'client-001',
        name: 'Example Farm',
        farmName: 'North Field',
        addressLine1: '1 Test Lane',
        addressLine2: 'Teston',
        addressLine3: 'Upper Road',
        county: 'Dorset',
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

    const { input } = docClient.send.mock.calls[1][0]
    expect(input.ExpressionAttributeValues).toEqual({ ':pk': 'REF#COUNTY' })
  })

  test('returns an empty county when the LIMS county code is not in reference data', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ ...limsClients[0], county: 'XXX' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    mockMappingAndCountyData()

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.result[0].county).toBe('')
  })

  test('preserves an error status returned by the submissions service', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'LIMS integration error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    }))
    mockMappingAndCountyData()

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'LIMS integration error' })
    expect(docClient.send).toHaveBeenCalledTimes(1)
  })

  test('returns 502 when reference data for counties cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(limsClients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    docClient.send.mockImplementation(({ input }) => {
      if (input.Key) {
        return Promise.resolve({ Item: { PK: 'USER-456', limsId: 'PVS001' } })
      }
      return Promise.reject(new Error('DynamoDB unavailable'))
    })

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve clients' })
  })

  test('returns 502 when the submissions service cannot be reached', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockMappingAndCountyData()

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to reach submissions service' })
    expect(console.error).toHaveBeenCalledWith('Error contacting submissions service:', 'ECONNREFUSED')
  })

  test('denies access when the CI user has no LIMS mapping', async () => {
    docClient.send.mockResolvedValue({})
    jest.spyOn(globalThis, 'fetch')

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(403)
    expect(response.result).toEqual({
      error: 'No LIMS practice is associated with this account'
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
