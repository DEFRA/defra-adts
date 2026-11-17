import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

const createTestConfig = () => loadConfig({
  LIMS_BASE_URL: 'https://lims.example.test',
  LIMS_PREFIX: 'api',
  LIMS_USERNAME: 'service-user',
  LIMS_PASSWORD: 'test-password',
  LIMS_TIMEOUT_MS: '1000'
})

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
})

describe('client and practice API', () => {
  let server
  let limsClient

  beforeAll(async () => {
    limsClient = { request: jest.fn() }
    server = await createServer({ config: createTestConfig(), limsClient })
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

  test('searches clients using canonical pvsId and optional filter', async () => {
    const clients = [{ clientId: 'CLIENT-1', name: 'Smith Farm' }]
    limsClient.request.mockResolvedValue(jsonResponse(clients))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/clients?pvsId=PVS001&filter=Smith'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(clients)
    expect(limsClient.request).toHaveBeenCalledWith('general/getClients', {
      method: 'GET',
      query: { pvsId: 'PVS001', filter: 'Smith' }
    })
  })

  test('requires pvsId for client search and rejects unsupported query fields', async () => {
    const missingPvs = await server.inject({ method: 'GET', url: '/v1/clients?filter=Smith' })
    const unsupported = await server.inject({ method: 'GET', url: '/v1/clients?pvsId=PVS001&host=attacker.test' })

    expect(missingPvs.statusCode).toBe(400)
    expect(unsupported.statusCode).toBe(400)
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('retrieves practice details and maps the path identifier to LIMS pvsId', async () => {
    const practice = { pvsId: 'PVS001', name: 'North Practice' }
    limsClient.request.mockResolvedValue(jsonResponse(practice))

    const response = await server.inject({ method: 'GET', url: '/v1/practices/PVS001' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(practice)
    expect(limsClient.request).toHaveBeenCalledWith('general/getPVS', {
      method: 'GET',
      query: { pvsId: 'PVS001' }
    })
  })

  test('normalizes client lookup business errors', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({
      hasErrors: true,
      code: 'PVS_INVALID',
      errorMessages: ['token=secret-value']
    }))

    const response = await server.inject({ method: 'GET', url: '/v1/clients?pvsId=PVS001' })

    expect(response.statusCode).toBe(422)
    expect(response.result.category).toBe('business_error')
    expect(response.result.upstreamMessages).toEqual(['[REDACTED]'])
    expect(JSON.stringify(response.result)).not.toContain('secret-value')
  })

  test('normalizes unavailable practice lookups', async () => {
    limsClient.request.mockRejectedValue(new Error('private connection detail'))

    const response = await server.inject({ method: 'GET', url: '/v1/practices/PVS001' })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_transport_error')
    expect(JSON.stringify(response.result)).not.toContain('private connection detail')
  })
})
