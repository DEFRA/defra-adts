import { describe, test, expect, afterEach } from '@jest/globals'
import Joi from 'joi'
import createServer from '../../src/app.js'

const liveEnv = {
  AUTH_PROVIDER: 'defra-id',
  AUTH_MODE: 'live',
  DEFRA_ID_WELL_KNOWN_URL: 'https://identity.example.test/.well-known/openid-configuration',
  DEFRA_ID_CLIENT_ID: 'client-id',
  DEFRA_ID_CLIENT_SECRET: 'client-secret',
  DEFRA_ID_SERVICE_ID: 'service-id',
  DEFRA_ID_POLICY: 'policy',
  DEFRA_ID_PUBLIC_BASE_URL: 'https://adts.example.test',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters'
}

describe('unauthenticated access', () => {
  const original = {}
  let server

  const setEnv = (values) => {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in original)) {
        original[key] = process.env[key]
      }
      process.env[key] = value
    }
  }

  afterEach(async () => {
    if (server) {
      await server.stop()
      server = undefined
    }
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  test('redirects straight to the OIDC start route and sets a session cookie', async () => {
    setEnv(liveEnv)
    server = await createServer()

    const response = await server.inject({ method: 'GET', url: '/' })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/auth/defra-id/start')
    expect(response.headers['set-cookie']).toBeDefined()
  })

  test.each(['/health', '/assets/css/application.css'])('does not redirect %s', async (url) => {
    setEnv(liveEnv)
    server = await createServer()

    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).not.toBe(302)
  })

  test('requires an explicit authentication mode outside tests', async () => {
    setEnv({ ...liveEnv, NODE_ENV: 'development' })
    delete process.env.AUTH_MODE

    await expect(createServer()).rejects.toThrow('AUTH_MODE must be set to "mock" or "live"')
  })

  test.each([
    [
      'an unsupported provider',
      { ...liveEnv, NODE_ENV: 'development', AUTH_PROVIDER: 'unknown', AUTH_MODE: 'mock' },
      'AUTH_PROVIDER must be set to "defra-id" or "entra"'
    ],
    [
      'an unsupported mode',
      { ...liveEnv, NODE_ENV: 'development', AUTH_MODE: 'disabled' },
      'AUTH_MODE must be set to "mock" or "live"'
    ],
    [
      'mock mode in production',
      { ...liveEnv, NODE_ENV: 'production', AUTH_MODE: 'mock' },
      'AUTH_MODE must be "live" in production'
    ]
  ])('rejects %s', async (_description, environment, error) => {
    setEnv(environment)

    await expect(createServer()).rejects.toThrow(error)
  })

  test('rejects live mode in development unless the local HTTP exception is set', async () => {
    setEnv({ ...liveEnv, NODE_ENV: 'development' })
    await expect(createServer()).rejects.toThrow('Live authentication requires secure cookies')

    setEnv({
      AUTH_ALLOW_INSECURE_LOCAL: 'true',
      DEFRA_ID_PUBLIC_BASE_URL: 'https://adts.example.test'
    })
    await expect(createServer()).rejects.toThrow('Live authentication requires secure cookies')
  })

  test('allows live authentication with the explicit localhost exception', async () => {
    setEnv({
      ...liveEnv,
      NODE_ENV: 'development',
      AUTH_ALLOW_INSECURE_LOCAL: 'true',
      DEFRA_ID_PUBLIC_BASE_URL: 'http://localhost:3000'
    })

    server = await createServer()

    expect(server).toBeDefined()
  })

  test('supports live Entra authentication configuration', async () => {
    setEnv({
      ...liveEnv,
      NODE_ENV: 'test',
      AUTH_PROVIDER: 'entra',
      ENTRA_TENANT_ID: 'tenant-id',
      ENTRA_CLIENT_ID: 'client-id',
      ENTRA_CLIENT_SECRET: 'client-secret',
      ENTRA_PUBLIC_BASE_URL: 'https://adts.example.test',
      ENTRA_API_SCOPE: 'api://adts-api/access_as_user'
    })

    server = await createServer()

    expect(server).toBeDefined()
  })

  test('rejects invalid local public URLs when insecure development auth is enabled', async () => {
    setEnv({
      ...liveEnv,
      NODE_ENV: 'development',
      AUTH_ALLOW_INSECURE_LOCAL: 'true',
      DEFRA_ID_PUBLIC_BASE_URL: 'not-a-url'
    })

    await expect(createServer()).rejects.toThrow('Live authentication requires secure cookies')
  })

  test('rejects incomplete live authentication configuration', async () => {
    setEnv({ ...liveEnv, NODE_ENV: 'test' })
    delete process.env.DEFRA_ID_POLICY

    await expect(createServer()).rejects.toThrow(
      'Missing live authentication configuration: DEFRA_ID_POLICY'
    )
  })

  test('returns Boom errors with their intended HTTP status', async () => {
    setEnv({
      AUTH_MODE: 'mock',
      NODE_ENV: 'test',
      SESSION_SECRET: liveEnv.SESSION_SECRET
    })
    server = await createServer()
    server.route({
      method: 'GET',
      path: '/test-error',
      options: {
        validate: {
          query: Joi.object({ name: Joi.string().required() })
        }
      },
      handler: () => 'ok'
    })

    const response = await server.inject({ method: 'GET', url: '/test-error' })

    expect(response.statusCode).toBe(400)
    expect(typeof response.result).toBe('string')
  })
})
