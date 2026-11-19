import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Submissions route source integration', () => {
  let server
  const docClient = { send: jest.fn() }
  const originalNodeEnv = process.env.NODE_ENV

  beforeAll(async () => {
    process.env.NODE_ENV = 'development'
    process.env.PORT = '3200'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer({ docClient })
  })

  afterAll(async () => {
    await server.stop()
    process.env.NODE_ENV = originalNodeEnv
  })

  afterEach(() => {
    jest.restoreAllMocks()
    docClient.send.mockReset()
  })

  test('uses DynamoDB path for Draft submissions and bypasses the submissions-service proxy', async () => {
    docClient.send.mockResolvedValue({
      Items: [{
        submissionId: 'draft-001',
        status: 'Draft',
        userId: 'user-456',
        submittedAt: '2026-10-20T00:00:00.000Z',
        client: 'Acme Farm'
      }]
    })
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?status=draft',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(response.statusCode).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(response.result.totalCount).toBe(1)
    expect(response.result.results[0].id).toBe('draft-001')
  })

  test('uses submissions-service proxy for non-Draft submissions and preserves downstream payload', async () => {
    const downstreamPayload = {
      results: [{ id: 'sub-001', statuses: ['Submitted'] }],
      totalCount: 1
    }
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(downstreamPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?status=submitted&client=Acme'
    })

    expect(response.statusCode).toBe(200)
    expect(docClient.send).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3100/submissions?status=submitted&client=Acme'
    )
    expect(response.result).toEqual(downstreamPayload)
  })
})
