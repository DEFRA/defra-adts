import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Submissions service proxy routes', () => {
  let server
  const docClient = { send: jest.fn() }

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.NODE_ENV = 'development'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer({ docClient, authorizeDataAccess: () => true })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    docClient.send.mockReset()
  })

  test.each([
    ['/v1/products?filter=mastitis&species=CATTLE', 'http://localhost:3100/v1/products?filter=mastitis&species=CATTLE'],
    ['/submissions?client=Acme+Farm&status=submitted', 'http://localhost:3100/submissions?client=Acme+Farm&status=submitted']
  ])('forwards GET %s to the submissions service', async (requestUrl, submissionsUrl) => {
    const payload = [{ id: 'result-1' }]
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({ method: 'GET', url: requestUrl })

    expect(globalThis.fetch).toHaveBeenCalledWith(submissionsUrl)
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(payload)
  })

  test('preserves an error status returned by the submissions service', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ error: 'Unavailable' })
  })

  test('uses DynamoDB for Draft searches', async () => {
    jest.spyOn(globalThis, 'fetch')
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

    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(response.statusCode).toBe(200)
    expect(response.result.results).toHaveLength(1)
    expect(response.result.results[0]).toMatchObject({
      id: 'draft-001',
      statuses: ['Draft'],
      client: 'Acme Farm',
      orderSubmitted: '20/Oct/2026'
    })
  })

  test('returns a gateway error when a Draft search fails in DynamoDB', async () => {
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

    const response = await server.inject({ method: 'GET', url: '/submissions' })

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

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to reach submissions service' })
    expect(console.error).toHaveBeenCalledWith(
      'Error contacting submissions service:',
      expect.any(String)
    )
  })
})
