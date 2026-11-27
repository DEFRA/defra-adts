import Boom from '@hapi/boom'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'

const AUTH_STRATEGY = 'oidc-bearer'

const isLocalStubMode = () =>
  process.env.NODE_ENV === 'development' &&
  process.env.AUTH_ALLOW_INSECURE_LOCAL === 'true'

const isAllowedIdentityUrl = (value) => {
  const url = new URL(value)
  return url.protocol === 'https:' ||
    (isLocalStubMode() && url.protocol === 'http:' && url.hostname === 'localhost')
}

const parseBearerToken = (authorization) => {
  if (typeof authorization !== 'string') {
    return undefined
  }

  const header = authorization.trim()
  const separator = header.indexOf(' ')
  if (separator <= 0) {
    return undefined
  }

  const scheme = header.slice(0, separator)
  const token = header.slice(separator).trim()
  if (
    scheme.toLowerCase() !== 'bearer' ||
    !token ||
    token.includes(' ') ||
    token.includes('\t')
  ) {
    return undefined
  }

  return token
}

const loadProvider = async ({ name, discoveryUrl, audience, requiredScope }) => {
  if (!isAllowedIdentityUrl(discoveryUrl)) {
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
  if (!isAllowedIdentityUrl(metadata.issuer) || !isAllowedIdentityUrl(metadata.jwks_uri)) {
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
  const defraVariables = [
    'DEFRA_ID_WELL_KNOWN_URL',
    'DEFRA_ID_API_AUDIENCE'
  ]
  const entraVariables = [
    'ENTRA_WELL_KNOWN_URL',
    'ENTRA_API_AUDIENCE',
    'ENTRA_API_SCOPE'
  ]
  const requiredVariables = isLocalStubMode()
    ? defraVariables
    : [...defraVariables, ...entraVariables]
  const missing = requiredVariables.filter((name) => !process.env[name])
  if (missing.length) {
    throw new Error(`Missing live token validation configuration: ${missing.join(', ')}`)
  }

  const defraProvider = loadProvider({
    name: 'Defra ID',
    discoveryUrl: process.env.DEFRA_ID_WELL_KNOWN_URL,
    audience: process.env.DEFRA_ID_API_AUDIENCE
  })

  if (isLocalStubMode()) {
    return [await defraProvider]
  }

  return Promise.all([
    defraProvider,
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

  server.auth.scheme(AUTH_STRATEGY, () => ({
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

      const token = parseBearerToken(request.headers.authorization)
      if (!token) {
        throw Boom.unauthorized('Bearer access token is required')
      }

      try {
        return h.authenticated({
          credentials: await verifyAccessToken(token, providers)
        })
      } catch {
        throw Boom.unauthorized('Access token is invalid')
      }
    }
  }))
  server.auth.strategy(AUTH_STRATEGY, AUTH_STRATEGY)
  server.auth.default(AUTH_STRATEGY)
}
