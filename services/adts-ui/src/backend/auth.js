export const getBackendHeaders = (request) => {
  const session = request.server.app.getAuthSession(request)
  const headers = {}

  if (session.token) {
    headers.Authorization = `Bearer ${session.token}`
  } else if (request.server.app.authMode === 'live') {
    throw new Error('Authenticated access token is missing')
  }

  return headers
}

export const fetchFromBackend = (url, request, additionalHeaders = {}) => {
  const headers = { ...getBackendHeaders(request), ...additionalHeaders }
  return Object.keys(headers).length
    ? fetch(url, { headers })
    : fetch(url)
}
