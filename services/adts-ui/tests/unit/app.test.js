import { describe, test, expect, afterAll } from '@jest/globals'
import createServer from '../../src/app.js'

/**
 * Unit test — server factory only.
 *
 * Route-level behaviour (GET / responds, returns HTML) is covered by
 * route tests in services/adts-ui/tests/routes/dashboard-layout.test.js
 * and dashboard-filter-persistence.test.js — not duplicated here.
 */
describe('createServer', () => {
  let server
  const originalNodeEnv = process.env.NODE_ENV

  afterAll(async () => {
    if (server) {
      await server.stop()
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  test('uses HTTP-compatible session cookies in development and secure cookies in production', async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.NODE_ENV = 'development'
    server = await createServer()

    expect(server).toBeDefined()
    expect(typeof server.inject).toBe('function')

    const developmentResponse = await server.inject({ method: 'GET', url: '/health' })
    expect(developmentResponse.headers['set-cookie']?.[0]).not.toMatch(/;\s*Secure(?:;|$)/i)

    await server.stop()
    delete process.env.NODE_ENV
    server = await createServer()

    const defaultResponse = await server.inject({ method: 'GET', url: '/health' })
    expect(defaultResponse.headers['set-cookie']?.[0]).toMatch(/;\s*Secure(?:;|$)/i)

    await server.stop()
    process.env.NODE_ENV = 'production'
    server = await createServer()

    const productionResponse = await server.inject({ method: 'GET', url: '/health' })
    expect(productionResponse.headers['set-cookie']?.[0]).toMatch(/;\s*Secure(?:;|$)/i)
  })
})
