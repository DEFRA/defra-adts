import Boom from '@hapi/boom'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'

const loadProvider = async ({ name, discoveryUrl, audience, requiredScope }) => {
  if (new URL(discoveryUrl).protocol !== 'https:') {
    throw new Error(`${name} OIDC discovery URL must use HTTPS`)
  }

  const response = await fetch(discoveryUrl)
  if (!response.ok) {
    throw new Error(`${name} OIDC discovery failed with status ${response.status}`)
  }

  const metadata = await response.json()
  if (!metadata.issuer || !metadata.jwks_uri) {
    throw new Error(`${name} OIDC discovery response is missing issuer or jwks_uri`)
  }
  if (
    new URL(metadata.issuer).protocol !== 'https:' ||
    new URL(metadata.jwks_uri).protocol !== 'https:'
  ) {
    throw new Error(`${name} OIDC issuer and JWKS URL must use HTTPS`)
  }

  return {
    name,
    issuer: metadata.issuer,
    audience,
    requiredScope,
    jwks: createRemoteJWKSet(new URL(metadata.jwks_uri))
  }
}

const loadProviders = async () => {
  const requiredVariables = [
    'DEFRA_ID_WELL_KNOWN_URL',
    'DEFRA_ID_API_AUDIENCE',
    'ENTRA_WELL_KNOWN_URL',
    'ENTRA_API_AUDIENCE',
    'ENTRA_API_SCOPE'
  ]
  const missing = requiredVariables.filter((name) => !process.env[name])
  if (missing.length) {
    throw new Error(`Missing live token validation configuration: ${missing.join(', ')}`)
  }

  return Promise.all([
    loadProvider({
      name: 'Defra ID',
      discoveryUrl: process.env.DEFRA_ID_WELL_KNOWN_URL,
      audience: process.env.DEFRA_ID_API_AUDIENCE
    }),
    loadProvider({
      name: 'Entra ID',
      discoveryUrl: process.env.ENTRA_WELL_KNOWN_URL,
      audience: process.env.ENTRA_API_AUDIENCE,
      requiredScope: process.env.ENTRA_API_SCOPE.split('/').at(-1).trim()
    })
  ])
}

export const verifyAccessToken = async (token, providers) => {
  const unverified = decodeJwt(token)
  const provider = providers.find(({ issuer }) => issuer === unverified.iss)
  if (!provider) {
    throw new Error('Token issuer is not trusted')
  }

  const { payload } = await jwtVerify(token, provider.jwks, {
    issuer: provider.issuer,
    audience: provider.audience
  })

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Token subject is missing')
  }

  if (
    provider.requiredScope &&
    !String(payload.scp || '').split(/\s+/).includes(provider.requiredScope)
  ) {
    throw new Error('Token does not contain the required API scope')
  }

  return {
    issuer: provider.issuer,
    subject: payload.sub,
    ownerId: `${provider.issuer}|${payload.sub}`,
    roles: Array.isArray(payload.roles) ? payload.roles : []
  }
}

export const registerAuthentication = async (server) => {
  const mode = process.env.AUTH_MODE || (process.env.NODE_ENV === 'production' ? '' : 'mock')
  if (mode !== 'mock' && mode !== 'live') {
    throw new Error('AUTH_MODE must be set to "mock" or "live"')
  }
  if (process.env.NODE_ENV === 'production' && mode !== 'live') {
    throw new Error('AUTH_MODE must be "live" in production')
  }

  const providers = mode === 'live' ? await loadProviders() : []
  const isNonProduction = process.env.NODE_ENV !== 'production'

  server.auth.scheme('oidc-bearer', () => ({
    async authenticate (request, h) {
      if (mode === 'mock') {
        const ownerId = isNonProduction
          ? request.headers['x-local-draft-owner-id'] || process.env.LOCAL_DRAFT_OWNER_ID || ''
          : ''
        return h.authenticated({
          credentials: {
            issuer: 'local-mock',
            subject: ownerId || 'mock-user',
            ownerId,
            roles: []
          }
        })
      }

      const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')
      if (!match) {
        throw Boom.unauthorized('Bearer access token is required')
      }

      try {
        return h.authenticated({
          credentials: await verifyAccessToken(match[1], providers)
        })
      } catch {
        throw Boom.unauthorized('Access token is invalid')
      }
    }
  }))
  server.auth.strategy('oidc-bearer', 'oidc-bearer')
  server.auth.default('oidc-bearer')
}
