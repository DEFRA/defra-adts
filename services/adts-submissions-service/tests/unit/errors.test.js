import { describe, expect, test } from '@jest/globals'
import { createServiceError, normalizeLimsBusinessError, redactSensitive } from '../../src/errors.js'

describe('service errors', () => {
  test.each([
    ['validation_error', 400],
    ['unauthenticated', 401],
    ['forbidden', 403],
    ['not_found', 404],
    ['business_error', 422],
    ['upstream_http_error', 502],
    ['upstream_timeout', 504],
    ['upstream_transport_error', 502],
    ['dependency_unavailable', 503],
    ['outcome_unknown', 504]
  ])('maps %s to HTTP %i with a stable error envelope', (category, statusCode) => {
    const result = createServiceError({
      category,
      message: 'A safe public message.',
      correlationId: 'request-123'
    })

    expect(result.statusCode).toBe(statusCode)
    expect(result.body).toEqual({
      category,
      message: 'A safe public message.',
      correlationId: 'request-123'
    })
  })

  test('generates a correlation ID when one is not supplied', () => {
    const result = createServiceError({
      category: 'upstream_transport_error',
      message: 'Unable to contact LIMS.'
    })

    expect(result.body.correlationId).toMatch(/^[\da-f-]{36}$/i)
  })

  test('preserves a safe LIMS business code but not raw business messages', () => {
    const result = normalizeLimsBusinessError({
      hasErrors: true,
      code: 'CANCELLATION_REJECTED',
      errorMessages: ['Cancellation cannot proceed for this submission.', 'token=secret-value']
    }, 'request-456')

    expect(result.statusCode).toBe(422)
    expect(result.body).toMatchObject({
      category: 'business_error',
      message: 'LIMS rejected the operation.',
      correlationId: 'request-456',
      upstreamCode: 'CANCELLATION_REJECTED',
      upstreamMessages: ['Cancellation cannot proceed for this submission.', '[REDACTED]']
    })
    expect(JSON.stringify(result.body)).not.toContain('secret-value')
  })

  test('does not create a business error when LIMS reports no errors', () => {
    expect(normalizeLimsBusinessError({ hasErrors: false }, 'request-789')).toBeNull()
  })

  test('redacts secret-bearing keys recursively before diagnostic logging', () => {
    const safe = redactSensitive({
      requestId: 'request-1',
      authorization: 'Bearer secret-token',
      nested: { password: 'secret-password', status: 'failed' }
    })

    expect(safe).toEqual({
      requestId: 'request-1',
      authorization: '[REDACTED]',
      nested: { password: '[REDACTED]', status: 'failed' }
    })
  })
})
