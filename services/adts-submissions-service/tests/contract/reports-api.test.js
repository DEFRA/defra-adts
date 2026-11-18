import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

const config = loadConfig({
  LIMS_BASE_URL: 'https://lims.example.test',
  LIMS_PREFIX: 'api',
  LIMS_TIMEOUT_MS: '1000'
})

describe('submission release summaries and reports', () => {
  let server
  let limsClient

  beforeAll(async () => {
    limsClient = { request: jest.fn() }
    server = await createServer({ config, limsClient })
  })

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    limsClient.request.mockReset()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('requests release summary using the observed LIMS operation and preserves JSON', async () => {
    const summary = { Sections: [], SampleComments: [], VioComment: '', WorkInProgress: [], Charges: [], samples: [] }
    limsClient.request.mockResolvedValue(new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/release-summary?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual(summary)
    expect(response.headers['content-type']).toContain('application/json')
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getLatestReleasedResults', {
      method: 'GET',
      query: { pvsId: 'PVS001', submissionId: 'SUB-123' }
    })
  })

  test('decodes LastReportString and serves the PDF inline', async () => {
    const reportBytes = Buffer.from('%PDF-1.4 synthetic report')
    limsClient.request.mockResolvedValue(new Response(JSON.stringify({ LastReportString: reportBytes.toString('base64') }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/report?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('application/pdf')
    expect(response.headers['content-disposition']).toBeUndefined()
    expect(Buffer.from(response.rawPayload)).toEqual(reportBytes)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getReleaseSummaryAndReport', {
      method: 'GET',
      query: { pvsId: 'PVS001', submissionId: 'SUB-123' }
    })
  })

  test('does not present an unavailable report as a successful empty result', async () => {
    limsClient.request.mockResolvedValue(new Response(JSON.stringify({ LastReportString: '' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/report?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_http_error')
    expect(JSON.stringify(response.result)).not.toContain('LastReportString')
  })

  test('rejects invalid base64 report content', async () => {
    limsClient.request.mockResolvedValue(new Response(JSON.stringify({ LastReportString: 'not base64' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/report?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_http_error')
  })

  test('normalizes JSON business errors returned by the summary/report operation', async () => {
    limsClient.request.mockResolvedValue(new Response(JSON.stringify({
      hasErrors: true,
      code: 'REPORT_NOT_AVAILABLE',
      errorMessages: ['Report not available for this submission.']
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/report?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(422)
    expect(response.result.category).toBe('business_error')
    expect(response.result.upstreamMessages).toEqual(['Report not available for this submission.'])
  })

  test('rejects malformed JSON summary content rather than returning it as a valid report', async () => {
    limsClient.request.mockResolvedValue(new Response('not json', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/release-summary?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_http_error')
  })

  test('normalizes unavailable release-summary calls', async () => {
    limsClient.request.mockRejectedValue(new Error('private connection detail'))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123/release-summary?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_transport_error')
    expect(JSON.stringify(response.result)).not.toContain('private connection detail')
  })
})
