const normalizePath = (value) => value.replace(/^\/+|\/+$/g, '')

const validateRelativePath = (path) => {
  if (typeof path !== 'string' || path.length === 0 || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new TypeError('LIMS request path must be relative to the configured origin')
  }

  const segments = path.split('/').map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      throw new TypeError('LIMS request path contains invalid encoding')
    }
  })

  if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'))) {
    throw new TypeError('LIMS request path must remain within the configured origin')
  }
}

export const createLimsClient = ({
  baseUrl,
  prefix = '',
  username,
  password,
  timeoutMs,
  allowHttp = false,
  fetchImpl = globalThis.fetch
}) => {
  const base = new URL(baseUrl)

  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new TypeError('LIMS base URL must be an HTTP(S) origin without credentials, query, or fragment')
  }

  if (base.protocol === 'http:' && allowHttp !== true) {
    throw new Error('LIMS HTTP requires the explicit temporary HTTP exception')
  }

  if (typeof username !== 'string' || username.length === 0 || typeof password !== 'string' || password.length === 0) {
    throw new TypeError('LIMS credentials are required')
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('LIMS timeout must be a positive integer in milliseconds')
  }

  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required')
  }

  const normalizedPrefix = normalizePath(prefix)
  if (normalizedPrefix) {
    validateRelativePath(normalizedPrefix)
  }
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

  const request = async (path, { method = 'GET', query, body, headers = {} } = {}) => {
    validateRelativePath(path)

    const normalizedPath = normalizePath(path)
    const requestPath = [normalizedPrefix, normalizedPath].filter(Boolean).join('/')
    const url = new URL(requestPath, `${base.origin}/`)

    if (url.origin !== base.origin) {
      throw new TypeError('LIMS request must remain within the configured origin')
    }

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const requestHeaders = {
      accept: 'application/json',
      ...headers,
      authorization
    }

    let requestBody
    if (body !== undefined) {
      requestHeaders['content-type'] ??= 'application/json'
      requestBody = typeof body === 'string' ? body : JSON.stringify(body)
    }

    return fetchImpl(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs)
    })
  }

  return { request }
}
