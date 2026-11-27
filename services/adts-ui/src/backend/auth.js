export const getBackendHeaders = (request) => {
  const session = request.server.app.getAuthSession(request)

  if (!session.token && request.server.app.authMode === 'live') {
    throw new Error('Authenticated access token is missing')
  }

  return session.token ? { Authorization: `Bearer ${session.token}` } : {}
}

export const fetchFromBackend = (url, request, additionalHeaders = {}) => {
  const headers = { ...getBackendHeaders(request), ...additionalHeaders }
  return Object.keys(headers).length
    ? fetch(url, { headers })
    : fetch(url)
}
