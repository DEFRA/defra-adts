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

  test('should return http statusCode 200', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ status: 'UP' })
  })
})
