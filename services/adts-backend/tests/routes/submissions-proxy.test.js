import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const jsonResponse = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})

const limsSubmission = {
  draftSubmissionId: 'DRAFT-1',
  submissionId: 'SUB-1',
  status: 'Submitted',
  clientName: 'Acme Farm',
  clientFarm: 'Home Farm',
  clinician: 'Dr Vet',
  submittedDate: '2026-10-20T00:00:00.000Z',
  products: [{ productId: 'P1', name: 'Test A' }]
}

const localDraft = {
  submissionId: 'draft-001',
  status: 'Draft',
  userId: 'user-456',
  submittedAt: '2026-10-21T00:00:00.000Z',
  client: 'Acme Farm'
}

describe('Submissions service proxy routes', () => {
  let server
  const docClient = { send: jest.fn() }

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.NODE_ENV = 'development'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    process.env.LIMS_PVS_ID = 'PVS001'
    server = await createServer({ docClient, authorizeDataAccess: () => true })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    docClient.send.mockReset()
  })

  test('forwards GET /v1/products to the submissions service', async () => {
    const payload = [{ id: 'result-1' }]
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({ method: 'GET', url: '/v1/products?filter=mastitis&species=CATTLE' })

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3100/v1/products?filter=mastitis&species=CATTLE')
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(payload)
  })

  test('searches LIMS through the v1 submissions route and maps the results', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      limsSubmission,
      { ...limsSubmission, submissionId: 'SUB-2', clientName: 'Other Client', status: 'Cancelled' }
    ]))

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?client=Acme&status=submitted&submitted-date=1_year'
    })

    const limsUrl = new URL(globalThis.fetch.mock.calls[0][0])
    expect(limsUrl.origin + limsUrl.pathname).toBe('http://localhost:3100/v1/submissions')
    expect(limsUrl.searchParams.get('pvsId')).toBe('PVS001')
    expect(limsUrl.searchParams.get('submittedDateBegin')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(response.statusCode).toBe(200)
    expect(response.result.totalCount).toBe(1)
    expect(response.result.results[0]).toMatchObject({
      id: 'SUB-1',
      statuses: ['Submitted'],
      client: 'Acme Farm',
      clientFarm: 'Home Farm',
      clinician: 'Dr Vet',
      orderSubmitted: '20/Oct/2026',
      hasTests: true,
      tests: [expect.objectContaining({ name: 'Test A' })]
    })
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('returns only matching submission references for the requested client and farm', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      { submissionId: 'SUB-1', clientName: 'Acme Farm', clientFarm: 'North Field' },
      { submissionId: 'SUB-2', clientName: 'Acme Farm', clientFarm: 'South Field' },
      { submissionId: 'SUB-3', clientName: 'Beta Farm', clientFarm: 'North Field' },
      { submissionId: '', draftSubmissionId: 'DRAFT-1', clientName: 'Acme Farm', clientFarm: 'North Field' },
      { submissionId: 'SUB-1', clientName: 'Acme Farm', clientFarm: 'North Field' }
    ]))

    const response = await server.inject({
      method: 'GET',
      url: '/submission-references?clientId=C-456&clientName=Acme%20Farm&clientFarm=North%20Field'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(['SUB-1'])
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3100/v1/submissions?pvsId=PVS001&clientId=C-456'
    )
  })

  test('requires a client filter when retrieving submission references', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    const response = await server.inject({ method: 'GET', url: '/submission-references' })

    expect(response.statusCode).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('returns a gateway error when submission references cannot be retrieved', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'GET',
      url: '/submission-references?clientId=C-456'
    })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve submission references' })
  })

  test('combines local drafts with LIMS submissions when showing all', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([limsSubmission]))
    docClient.send.mockResolvedValue({ Items: [localDraft] })

    const response = await server.inject({
      method: 'GET',
      url: '/submissions',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result.results.map(({ id }) => id)).toEqual(['draft-001', 'SUB-1'])
    expect(response.result.totalCount).toBe(2)
  })

  test('returns LIMS submissions without local drafts when no draft owner is configured', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([limsSubmission]))

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(200)
    expect(response.result.results.map(({ id }) => id)).toEqual(['SUB-1'])
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('returns a gateway error when the submissions service search fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve submissions' })
  })

  test('retrieves only local drafts when filtering by Draft status without calling LIMS', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    docClient.send.mockResolvedValue({
      Items: [{
        submissionId: 'draft-001',
        status: 'Draft',
        userId: 'user-456',
        submittedAt: '2026-10-20T00:00:00.000Z',
        client: 'Acme Farm'
      }]
    })

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?status=draft',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(response.statusCode).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(response.result.totalCount).toBe(1)
    expect(response.result.results[0]).toMatchObject({
      id: 'draft-001',
      statuses: ['Draft'],
      client: 'Acme Farm'
    })
  })

  test('returns a gateway error when a Draft search fails in DynamoDB', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))
    docClient.send.mockRejectedValue(new Error('DynamoDB unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?status=draft',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve submissions' })
    expect(console.error).toHaveBeenCalledWith('Error retrieving submissions:', 'DynamoDB unavailable')
  })

  test('loads only the requested draft for the configured local owner', async () => {
    const draft = {
      submissionId: 'draft-001',
      status: 'Draft',
      userId: 'user-456',
      revision: 2,
      lastSavedPage: 'submission-02-species',
      formData: { animalDetails: { species: 'Sheep' } }
    }
    docClient.send.mockResolvedValue({ Item: draft })

    const response = await server.inject({
      method: 'GET',
      url: '/drafts/draft-001',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(docClient.send.mock.calls[0][0].input).toEqual({
      TableName: 'adts-submissions',
      Key: { PK: 'DRAFT#draft-001' }
    })
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      draftId: 'draft-001',
      status: 'Draft',
      revision: 2,
      lastSavedPage: 'submission-02-species',
      formData: draft.formData
    })
  })

  test('does not reveal a draft owned by another user', async () => {
    docClient.send.mockResolvedValue({
      Item: { submissionId: 'draft-001', status: 'Draft', userId: 'user-789' }
    })

    const response = await server.inject({
      method: 'GET',
      url: '/drafts/draft-001',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(response.statusCode).toBe(404)
    expect(response.result).toEqual({ error: 'Draft not found' })
  })

  test('disables local draft access outside development', async () => {
    process.env.NODE_ENV = 'production'

    const response = await server.inject({ method: 'GET', url: '/drafts/draft-001' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ error: 'Local draft owner is not configured' })
    process.env.NODE_ENV = 'development'
  })

  test('requires a local draft owner for Draft searches', async () => {
    const response = await server.inject({ method: 'GET', url: '/submissions?status=draft' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ error: 'Local draft owner is not configured' })
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('returns a gateway error when loading a draft fails in DynamoDB', async () => {
    docClient.send.mockRejectedValue(new Error('DynamoDB unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'GET',
      url: '/drafts/draft-001',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve draft' })
  })

  test('requires a local draft owner header in development', async () => {
    const response = await server.inject({ method: 'GET', url: '/drafts/draft-001' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ error: 'Local draft owner is not configured' })
  })

  test('returns a gateway error when the submissions service cannot be reached', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/v1/products?filter=x' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to reach submissions service' })
    expect(console.error).toHaveBeenCalledWith('Error contacting submissions service:', 'Connection refused')
  })

  test('returns a gateway error when the submissions service returns invalid JSON', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not JSON', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/v1/products?filter=x' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to reach submissions service' })
    expect(console.error).toHaveBeenCalledWith(
      'Error contacting submissions service:',
      expect.any(String)
    )
  })
})
