/**
 * Route-level tests for container health (server-side session).
 *
 * Verifies that the /health endpoint returns HTTP statusCode 200.
 *
 */
import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

describe('health endpoints', () => {
  let server
  let limsClient

  beforeAll(async () => {
    limsClient = { request: jest.fn() }
    server = await createServer({
      config: loadConfig({
        PORT: '3000',
        LIMS_BASE_URL: 'https://lims.example.test',
        LIMS_PREFIX: 'api',
        LIMS_USERNAME: 'service-user',
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
    jest.restoreAllMocks()
  })

  test('reports process health and readiness without checking LIMS', async () => {
    limsClient.request.mockRejectedValue(new Error('LIMS unavailable'))
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })
    const readiness = await server.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ status: 'UP' })
    expect(readiness.statusCode).toBe(200)
    expect(readiness.result).toEqual({ status: 'READY' })
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('reports configured LIMS connectivity independently', async () => {
    limsClient.request.mockResolvedValue(new Response('{"status":"UP"}', { status: 200 }))

    const response = await server.inject({ method: 'GET', url: '/health/lims' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ status: 'UP' })
    expect(limsClient.request).toHaveBeenCalledWith('general/getpingOK')
  })

  test('returns dependency unavailable without changing process health or exposing upstream details', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})
    limsClient.request.mockRejectedValue(new Error('secret endpoint and credentials'))

    const response = await server.inject({ method: 'GET', url: '/health/lims' })
    const processHealth = await server.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ status: 'DOWN', dependency: 'lims' })
    expect(JSON.stringify(response.result)).not.toContain('secret')
    expect(processHealth.statusCode).toBe(200)
    expect(errorLog).toHaveBeenCalledTimes(1)
    const logRecord = JSON.parse(errorLog.mock.calls[0][0])
    expect(logRecord).toMatchObject({ event: 'request.failed', statusCode: 503 })
    expect(JSON.stringify(logRecord)).not.toMatch(/secret|credentials/)
  })

  test('returns dependency unavailable when LIMS responds with a non-success status', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    limsClient.request.mockResolvedValue(new Response('unauthorized', { status: 401 }))

    const response = await server.inject({ method: 'GET', url: '/health/lims' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ status: 'DOWN', dependency: 'lims' })
  })

  test('does not use caller-supplied host or port when probing LIMS', async () => {
    limsClient.request.mockResolvedValue(new Response('{"status":"UP"}', { status: 200 }))

    const response = await server.inject({
      method: 'GET',
      url: '/health/lims?host=attacker.example&port=80'
    })

    expect(response.statusCode).toBe(200)
    expect(limsClient.request).toHaveBeenCalledWith('general/getpingOK')
  })
})
