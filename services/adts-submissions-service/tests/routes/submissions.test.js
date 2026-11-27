import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import { constants } from 'node:http2'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

describe('LIMS Backend Proxy - Network Mock Tests', () => {
  let server
  let limsClient
  let originalLimsApiUrl

  beforeAll(async () => {
    originalLimsApiUrl = process.env.LIMS_API_URL
    process.env.LIMS_API_URL = 'https://mock-lims.local'
    process.env.PORT = 3100
    limsClient = { request: jest.fn() }
    server = await createServer({
      config: loadConfig({
        LIMS_BASE_URL: 'https://mock-lims.local',
        LIMS_PREFIX: 'api',
        LIMS_TIMEOUT_MS: '1000'
      }),
      limsClient
    })
  })

  afterAll(async () => {
    await server.stop()
    if (originalLimsApiUrl === undefined) {
      delete process.env.LIMS_API_URL
    } else {
      process.env.LIMS_API_URL = originalLimsApiUrl
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
    limsClient.request.mockReset()
  })

  test('should return the landing page message', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(res.statusCode).toBe(200)
    expect(res.result).toEqual({ message: 'You have hit the landing page' })
  })

  test('should request clients from the v1 LIMS route using the provided PVS ID', async () => {
    const clients = [{ clientId: 'client-001', name: 'Example Farm' }]
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(clients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/GetClients?pvsId=TEST-PVS-001'
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://mock-lims.local/general/getClients?pvsId=TEST-PVS-001&filter='
    )
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(clients)
  })

  test('should return an integration error status from the v1 LIMS clients route', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unavailable', { status: 503 }))

    const response = await server.inject({
      method: 'GET',
      url: '/GetClients?pvsId=TEST-PVS-001'
    })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ error: 'LIMS integration error' })
  })

  test('should reject the clients lookup when LIMS_API_URL is not configured', async () => {
    const original = process.env.LIMS_API_URL
    delete process.env.LIMS_API_URL
    jest.spyOn(globalThis, 'fetch')
    jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/GetClients?pvsId=TEST-PVS-001'
      })

      expect(response.statusCode).toBe(500)
      expect(response.result).toEqual({ error: 'LIMS client lookup is not configured' })
      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledWith(
        'LIMS_API_URL must be configured to retrieve clients'
      )
    } finally {
      if (original === undefined) {
        delete process.env.LIMS_API_URL
      } else {
        process.env.LIMS_API_URL = original
      }
    }
  })

  test('requires a PVS ID for client lookup', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch')

    const response = await server.inject({ method: 'GET', url: '/GetClients' })

    expect(response.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('should return a bad gateway when the LIMS clients request fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('LIMS connection failed'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'GET',
      url: '/GetClients?pvsId=TEST-PVS-001'
    })

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

    const response = await server.inject({
      method: 'GET',
      url: '/GetClients?pvsId=TEST-PVS-001'
    })

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

    const payload = {
      results: testSubmissionsMock,
      totalCount: testSubmissionsMock.length
    }
    limsClient.request.mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const res = await server.inject({
      method: 'GET',
      url: '/submissions?client=TESTING'
    })

    expect(res.statusCode).toBe(200)

    const data = JSON.parse(res.payload)
    expect(data.totalCount).toBe(1)
    expect(data.results[0].id).toBe('TEST-1234')
    expect(data.results[0].client).toBe('TESTING CLIENT')
    expect(limsClient.request).toHaveBeenCalledWith('submissions', {
      method: 'GET',
      query: { client: 'TESTING' }
    })
  })

  test('normalizes upstream HTTP failures without returning the raw body', async () => {
    limsClient.request.mockResolvedValue(new Response(JSON.stringify({ secret: 'upstream detail' }), {
      status: 500
    }))

    const res = await server.inject({
      method: 'GET',
      url: '/submissions'
    })
    expect(res.statusCode).toBe(502)
    expect(res.result.category).toBe('upstream_http_error')
    expect(JSON.stringify(res.result)).not.toContain('upstream detail')
  })

  test('normalizes an unavailable LIMS response', async () => {
    limsClient.request.mockRejectedValue(new Error('LIMS connection failed'))

    const res = await server.inject({
      method: 'GET',
      url: '/submissions'
    })

    expect(res.statusCode).toBe(502)
    expect(res.result.category).toBe('upstream_transport_error')
    expect(JSON.stringify(res.result)).not.toContain('LIMS connection failed')
  })
})
