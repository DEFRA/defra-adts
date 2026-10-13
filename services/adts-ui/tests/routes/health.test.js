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
    process.env.PORT = '3000'
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100/submissions'

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

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ status: 'UP' })
  })

  test('should return the health status of submissions statusCode 200', async () => {
    const mockHealthResponse = {
      submissions: { status: 'UP' }
    }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('/submissions/health')
      return new Response(JSON.stringify(mockHealthResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/submissions_health'
    })
    expect(response.statusCode).toBe(200)
    console.log(`Result is: ${response.result}`)
    expect(response.result).toEqual({ submissions: { status: 'UP' } })
  })
})
