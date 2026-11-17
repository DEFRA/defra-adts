import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

const config = loadConfig({
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

describe('GET latest submission results', () => {
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

  test('maps PVS/submission identifiers and preserves latest results and charges', async () => {
    const result = {
      submissionId: 'SUB-123',
      results: [{ testId: 'TEST-1', status: 'Released' }],
      charges: [{ amount: '12.50', currency: 'GBP' }]
    }
    limsClient.request.mockResolvedValue(jsonResponse(result))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/results/latest?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(result)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getLatestReleasedResults', {
      method: 'GET',
      query: { pvsId: 'PVS001', submissionId: 'SUB-123' }
    })
  })

  test('rejects missing PVS scope before contacting LIMS', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/results/latest'
    })

    expect(response.statusCode).toBe(400)
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('distinguishes empty released results from an unavailable LIMS dependency', async () => {
    limsClient.request.mockResolvedValueOnce(jsonResponse({ results: [], charges: [] }))
    limsClient.request.mockResolvedValueOnce(jsonResponse({ message: 'unavailable' }, 503))

    const empty = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/results/latest?pvsId=PVS001'
    })
    const unavailable = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/results/latest?pvsId=PVS001'
    })

    expect(empty.statusCode).toBe(200)
    expect(empty.result).toEqual({ results: [], charges: [] })
    expect(unavailable.statusCode).toBe(503)
    expect(unavailable.result.category).toBe('dependency_unavailable')
    expect(JSON.stringify(unavailable.result)).not.toContain('private outage')
  })
})
