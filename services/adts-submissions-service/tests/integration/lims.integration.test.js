import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import { constants } from 'node:http2'
import createServer from '../../src/app.js'
import { createLimsClient } from '../../src/clients/lims-client.js'
import { loadConfig } from '../../src/config.js'

describe('Submissions-service LIMS integration', () => {
  let server
  let fetch
  let originalPort

  beforeAll(async () => {
    originalPort = process.env.PORT
    process.env.PORT = '3100'
    const config = loadConfig({
      LIMS_BASE_URL: 'https://mock-lims.local',
      LIMS_USERNAME: 'test-user',
      LIMS_PASSWORD: 'test-password',
      LIMS_TIMEOUT_MS: '1000'
    })
    fetch = jest.fn()
    const limsClient = createLimsClient({ ...config.lims, fetchImpl: fetch })
    server = await createServer({ config, limsClient })
  })

  afterAll(async () => {
    if (server) {
      await server.stop()
    }
    if (originalPort === undefined) {
      delete process.env.PORT
    } else {
      process.env.PORT = originalPort
    }
  })

  afterEach(() => {
    fetch.mockReset()
  })

  test('proxies query parameters to the LIMS endpoint and returns the response body', async () => {
    const limsPayload = {
      results: [{ id: 'LIMS-001', statuses: ['Submitted'], client: 'Acme Farm' }],
      totalCount: 1
    }
    fetch.mockResolvedValue(new Response(JSON.stringify(limsPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?client=Acme&status=submitted'
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0].toString()).toBe(
      'https://mock-lims.local/submissions?client=Acme&status=submitted'
    )
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(limsPayload)
  })

  test('returns downstream status codes when the LIMS responds unsuccessfully', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({
      error: 'Service unavailable'
    }), { status: 503 }))

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(503)
    expect(response.result.category).toBe('dependency_unavailable')
    expect(response.result.message).toBe('LIMS could not complete the submission search.')
    expect(JSON.stringify(response.result)).not.toContain('Service unavailable')
  })

  test('returns 502 when the LIMS endpoint cannot be reached', async () => {
    fetch.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(constants.HTTP_STATUS_BAD_GATEWAY)
    expect(response.result.category).toBe('upstream_transport_error')
    expect(response.result.message).toBe('The LIMS request could not be completed.')
    expect(JSON.stringify(response.result)).not.toContain('ECONNREFUSED')
  })
})
