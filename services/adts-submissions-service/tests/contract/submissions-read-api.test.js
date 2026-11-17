import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

const createTestConfig = () => loadConfig({
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

describe('submission read API', () => {
  let server
  let limsClient

  beforeAll(async () => {
    limsClient = { request: jest.fn() }
    server = await createServer({ config: createTestConfig(), limsClient })
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

  test('searches submission IDs and maps pvsId to the observed lowercase pvsid', async () => {
    const ids = ['SUB-123', 'SUB-124']
    limsClient.request.mockResolvedValue(jsonResponse(ids))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submission-identifiers?pvsId=PVS001&filter=SUB-12'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(ids)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getSubmissionIdList', {
      method: 'GET',
      query: { pvsid: 'PVS001', filter: 'SUB-12' }
    })
  })

  test('maps supported submission search filters and preserves the response', async () => {
    const records = { results: [{ submissionId: 'SUB-123' }], totalCount: 1 }
    limsClient.request.mockResolvedValue(jsonResponse(records))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions?pvsId=PVS001&filter=SUB-12&clientId=C-456&status=Submitted&clinician=Example%20Vet&submittedDateBegin=2026-10-01&submittedDateEnd=2026-10-30'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(records)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getSubmissions', {
      method: 'GET',
      query: {
        pvsid: 'PVS001',
        filter: 'SUB-12',
        clientId: 'C-456',
        status: 'Submitted',
        clinician: 'Example Vet',
        submittedDateBegin: '2026-10-01',
        submittedDateEnd: '2026-10-30'
      }
    })
  })

  test('rejects invalid search dates and missing PVS scope before contacting LIMS', async () => {
    const missingPvs = await server.inject({ method: 'GET', url: '/v1/submissions?filter=SUB-12' })
    const invalidDate = await server.inject({
      method: 'GET',
      url: '/v1/submissions?pvsId=PVS001&submittedDateBegin=not-a-date'
    })

    expect(missingPvs.statusCode).toBe(400)
    expect(invalidDate.statusCode).toBe(400)
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('retrieves an editable draft with the canonical draft ID', async () => {
    const draft = { draftSubmissionId: 'DRAFT-123', pvsId: 'PVS001' }
    limsClient.request.mockResolvedValue(jsonResponse(draft))

    const response = await server.inject({ method: 'GET', url: '/v1/drafts/DRAFT-123?pvsId=PVS001' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(draft)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getSubmission', {
      method: 'GET',
      query: { submissionId: 'DRAFT-123', pvsId: 'PVS001' }
    })
  })

  test('views a submitted record using the supplied draft-state flag', async () => {
    const submission = { submissionId: 'SUB-123', status: 'Submitted' }
    limsClient.request.mockResolvedValue(jsonResponse(submission))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/submissions/SUB-123?pvsId=PVS001&isDraft=false'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(submission)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/viewSubmission', {
      method: 'GET',
      query: { submissionId: 'SUB-123', pvsId: 'PVS001', isDraft: false }
    })
  })

  test('retrieves delivery addresses using the observed draftSubmissionId spelling', async () => {
    const addresses = [{ label: 'Sample address' }]
    limsClient.request.mockResolvedValue(jsonResponse(addresses))

    const response = await server.inject({
      method: 'GET',
      url: '/v1/drafts/DRAFT-123/delivery-addresses?pvsId=PVS001'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(addresses)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getDeliveryAddresses', {
      method: 'GET',
      query: { pvsId: 'PVS001', draftSubmissionId: 'DRAFT-123' }
    })
  })

  test('normalizes LIMS errors and unavailable responses for read operations', async () => {
    limsClient.request.mockResolvedValueOnce(jsonResponse({
      hasErrors: true,
      code: 'SUBMISSION_REJECTED',
      errorMessages: ['token=secret-value']
    }))
    limsClient.request.mockRejectedValueOnce(new Error('private connection detail'))

    const businessError = await server.inject({
      method: 'GET',
      url: '/v1/submission-identifiers?pvsId=PVS001'
    })
    const unavailable = await server.inject({
      method: 'GET',
      url: '/v1/submission-identifiers?pvsId=PVS001'
    })

    expect(businessError.statusCode).toBe(422)
    expect(businessError.result.upstreamMessages).toEqual(['[REDACTED]'])
    expect(JSON.stringify(businessError.result)).not.toContain('secret-value')
    expect(unavailable.statusCode).toBe(502)
    expect(JSON.stringify(unavailable.result)).not.toContain('private connection detail')
  })
})
