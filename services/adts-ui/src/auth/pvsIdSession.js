import { constants } from 'node:http2'
import { fetchFromBackend } from '../backend/auth.js'

export const PVS_ID_SESSION_KEY = 'pvsId'
const publicPaths = new Set(['/health', '/connection_health'])

export const createPvsIdSessionHook = (getAuthSession) => async (request, h) => {
  const pathname = request.url.pathname
  if (
    !request.route ||
    publicPaths.has(pathname) ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/auth/')
  ) {
    return h.continue
  }

  const authSession = getAuthSession(request)
  const saved = request.yar.get(PVS_ID_SESSION_KEY)

  if (!authSession.isAuthenticated) {
    if (saved) {
      request.yar.clear(PVS_ID_SESSION_KEY)
    }
    return h.continue
  }

  if (saved?.subject === authSession.subject && saved.pvsId) {
    return h.continue
  }

  let response
  try {
    response = await fetchFromBackend(
      `${process.env.BACKEND_SERVICE_URL}/GetPvsId`,
      request
    )
  } catch (error) {
    console.error('Error retrieving LIMS ID for authenticated user:', error.message)
    return h.response({ error: 'Unable to retrieve your practice details' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
      .takeover()
  }

  if (response.status === 403) {
    return h.response({ error: 'Your account is not associated with a LIMS practice' })
      .code(constants.HTTP_STATUS_FORBIDDEN)
      .takeover()
  }

  if (!response.ok) {
    console.error('LIMS ID lookup failed with status:', response.status)
    return h.response({ error: 'Unable to retrieve your practice details' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
      .takeover()
  }

  let result
  try {
    result = await response.json()
  } catch (error) {
    console.error('Invalid LIMS ID lookup response:', error.message)
    return h.response({ error: 'Unable to retrieve your practice details' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
      .takeover()
  }

  if (!result || typeof result.pvsId !== 'string' || !result.pvsId.trim()) {
    console.error('LIMS ID lookup response did not contain a PVS ID')
    return h.response({ error: 'Unable to retrieve your practice details' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
      .takeover()
  }

  request.yar.set(PVS_ID_SESSION_KEY, {
    subject: authSession.subject,
    pvsId: result.pvsId
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
