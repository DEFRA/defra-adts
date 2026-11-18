import { describe, expect, jest, test } from '@jest/globals'
import { randomUUID } from 'node:crypto'
import { logDiagnosticEvent } from '../../src/observability.js'

describe('diagnostic logging', () => {
  test('logs only allowlisted operational fields and excludes sensitive payloads', () => {
    const logger = { warn: jest.fn() }
    const correlationId = randomUUID()

    logDiagnosticEvent(logger, {
      level: 'warn',
      event: 'lims.unavailable',
      correlationId,
      statusCode: 503,
      errorCategory: 'dependency_unavailable',
      authorization: 'Bearer test-secret',
      password: 'test-password',
      requestBody: { clientName: 'Sensitive Client' },
      upstreamBody: { errorMessages: ['Sensitive LIMS response'] }
    })

    expect(logger.warn).toHaveBeenCalledTimes(1)
    const record = JSON.parse(logger.warn.mock.calls[0][0])
    expect(record).toMatchObject({
      level: 'warn',
      event: 'lims.unavailable',
      correlationId,
      statusCode: 503,
      errorCategory: 'dependency_unavailable'
    })
    expect(JSON.stringify(record)).not.toMatch(/test-secret|test-password|Sensitive/)
  })

  test('omits invalid correlation IDs and uses a safe fallback event', () => {
    const logger = { info: jest.fn() }

    logDiagnosticEvent(logger, {
      event: 'Bearer secret-token',
      correlationId: 'secret-token',
      statusCode: 200
    })

    const record = JSON.parse(logger.info.mock.calls[0][0])
    expect(record.event).toBe('service.operation')
    expect(record).not.toHaveProperty('correlationId')
  })
})
