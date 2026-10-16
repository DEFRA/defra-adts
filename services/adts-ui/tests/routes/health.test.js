/**
 * Route-level tests for container health (server-side session).
 *
 * Verifies that the /health endpoint returns HTTP statusCode 200.
 *
 */
import { afterAll, afterEach, beforeAll, describe, expect, test, jest } from '@jest/globals'
import createServer from '../../src/app.js'
import { constants } from 'http2'

describe('Healthcheck endpoint', () => {
  let server

  beforeAll(async () => {
    process.env.PORT = '3000'
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200/backend'

    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should return http statusCode 200', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(constants.HTTP_STATUS_OK)
    expect(response.result).toEqual({ status: 'UP' })
  })

  test('should return the health status of host - statusCode 200', async () => {
    const mockHealthResponse = { status: 'UP' }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('http://my-target-host.internal:9000/health')
      return new Response(JSON.stringify(mockHealthResponse), {
        status: constants.HTTP_STATUS_OK,
        headers: { 'content-type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/connection_health?protocol=http&host=my-target-host.internal&port=9000'
    })
    expect(fetch).toHaveBeenCalled()
    expect(response.statusCode).toBe(constants.HTTP_STATUS_OK)
    expect(response.result).toEqual({ status: 'UP' })
  })

  test('should return error when host status not ok', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('http://my-target-host.internal:9000/health')
      return new Response('Not Found', {
        status: constants.HTTP_STATUS_NOT_FOUND
      })
    })
    const response = await server.inject({
      method: 'GET',
      url: '/connection_health?protocol=http&host=my-target-host.internal&port=9000'
    })
    expect(fetch).toHaveBeenCalled()
    expect(response.statusCode).toBe(constants.HTTP_STATUS_OK)
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
    expect(response.statusCode).toBe(constants.HTTP_STATUS_OK)
  })
})
