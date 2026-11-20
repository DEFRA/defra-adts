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
  const originalAuthProvider = process.env.AUTH_PROVIDER
  const originalAuthMode = process.env.AUTH_MODE

  afterAll(async () => {
    if (server) {
      await server.stop()
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
    if (originalAuthProvider === undefined) {
      delete process.env.AUTH_PROVIDER
    } else {
      process.env.AUTH_PROVIDER = originalAuthProvider
    }
    if (originalAuthMode === undefined) {
      delete process.env.AUTH_MODE
    } else {
      process.env.AUTH_MODE = originalAuthMode
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
    process.env.AUTH_PROVIDER = 'defra-id'
    process.env.AUTH_MODE = 'live'
    process.env.DEFRA_ID_WELL_KNOWN_URL = 'https://identity.example/.well-known/openid-configuration'
    process.env.DEFRA_ID_CLIENT_ID = 'test-client'
    process.env.DEFRA_ID_CLIENT_SECRET = 'test-client-secret'
    process.env.DEFRA_ID_SERVICE_ID = 'test-service'
    process.env.DEFRA_ID_POLICY = 'test-policy'
    process.env.DEFRA_ID_PUBLIC_BASE_URL = 'https://adts.example'
    server = await createServer()

    const productionResponse = await server.inject({ method: 'GET', url: '/health' })
    expect(productionResponse.headers['set-cookie']?.[0]).toMatch(/;\s*Secure(?:;|$)/i)
    expect(productionResponse.headers['set-cookie']?.[0]).toMatch(/;\s*SameSite=None(?:;|$)/i)
  })

  test.each([
    ['defra-id', '/auth/defra-id/sign-in', '/auth/defra-id/start'],
    ['entra', '/auth/entra/sign-in', '/auth/entra/start']
  ])('registers the %s sign-in flow and protects application pages', async (provider, signInPath, startPath) => {
    const originalProvider = process.env.AUTH_PROVIDER
    const originalMode = process.env.AUTH_MODE
    process.env.NODE_ENV = 'development'
    process.env.AUTH_PROVIDER = provider
    process.env.AUTH_MODE = 'mock'

    try {
      server = await createServer()
      const protectedResponse = await server.inject({ method: 'GET', url: '/' })
      expect(protectedResponse.statusCode).toBe(302)
      expect(protectedResponse.headers.location).toBe(startPath)

      const signInResponse = await server.inject({ method: 'GET', url: signInPath })
      expect(signInResponse.statusCode).toBe(200)
    } finally {
      if (server) {
        await server.stop()
        server = undefined
      }
      if (originalProvider === undefined) {
        delete process.env.AUTH_PROVIDER
      } else {
        process.env.AUTH_PROVIDER = originalProvider
      }
      if (originalMode === undefined) {
        delete process.env.AUTH_MODE
      } else {
        process.env.AUTH_MODE = originalMode
      }
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = originalNodeEnv
      }
    }
  })
})
