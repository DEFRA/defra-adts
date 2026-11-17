import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

const config = loadConfig({
  LIMS_BASE_URL: 'https://lims.example.test',
  LIMS_PREFIX: 'api',
  LIMS_USERNAME: 'service-user',
  LIMS_PASSWORD: 'test-password',
  LIMS_TIMEOUT_MS: '1000'
})

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
})

describe('draft confirmation and cancellation API', () => {
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

  test('confirms a draft and returns the LIMS submission ID', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({ submissionId: 'VI-26-000001' }))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/drafts/101/confirmation',
      payload: { pvsId: 'PVS001' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ submissionId: 'VI-26-000001' })
    expect(limsClient.request).toHaveBeenCalledWith('submissions/confirmDraftSubmission', {
      method: 'POST',
      body: { draftSubmissionId: '101', pvsId: 'PVS001' }
    })
  })

  test('reports confirmation as unknown when LIMS returns no submission ID', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({ status: 'accepted' }))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/drafts/101/confirmation',
      payload: { pvsId: 'PVS001' }
    })

    expect(response.statusCode).toBe(504)
    expect(response.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(1)
  })

  test('normalizes confirmation business rejection and upstream HTTP errors', async () => {
    limsClient.request.mockResolvedValueOnce(jsonResponse({ hasErrors: true, errorMessages: ['token=secret-value'] }))
    limsClient.request.mockResolvedValueOnce(jsonResponse({ message: 'private upstream detail' }, 500))

    const businessError = await server.inject({
      method: 'POST',
      url: '/v1/drafts/101/confirmation',
      payload: { pvsId: 'PVS001' }
    })
    const upstreamError = await server.inject({
      method: 'POST',
      url: '/v1/drafts/101/confirmation',
      payload: { pvsId: 'PVS001' }
    })

    expect(businessError.statusCode).toBe(422)
    expect(businessError.result.category).toBe('business_error')
    expect(businessError.result.upstreamMessages).toEqual(['[REDACTED]'])
    expect(JSON.stringify(businessError.result)).not.toContain('secret-value')
    expect(upstreamError.statusCode).toBe(502)
    expect(upstreamError.result.category).toBe('upstream_http_error')
    expect(JSON.stringify(upstreamError.result)).not.toContain('private upstream detail')
  })

  test('does not retry confirmation after an ambiguous timeout', async () => {
    limsClient.request.mockRejectedValue(new DOMException('timeout', 'TimeoutError'))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/drafts/101/confirmation',
      payload: { pvsId: 'PVS001' }
    })

    expect(response.statusCode).toBe(504)
    expect(response.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(1)
  })

  test('requests cancellation using submissionDraftId and preserves success fields', async () => {
    const result = { hasErrors: false, errorMessages: [] }
    limsClient.request.mockResolvedValue(jsonResponse(result))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/cancellation-requests',
      payload: { pvsId: 'PVS001', draftId: '101', clinician: 'Test Vet' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(result)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/cancelSubmission', {
      method: 'POST',
      body: { pvsId: 'PVS001', submissionDraftId: '101', clinician: 'Test Vet' }
    })
  })

  test('reports LIMS cancellation business rejection even on HTTP success', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({
      hasErrors: true,
      errorMessages: ['Submission VI-26-000001 has already been received and cannot be cancelled.']
    }))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/cancellation-requests',
      payload: { pvsId: 'PVS001', submissionId: 'VI-26-000001', clinician: 'Test Vet' }
    })

    expect(response.statusCode).toBe(422)
    expect(response.result.category).toBe('business_error')
    expect(response.result.upstreamMessages).toEqual(['Submission VI-26-000001 has already been received and cannot be cancelled.'])
  })

  test('rejects cancellation requests with both target IDs before contacting LIMS', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/cancellation-requests',
      payload: { pvsId: 'PVS001', draftId: '101', submissionId: 'VI-26-000001', clinician: 'Test Vet' }
    })

    expect(response.statusCode).toBe(400)
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('returns an unknown outcome for malformed LIMS mutation responses', async () => {
    limsClient.request.mockResolvedValueOnce(new Response('not json', { status: 200 }))
    limsClient.request.mockResolvedValueOnce(jsonResponse({ hasErrors: false }))

    const confirmation = await server.inject({
      method: 'POST',
      url: '/v1/drafts/101/confirmation',
      payload: { pvsId: 'PVS001' }
    })
    const cancellation = await server.inject({
      method: 'POST',
      url: '/v1/cancellation-requests',
      payload: { pvsId: 'PVS001', draftId: '101', clinician: 'Test Vet' }
    })

    expect(confirmation.statusCode).toBe(504)
    expect(confirmation.result.category).toBe('outcome_unknown')
    expect(cancellation.statusCode).toBe(504)
    expect(cancellation.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(2)
  })

  test('maps an upstream cancellation dependency failure', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({ message: 'private outage' }, 503))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/cancellation-requests',
      payload: { pvsId: 'PVS001', draftId: '101', clinician: 'Test Vet' }
    })

    expect(response.statusCode).toBe(503)
    expect(response.result.category).toBe('dependency_unavailable')
    expect(JSON.stringify(response.result)).not.toContain('private outage')
  })

  test('does not retry cancellation after an ambiguous timeout', async () => {
    limsClient.request.mockRejectedValue(new DOMException('timeout', 'TimeoutError'))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/cancellation-requests',
      payload: { pvsId: 'PVS001', draftId: '101', clinician: 'Test Vet' }
    })

    expect(response.statusCode).toBe(504)
    expect(response.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(1)
  })
})
