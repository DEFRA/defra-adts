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
    docClient.send.mockImplementation(({ input }) => {
      if (input.TableName === 'adts-ci-lims-mapping') {
        return Promise.resolve({ Item: { PK: 'user-456', limsId: 'PVS001' } })
      }
      return Promise.resolve({
        Items: [{
          submissionId: 'draft-001',
          status: 'Draft',
          userId: 'user-456',
          submittedAt: '2026-10-20T00:00:00.000Z',
          client: 'Acme Farm'
        }]
      })
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

  test('calls LIMS submissions service for non-Draft submissions with proper structure', async () => {
    const limsPayload = [{
      draftSubmissionId: '',
      submissionId: 'sub-001',
      status: 'Submitted',
      clientName: 'Acme Farm',
      clientFarm: 'Home Farm',
      clinician: 'Dr Vet',
      submittedDate: '2026-10-20T00:00:00.000Z',
      products: []
    }]
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(limsPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    docClient.send.mockResolvedValue({ Item: { PK: 'mock-user', limsId: 'PVS001' } })

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?status=submitted&client=Acme'
    })

    expect(response.statusCode).toBe(200)
    expect(docClient.send).toHaveBeenCalledTimes(1)
    // Verify the call goes to the LIMS v1 endpoint
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3100/v1/submissions?pvsId=PVS001')
    )
    // Verify the response is mapped and filtered correctly
    expect(response.result.totalCount).toBe(1)
    expect(response.result.results[0]).toMatchObject({
      id: 'sub-001',
      statuses: ['Submitted'],
      client: 'Acme Farm'
    })
  })
})
