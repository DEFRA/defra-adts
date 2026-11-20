const providers = {
  'defra-id': {
    packageName: '@defra/hapi-oidc-auth-defra-id',
    signInPath: '/auth/defra-id/sign-in',
    startPath: '/auth/defra-id/start',
    configuration: (mode) => ({
      defraId: {
        mode,
        wellKnownUrl: process.env.DEFRA_ID_WELL_KNOWN_URL,
        clientId: process.env.DEFRA_ID_CLIENT_ID,
        clientSecret: process.env.DEFRA_ID_CLIENT_SECRET,
        serviceId: process.env.DEFRA_ID_SERVICE_ID,
        policy: process.env.DEFRA_ID_POLICY,
        publicBaseUrl: process.env.DEFRA_ID_PUBLIC_BASE_URL
      }
    }),
    requiredLiveVariables: [
      'DEFRA_ID_WELL_KNOWN_URL',
      'DEFRA_ID_CLIENT_ID',
      'DEFRA_ID_CLIENT_SECRET',
      'DEFRA_ID_SERVICE_ID',
      'DEFRA_ID_POLICY',
      'DEFRA_ID_PUBLIC_BASE_URL'
    ]
  },
  entra: {
    packageName: '@defra/hapi-oidc-auth',
    signInPath: '/auth/entra/sign-in',
    startPath: '/auth/entra/start',
    configuration: (mode) => ({
      entra: {
        mode,
        tenantId: process.env.ENTRA_TENANT_ID,
        clientId: process.env.ENTRA_CLIENT_ID,
        clientSecret: process.env.ENTRA_CLIENT_SECRET,
        publicBaseUrl: process.env.ENTRA_PUBLIC_BASE_URL,
        additionalScopes: process.env.ENTRA_API_SCOPE
      }
    }),
    requiredLiveVariables: [
      'ENTRA_TENANT_ID',
      'ENTRA_CLIENT_ID',
      'ENTRA_CLIENT_SECRET',
      'ENTRA_PUBLIC_BASE_URL',
      'ENTRA_API_SCOPE'
    ]
  }
}

const publicPaths = new Set(['/health', '/connection_health'])

// Local-only exception so a local OIDC stub can be used over plain HTTP.
const isLocalInsecureAllowed = (provider) => {
  if (process.env.AUTH_ALLOW_INSECURE_LOCAL !== 'true') {
    return false
  }
  const baseUrlName = provider.requiredLiveVariables.find((name) => name.endsWith('_PUBLIC_BASE_URL'))
  try {
    return new URL(process.env[baseUrlName]).hostname === 'localhost'
  } catch {
    return false
  }
}

const getRuntimeConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  const providerName = process.env.AUTH_PROVIDER || (isProduction ? '' : 'defra-id')
  const mode = process.env.AUTH_MODE || (isProduction ? '' : 'mock')
  const provider = providers[providerName]

  if (!provider) {
    throw new Error('AUTH_PROVIDER must be set to "defra-id" or "entra"')
  }

  if (mode !== 'mock' && mode !== 'live') {
    throw new Error('AUTH_MODE must be set to "mock" or "live"')
  }

  if (isProduction && mode !== 'live') {
    throw new Error('AUTH_MODE must be "live" in production')
  }

  if (mode === 'live' && process.env.NODE_ENV === 'development' && !isLocalInsecureAllowed(provider)) {
    throw new Error(
      'Live authentication requires secure cookies; use mock mode in development, ' +
        'or set AUTH_ALLOW_INSECURE_LOCAL=true with a localhost public base URL'
    )
  }

  if (mode === 'live') {
    const missing = provider.requiredLiveVariables.filter(
      (name) => !process.env[name]
    )
    if (missing.length) {
      throw new Error(`Missing live authentication configuration: ${missing.join(', ')}`)
    }
  }

  return { provider, mode }
}

export async function registerAuthentication (server) {
  const { provider, mode } = getRuntimeConfig()
  const plugin = await import(provider.packageName)
  const options = {
    ...provider.configuration(mode),
    redirects: {
      postLogin: '/',
      signOut: '/'
    }
  }

  await server.register({ plugin: plugin.hapiOidcAuth, options })

  server.ext('onPreAuth', (request, h) => {
    const pathname = request.url.pathname
    if (mode === 'mock' && process.env.NODE_ENV === 'test') {
      return h.continue
    }
    if (
      publicPaths.has(pathname) ||
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/auth/')
    ) {
      return h.continue
    }

    // Go straight to the identity provider rather than the intermediate sign-in page.
    // requireAuth has already stored the originally requested path as returnTo.
    const result = plugin.requireAuth(request, h)
    return result === h.continue ? result : h.redirect(provider.startPath).takeover()
  })

  server.ext('onPreResponse', (request, h) => {
    const response = request.response
    if (response?.isBoom) {
      const intended = response.statusCode
      if (Number.isInteger(intended) && intended >= 400 && intended < 600) {
        return h
          .response(response.message || 'Error')
          .code(intended)
          .takeover()
      }
    }
    return h.continue
  })

  return {
    mode,
    viewsPath: plugin.viewsPath,
    buildAccount: plugin.buildAccount,
    getAuthSession: plugin.getAuthSession,
    signInPath: provider.signInPath
  }
}
