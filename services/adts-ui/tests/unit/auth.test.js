import { describe, test, expect, afterEach, jest } from '@jest/globals'
import Joi from 'joi'
import createServer from '../../src/app.js'
import { PVS_ID_SESSION_KEY } from '../../src/auth/pvsIdSession.js'

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
    jest.restoreAllMocks()
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

  test('loads the signed-in user LIMS ID once and stores it in the session', async () => {
    setEnv({
      NODE_ENV: 'development',
      AUTH_PROVIDER: 'defra-id',
      AUTH_MODE: 'mock',
      SESSION_SECRET: liveEnv.SESSION_SECRET,
      BACKEND_SERVICE_URL: 'http://localhost:3200'
    })
    server = await createServer()
    server.route([
      {
        method: 'GET',
        path: '/auth/test-login',
        handler: (request, h) => {
          request.yar.set('auth', {
            isAuthenticated: true,
            subject: 'ci-user-123',
            token: 'test-access-token'
          })
          return h.response('signed in')
        }
      },
      {
        method: 'GET',
        path: '/auth/test-pvs-id',
        handler: (request) => request.yar.get(PVS_ID_SESSION_KEY)
      }
    ])
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ pvsId: 'PVS001' }), { status: 200 })
    )
    const login = await server.inject({ method: 'GET', url: '/auth/test-login' })
    const loginCookie = login.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ')
    const landing = await server.inject({
      method: 'GET',
      url: '/',
      headers: { cookie: loginCookie }
    })
    const landingCookie = landing.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ')
    const session = await server.inject({
      method: 'GET',
      url: '/auth/test-pvs-id',
      headers: { cookie: landingCookie }
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3200/GetPvsId',
      { headers: { Authorization: 'Bearer test-access-token' } }
    )
    expect(landing.statusCode).toBe(200)
    expect(session.result).toEqual({ subject: 'ci-user-123', pvsId: 'PVS001' })
  })

  test('blocks the application when the signed-in user has no LIMS mapping', async () => {
    setEnv({
      NODE_ENV: 'development',
      AUTH_PROVIDER: 'defra-id',
      AUTH_MODE: 'mock',
      SESSION_SECRET: liveEnv.SESSION_SECRET,
      BACKEND_SERVICE_URL: 'http://localhost:3200'
    })
    server = await createServer()
    server.route({
      method: 'GET',
      path: '/auth/test-login',
      handler: (request, h) => {
        request.yar.set('auth', {
          isAuthenticated: true,
          subject: 'ci-user-without-mapping',
          token: 'test-access-token'
        })
        return h.response('signed in')
      }
    })
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'No LIMS practice is associated with this account' }), {
        status: 403
      })
    )
    const login = await server.inject({ method: 'GET', url: '/auth/test-login' })
    const loginCookie = login.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ')
    const landing = await server.inject({
      method: 'GET',
      url: '/',
      headers: { cookie: loginCookie }
    })

    expect(landing.statusCode).toBe(403)
    expect(landing.result).toEqual({
      error: 'Your account is not associated with a LIMS practice'
    })
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

  test('uses a localhost-compatible session cookie for local live authentication', async () => {
    setEnv({
      ...liveEnv,
      NODE_ENV: 'development',
      AUTH_ALLOW_INSECURE_LOCAL: 'true',
      DEFRA_ID_PUBLIC_BASE_URL: 'http://localhost:3000'
    })
    server = await createServer()

    const response = await server.inject({ method: 'GET', url: '/' })
    const cookie = response.headers['set-cookie'].join(';')

    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Secure')
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
