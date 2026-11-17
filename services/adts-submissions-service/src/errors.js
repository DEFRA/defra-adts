import { randomUUID } from 'node:crypto'

const statusByCategory = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  business_error: 422,
  upstream_http_error: 502,
  upstream_timeout: 504,
  upstream_transport_error: 502,
  dependency_unavailable: 503,
  outcome_unknown: 504
}

const isSafeUpstreamCode = (code) =>
  typeof code === 'string' &&
  /^[A-Z0-9][A-Z0-9._-]{0,63}$/i.test(code) &&
  !/(secret|token|password|credential|authorization)/i.test(code)

const safeBusinessMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .filter((message) => typeof message === 'string')
    .slice(0, 10)
    .map((message) => {
      const trimmed = message.trim().slice(0, 500)
      if (/(authorization|password|secret|token|credential|api[_ -]?key)\s*[:=]|\b(?:Bearer|Basic)\s+\S+/i.test(trimmed)) {
        return '[REDACTED]'
      }
      return trimmed
    })
    .filter(Boolean)
}

export const createServiceError = ({ category, message, correlationId, upstreamCode }) => {
  const statusCode = statusByCategory[category]
  if (!statusCode) {
    throw new TypeError(`Unsupported service error category: ${category}`)
  }

  const body = {
    category,
    message: typeof message === 'string' && message.length > 0 ? message : 'The request could not be completed.',
    correlationId: correlationId || randomUUID()
  }

  if (isSafeUpstreamCode(upstreamCode)) {
    body.upstreamCode = upstreamCode
  }

  return { statusCode, body }
}

export const normalizeLimsBusinessError = (payload, correlationId) => {
  if (payload?.hasErrors !== true) {
    return null
  }

  const result = createServiceError({
    category: 'business_error',
    message: 'LIMS rejected the operation.',
    correlationId,
    upstreamCode: payload.code
  })

  const messages = safeBusinessMessages(payload.errorMessages)
  if (messages.length > 0) {
    result.body.upstreamMessages = messages
  }

  return result
}

export const normalizeUpstreamStatus = (statusCode, correlationId, message) => {
  const category = statusCode === 503
    ? 'dependency_unavailable'
    : statusCode === 504
      ? 'upstream_timeout'
      : 'upstream_http_error'

  return createServiceError({ category, message, correlationId })
}

const sensitiveKey = /(authorization|password|secret|token|credential|body|payload)/i

export const redactSensitive = (value) => {
  if (Array.isArray(value)) {
    return value.map(redactSensitive)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : redactSensitive(entry)
    ]))
  }

  return value
}
