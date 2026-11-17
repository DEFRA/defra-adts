import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import { constants } from 'node:http2'
import createServer from '../../src/app.js'

describe('LIMS Backend Proxy - Network Mock Tests', () => {
  let server
  const originalPvsId = process.env.LIMS_PVS_ID

  beforeAll(async () => {
    process.env.LIMS_API_URL = 'https://mock-lims.local'
    process.env.LIMS_PVS_ID = 'TEST-PVS-001'
    process.env.PORT = 3100
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
    if (originalPvsId === undefined) {
      delete process.env.LIMS_PVS_ID
    } else {
      process.env.LIMS_PVS_ID = originalPvsId
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should return the landing page message', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(res.statusCode).toBe(200)
    expect(res.result).toEqual({ message: 'You have hit the landing page' })
  })

  test('should request clients from the v1 LIMS route with the configured PVS ID and empty filter', async () => {
    const clients = [{ clientId: 'client-001', name: 'Example Farm' }]
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(clients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(fetch).toHaveBeenCalledWith(
      'https://mock-lims.local/general/getClients?pvsId=TEST-PVS-001&filter='
    )
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(clients)
  })

  test('should return an integration error status from the v1 LIMS clients route', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unavailable', { status: 503 }))

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ error: 'LIMS integration error' })
  })

  test.each(['LIMS_API_URL', 'LIMS_PVS_ID'])(
    'should reject the clients lookup when %s is not configured',
    async (environmentVariable) => {
      const original = process.env[environmentVariable]
      delete process.env[environmentVariable]
      jest.spyOn(globalThis, 'fetch')
      jest.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const response = await server.inject({ method: 'GET', url: '/GetClients' })

        expect(response.statusCode).toBe(500)
        expect(response.result).toEqual({ error: 'LIMS client lookup is not configured' })
        expect(globalThis.fetch).not.toHaveBeenCalled()
        expect(console.error).toHaveBeenCalledWith(
          'LIMS_API_URL and LIMS_PVS_ID must be configured to retrieve clients'
        )
      } finally {
        if (original === undefined) {
          delete process.env[environmentVariable]
        } else {
          process.env[environmentVariable] = original
        }
      }
    }
  )

  test('should return a bad gateway when the LIMS clients request fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('LIMS connection failed'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(constants.HTTP_STATUS_BAD_GATEWAY)
    expect(response.result).toEqual({ error: 'LIMS connectivity failure' })
    expect(console.error).toHaveBeenCalledWith(
      'Error retrieving clients from LIMS:',
      'LIMS connection failed'
    )
  })

  test('should return a bad gateway when the LIMS clients response is invalid JSON', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
    })
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(constants.HTTP_STATUS_BAD_GATEWAY)
    expect(response.result).toEqual({ error: 'LIMS connectivity failure' })
    expect(console.error).toHaveBeenCalledWith(
      'Error retrieving clients from LIMS:',
      'Invalid JSON'
    )
  })

  test('should pass downstream mock LIMS data straight back through the proxy', async () => {
    const testSubmissionsMock = [
      {
        id: 'TEST-1234',
        statuses: ['Submitted'],
        client: 'TESTING CLIENT',
        hasTests: false,
        tests: []
      }
    ]

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toMatch(/^https:\/\/mock-lims\.local/)
      return new Response(JSON.stringify({
        results: testSubmissionsMock,
        totalCount: testSubmissionsMock.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const res = await server.inject({
      method: 'GET',
      url: '/submissions?client=TESTING'
    })

    expect(res.statusCode).toBe(200)

    const data = JSON.parse(res.payload)
    expect(data.totalCount).toBe(1)
    expect(data.results[0].id).toBe('TEST-1234')
    expect(data.results[0].client).toBe('TESTING CLIENT')
  })

  test('should gracefully handle 500 downstream outages from LIMS platform', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: 500
      })
    })

    const res = await server.inject({
      method: 'GET',
      url: '/submissions'
    })
    expect(res.statusCode).toBe(500)
    const data = JSON.parse(res.payload)
    expect(data.error).toBe('LIMS integration error')
  })

  test('should return a bad gateway response when LIMS is unreachable', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('LIMS connection failed'))

    const res = await server.inject({
      method: 'GET',
      url: '/submissions'
    })

    expect(res.statusCode).toBe(constants.HTTP_STATUS_BAD_GATEWAY)
    const data = JSON.parse(res.payload)
    expect(data.error).toBe('LIMS connectivity failure')
  })
})
