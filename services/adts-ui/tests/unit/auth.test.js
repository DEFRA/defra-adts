import { describe, test, expect, afterEach } from '@jest/globals'
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
      original[key] = process.env[key]
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

  test('rejects live mode in development unless the local HTTP exception is set', async () => {
    setEnv({ ...liveEnv, NODE_ENV: 'development' })
    await expect(createServer()).rejects.toThrow('Live authentication requires secure cookies')

    setEnv({
      AUTH_ALLOW_INSECURE_LOCAL: 'true',
      DEFRA_ID_PUBLIC_BASE_URL: 'https://adts.example.test'
    })
    await expect(createServer()).rejects.toThrow('Live authentication requires secure cookies')
  })
})
