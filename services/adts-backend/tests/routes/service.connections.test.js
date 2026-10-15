/**
 * Route-level tests for container health (server-side session).
 *
 * Verifies that the /health endpoint returns HTTP statusCode 200.
 *
 */
import { afterAll, afterEach, beforeAll, describe, expect, test, jest } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Healthcheck endpoint', () => {
  let server

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3000/submissions'

    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should return the health status of host - statusCode 200', async () => {
    const mockHealthResponse = { status: 'UP' }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('http://my-target-host.internal:9000/health')
      return new Response(JSON.stringify(mockHealthResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/connection_health?protocol=http&host=my-target-host.internal&port=9000'
    })
    expect(fetch).toHaveBeenCalled()
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ status: 'UP' })
  })

  test('should return error when host status not ok', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('http://my-target-host.internal:9000/health')
      return new Response('Not Found', {
        ok: false,
        status: 404,
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/connection_health?protocol=http&host=my-target-host.internal&port=9000'
    })
    expect(fetch).toHaveBeenCalled()
    expect(response.statusCode).toBe(200)
  })

  test('should return error when host request throws exception', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('http://my-target-host.internal:9000/health')
      throw new Error('Backend unreachable.')
    })

    const response = await server.inject({
      method: 'GET',
      url: '/connection_health?protocol=http&host=my-target-host.internal&port=9000'
    })
    expect(fetch).toHaveBeenCalled()
    expect(response.statusCode).toBe(200)
  })
})
