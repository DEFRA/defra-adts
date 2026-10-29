import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Submissions service proxy routes', () => {
  let server
  const docClient = { send: jest.fn() }

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer({ docClient })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    docClient.send.mockReset()
  })

  test.each([
    ['/GetClients', 'http://localhost:3100/GetClients'],
    ['/GetCounties', 'http://localhost:3100/GetCounties'],
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
        submittedAt: '2026-10-20T00:00:00.000Z',
        client: 'Acme Farm'
      }]
    })

    const response = await server.inject({ method: 'GET', url: '/submissions?status=draft' })

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

    const response = await server.inject({ method: 'GET', url: '/submissions?status=draft' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve submissions' })
    expect(console.error).toHaveBeenCalledWith('Error retrieving submissions:', 'DynamoDB unavailable')
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
