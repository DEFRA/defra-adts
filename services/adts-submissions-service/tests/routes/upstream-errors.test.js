import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

const config = loadConfig({
  LIMS_BASE_URL: 'https://lims.example.test',
  LIMS_PREFIX: 'api',
  LIMS_TIMEOUT_MS: '1000'
})

const upstreamResponse = (status, body) => new Response(JSON.stringify(body), { status })

describe('upstream failure responses', () => {
  let server
  let limsClient

  beforeAll(async () => {
    limsClient = { request: jest.fn() }
    server = await createServer({ config, limsClient })
  })

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    limsClient.request.mockReset()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('does not expose LIMS credential rejection bodies', async () => {
    limsClient.request.mockResolvedValue(upstreamResponse(401, { message: 'invalid password secret' }))

    const response = await server.inject({ method: 'GET', url: '/v1/products?filter=mastitis' })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_http_error')
    expect(JSON.stringify(response.result)).not.toMatch(/invalid password secret/)
  })

  test('distinguishes an unavailable LIMS dependency from other upstream HTTP errors', async () => {
    limsClient.request.mockResolvedValue(upstreamResponse(503, { message: 'private outage' }))

    const response = await server.inject({ method: 'GET', url: '/v1/products?filter=mastitis' })

    expect(response.statusCode).toBe(503)
    expect(response.result.category).toBe('dependency_unavailable')
    expect(JSON.stringify(response.result)).not.toContain('private outage')
  })

  test('classifies timeout and transport failures separately', async () => {
    limsClient.request.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    limsClient.request.mockRejectedValueOnce(new Error('private connection detail'))

    const timeout = await server.inject({ method: 'GET', url: '/v1/products?filter=mastitis' })
    const transport = await server.inject({ method: 'GET', url: '/v1/products?filter=mastitis' })

    expect(timeout.statusCode).toBe(504)
    expect(timeout.result.category).toBe('upstream_timeout')
    expect(transport.statusCode).toBe(502)
    expect(transport.result.category).toBe('upstream_transport_error')
    expect(JSON.stringify(transport.result)).not.toContain('private connection detail')
  })
})
