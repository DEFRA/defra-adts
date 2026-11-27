import { constants } from 'node:http2'
import { fetchFromBackend } from '../backend/auth.js'

export const PVS_ID_SESSION_KEY = 'pvsId'
const publicPaths = new Set(['/health', '/connection_health'])
const practiceDetailsError = 'Unable to retrieve your practice details'

const shouldSkipPvsIdLookup = (request) => {
  const pathname = request.url.pathname
  return (
    !request.route ||
    publicPaths.has(pathname) ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/auth/')
  )
}

const getSessionNeedingPvsId = (request, getAuthSession) => {
  const authSession = getAuthSession(request)
  const saved = request.yar.get(PVS_ID_SESSION_KEY)

  if (!authSession.isAuthenticated) {
    if (saved) {
      request.yar.clear(PVS_ID_SESSION_KEY)
    }
    return undefined
  }

  if (saved?.subject === authSession.subject && saved.pvsId) {
    return undefined
  }

  return authSession
}

const fetchPvsId = async (request) => {
  const response = await fetchFromBackend(
    `${process.env.BACKEND_SERVICE_URL}/GetPvsId`,
    request
  )

  if (response.status === constants.HTTP_STATUS_FORBIDDEN) {
    return { forbidden: true }
  }
  if (!response.ok) {
    throw new Error(`LIMS ID lookup failed with status: ${response.status}`)
  }

  const result = await response.json()
  if (!result || typeof result.pvsId !== 'string' || !result.pvsId.trim()) {
    throw new Error('LIMS ID lookup response did not contain a PVS ID')
  }

  return { pvsId: result.pvsId }
}

export const createPvsIdSessionHook = (getAuthSession) => async (request, h) => {
  if (shouldSkipPvsIdLookup(request)) {
    return h.continue
  }

  const authSession = getSessionNeedingPvsId(request, getAuthSession)
  if (!authSession) {
    return h.continue
  }

  let lookup
  try {
    lookup = await fetchPvsId(request)
  } catch (error) {
    console.error('Error retrieving LIMS ID for authenticated user:', error.message)
    return h.response({ error: practiceDetailsError })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
      .takeover()
  }

  if (lookup.forbidden) {
    return h.response({ error: 'Your account is not associated with a LIMS practice' })
      .code(constants.HTTP_STATUS_FORBIDDEN)
      .takeover()
  }

  request.yar.set(PVS_ID_SESSION_KEY, {
    subject: authSession.subject,
    pvsId: lookup.pvsId
  })

  return h.continue
}

export const clearPvsIdSessionAfterSignOut = (getAuthSession) => (request, h) => {
  if (request.url.pathname !== '/auth/sign-out' || getAuthSession(request).isAuthenticated) {
    return h.continue
  }

  if (request.yar.get(PVS_ID_SESSION_KEY)) {
    request.yar.clear(PVS_ID_SESSION_KEY)
  }

  return h.continue
}
