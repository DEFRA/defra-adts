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

describe('GET /v1/products', () => {
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

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    limsClient.request.mockReset()
    jest.restoreAllMocks()
  })

  test('requires filter and does not contact LIMS for invalid input', async () => {
    const response = await server.inject({ method: 'GET', url: '/v1/products' })

    expect(response.statusCode).toBe(400)
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('forwards required filter and optional species and preserves product records', async () => {
    const products = [{ productId: 'TEST-1', label: 'Mastitis test' }]
    limsClient.request.mockResolvedValue(jsonResponse(products))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/products?filter=mastitis&species=CATTLE'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(products)
    expect(limsClient.request).toHaveBeenCalledWith('general/getProducts', {
      method: 'GET',
      query: { filter: 'mastitis', species: 'CATTLE' }
    })
  })

  test('allows species to be omitted', async () => {
    limsClient.request.mockResolvedValue(jsonResponse([]))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/products?filter=mastitis'
    })

    expect(response.statusCode).toBe(200)
    expect(limsClient.request).toHaveBeenCalledWith('general/getProducts', {
      method: 'GET',
      query: { filter: 'mastitis', species: undefined }
    })
  })

  test('normalizes LIMS business-level errors', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({
      hasErrors: true,
      code: 'INVALID_FILTER',
      errorMessages: ['token=secret-value']
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/products?filter=mastitis'
    })

    expect(response.statusCode).toBe(422)
    expect(response.result).toMatchObject({
      category: 'business_error',
      upstreamCode: 'INVALID_FILTER'
    })
    expect(response.result.upstreamMessages).toEqual(['[REDACTED]'])
    expect(JSON.stringify(response.result)).not.toContain('secret-value')
  })

  test('normalizes upstream HTTP failures without returning the raw body', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({ secret: 'private' }, 500))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/products?filter=mastitis'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_http_error')
    expect(JSON.stringify(response.result)).not.toContain('private')
  })

  test('normalizes invalid JSON from a successful LIMS response', async () => {
    limsClient.request.mockResolvedValue(new Response('not json', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/products?filter=mastitis'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_http_error')
  })

  test('normalizes unavailable LIMS responses', async () => {
    limsClient.request.mockRejectedValue(new Error('private connection detail'))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/products?filter=mastitis'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_transport_error')
    expect(JSON.stringify(response.result)).not.toContain('private connection detail')
  })
})
