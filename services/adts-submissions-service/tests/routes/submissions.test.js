import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

describe('LIMS Backend Proxy - Network Mock Tests', () => {
  let server
  let limsClient

  beforeAll(async () => {
    process.env.PORT = 3100
    limsClient = { request: jest.fn() }
    server = await createServer({
      config: loadConfig({
        LIMS_BASE_URL: 'https://mock-lims.local',
        LIMS_PREFIX: 'api',
        LIMS_USERNAME: 'test-user',
        LIMS_PASSWORD: 'test-password',
        LIMS_TIMEOUT_MS: '1000'
      }),
      limsClient
    })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
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
