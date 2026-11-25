import { afterEach, describe, expect, jest, test } from '@jest/globals'
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT
} from 'jose'
import { registerAuthentication, verifyAccessToken } from '../../src/auth.js'
import Hapi from '@hapi/hapi'
import createServer from '../../src/app.js'

describe('backend OIDC authentication', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAuthMode = process.env.AUTH_MODE

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
    if (originalAuthMode === undefined) {
      delete process.env.AUTH_MODE
    } else {
      process.env.AUTH_MODE = originalAuthMode
    }
  })

  test('validates issuer, audience, scope, and derives an issuer-scoped owner id', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const jwks = createLocalJWKSet({ keys: [await exportJWK(publicKey)] })
    const provider = {
      issuer: 'https://identity.example',
      audience: 'adts-api',
      requiredScope: 'access_as_user',
      jwks
    }
    const token = await new SignJWT({ scp: 'openid access_as_user' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(provider.issuer)
      .setAudience(provider.audience)
      .setSubject('subject-123')
      .setExpirationTime('5m')
      .sign(privateKey)

    await expect(verifyAccessToken(token, [provider])).resolves.toEqual({
      issuer: provider.issuer,
      subject: 'subject-123',
      ownerId: 'https://identity.example|subject-123',
      roles: []
    })
  })

  test('rejects a token with an unexpected audience', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const provider = {
      issuer: 'https://identity.example',
      audience: 'adts-api',
      requiredScope: 'access_as_user',
      jwks: createLocalJWKSet({ keys: [await exportJWK(publicKey)] })
    }
    const token = await new SignJWT({ scp: 'openid' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(provider.issuer)
      .setAudience('another-api')
      .setSubject('subject-123')
      .setExpirationTime('5m')
      .sign(privateKey)

    await expect(verifyAccessToken(token, [provider])).rejects.toThrow()
  })

  test('rejects a token with the expected audience but without the API scope', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const provider = {
      issuer: 'https://identity.example',
      audience: 'adts-api',
      requiredScope: 'access_as_user',
      jwks: createLocalJWKSet({ keys: [await exportJWK(publicKey)] })
    }
    const token = await new SignJWT({ scp: 'openid' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(provider.issuer)
      .setAudience(provider.audience)
      .setSubject('subject-123')
      .setExpirationTime('5m')
      .sign(privateKey)

    await expect(verifyAccessToken(token, [provider]))
      .rejects.toThrow('Token does not contain the required API scope')
  })

  test('rejects mock authentication in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.AUTH_MODE = 'mock'

    await expect(registerAuthentication(Hapi.server()))
      .rejects.toThrow('AUTH_MODE must be "live" in production')
  })

  test('loads Entra discovery metadata from the configured well-known URL', async () => {
    const originalEnv = Object.fromEntries([
      'DEFRA_ID_WELL_KNOWN_URL',
      'DEFRA_ID_API_AUDIENCE',
      'ENTRA_WELL_KNOWN_URL',
      'ENTRA_TENANT_ID',
      'ENTRA_API_AUDIENCE',
      'ENTRA_API_SCOPE'
    ].map((name) => [name, process.env[name]]))
    const entraWellKnownUrl =
      'https://login.microsoftonline.com/tenant-123/v2.0/.well-known/openid-configuration'
    const discoveryResponses = {
      'https://defra.example/.well-known/openid-configuration': {
        issuer: 'https://defra.example',
        jwks_uri: 'https://defra.example/jwks'
      },
      [entraWellKnownUrl]: {
        issuer: 'https://login.microsoftonline.com/tenant-123/v2.0',
        jwks_uri: 'https://login.microsoftonline.com/tenant-123/discovery/v2.0/keys'
      }
    }

    process.env.NODE_ENV = 'test'
    process.env.AUTH_MODE = 'live'
    process.env.DEFRA_ID_WELL_KNOWN_URL =
      'https://defra.example/.well-known/openid-configuration'
    process.env.DEFRA_ID_API_AUDIENCE = 'defra-api'
    process.env.ENTRA_WELL_KNOWN_URL = entraWellKnownUrl
    delete process.env.ENTRA_TENANT_ID
    process.env.ENTRA_API_AUDIENCE = 'entra-api'
    process.env.ENTRA_API_SCOPE = 'api://entra-api/access_as_user'
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      new Response(JSON.stringify(discoveryResponses[url]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    try {
      await registerAuthentication(Hapi.server())

      expect(fetchSpy).toHaveBeenCalledWith(entraWellKnownUrl)
    } finally {
      fetchSpy.mockRestore()
      for (const [name, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[name]
        } else {
          process.env[name] = value
        }
      }
    }
  })

  test('keeps client and non-draft submission data unavailable without policy', async () => {
    const server = await createServer({ docClient: { send: jest.fn() } })

    try {
      const clients = await server.inject({ method: 'GET', url: '/GetClients' })
      const submissions = await server.inject({
        method: 'GET',
        url: '/submissions?status=submitted'
      })

      expect(clients.statusCode).toBe(503)
      expect(clients.result).toEqual({ error: 'Data access policy is not configured' })
      expect(submissions.statusCode).toBe(503)
      expect(submissions.result).toEqual({ error: 'Data access policy is not configured' })
    } finally {
      await server.stop()
    }
  })
})
