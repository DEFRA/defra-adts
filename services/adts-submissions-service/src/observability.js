const levels = new Set(['debug', 'info', 'warn', 'error'])
const events = new Set(['service.operation', 'lims.unavailable', 'request.failed'])
const errorCategories = new Set([
  'validation_error',
  'unauthenticated',
  'forbidden',
  'not_found',
  'business_error',
  'upstream_http_error',
  'upstream_timeout',
  'upstream_transport_error',
  'dependency_unavailable',
  'outcome_unknown'
])
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export const logDiagnosticEvent = (logger, {
  level = 'info',
  event,
  correlationId,
  statusCode,
  errorCategory
} = {}) => {
  const safeLevel = levels.has(level) ? level : 'info'
  const write = logger?.[safeLevel]
  if (typeof write !== 'function') {
    return
  }

  const record = {
    timestamp: new Date().toISOString(),
    level: safeLevel,
    event: events.has(event) ? event : 'service.operation'
  }

  if (typeof correlationId === 'string' && uuidPattern.test(correlationId)) {
    record.correlationId = correlationId
  }

  if (Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) {
    record.statusCode = statusCode
  }

  if (errorCategories.has(errorCategory)) {
    record.errorCategory = errorCategory
  }

  write.call(logger, JSON.stringify(record))
}
