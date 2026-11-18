import { randomUUID } from 'node:crypto'
import { constants } from 'node:http2'

const MAX_UPSTREAM_CODE_LENGTH = 64
const MAX_BUSINESS_MESSAGES = 10
const MAX_BUSINESS_MESSAGE_LENGTH = 500

const upstreamCodePattern = new RegExp(`^[A-Z0-9][A-Z0-9._-]{0,${MAX_UPSTREAM_CODE_LENGTH - 1}}$`, 'i')

const statusByCategory = {
  validation_error: constants.HTTP_STATUS_BAD_REQUEST,
  unauthenticated: constants.HTTP_STATUS_UNAUTHORIZED,
  forbidden: constants.HTTP_STATUS_FORBIDDEN,
  not_found: constants.HTTP_STATUS_NOT_FOUND,
  business_error: constants.HTTP_STATUS_UNPROCESSABLE_ENTITY,
  upstream_http_error: constants.HTTP_STATUS_BAD_GATEWAY,
  upstream_timeout: constants.HTTP_STATUS_GATEWAY_TIMEOUT,
  upstream_transport_error: constants.HTTP_STATUS_BAD_GATEWAY,
  dependency_unavailable: constants.HTTP_STATUS_SERVICE_UNAVAILABLE,
  outcome_unknown: constants.HTTP_STATUS_GATEWAY_TIMEOUT
}

const isSafeUpstreamCode = (code) =>
  typeof code === 'string' &&
  upstreamCodePattern.test(code) &&
  !/(secret|token|password|credential|authorization)/i.test(code)

const safeBusinessMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .filter((message) => typeof message === 'string')
    .slice(0, MAX_BUSINESS_MESSAGES)
    .map((message) => {
      const trimmed = message.trim().slice(0, MAX_BUSINESS_MESSAGE_LENGTH)
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

const upstreamCategoryByStatus = new Map([
  [constants.HTTP_STATUS_SERVICE_UNAVAILABLE, 'dependency_unavailable'],
  [constants.HTTP_STATUS_GATEWAY_TIMEOUT, 'upstream_timeout']
])

export const normalizeUpstreamStatus = (statusCode, correlationId, message) => {
  const category = upstreamCategoryByStatus.get(statusCode) ?? 'upstream_http_error'

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
