import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Backend API contracts', () => {
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

  test('GET /health returns the agreed contract shape', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ status: 'UP' })
    expect(Object.keys(response.result)).toEqual(['status'])
  })

  test('GET /GetSpecies maps DynamoDB records to the API contract shape', async () => {
    docClient.send.mockResolvedValue({
      Items: [
        { code: 'CHICKEN', description: 'Chicken' },
        { code: 'CATTLE', description: 'Cattle' }
      ]
    })

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([
      { speciesId: 'CHICKEN', name: 'Chicken' },
      { speciesId: 'CATTLE', name: 'Cattle' }
    ])
    expect(response.result.every((item) =>
      Object.keys(item).length === 2 &&
      Object.hasOwn(item, 'speciesId') &&
      Object.hasOwn(item, 'name')
    )).toBe(true)
  })

  test('GET /submissions?status=draft returns the Draft search contract', async () => {
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
          client: 'Acme Farm',
          clinician: 'Dr Alice Morgan',
          tests: []
        }]
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?status=draft',
      headers: { 'x-local-draft-owner-id': 'user-456' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result.totalCount).toBe(1)
    expect(response.result.results).toHaveLength(1)
    expect(response.result.results[0]).toMatchObject({
      id: 'draft-001',
      statuses: ['Draft'],
      client: 'Acme Farm',
      clinician: 'Dr Alice Morgan'
    })
  })

  test('GET /submissions for non-Draft status calls LIMS and returns mapped results', async () => {
    const limsPayload = [{
      draftSubmissionId: '',
      submissionId: 'SUB-123',
      status: 'Submitted',
      clientName: 'Test Client',
      clientFarm: 'Test Farm',
      clinician: 'Dr Test',
      submittedDate: '2026-10-20T00:00:00.000Z',
      products: []
    }]
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(limsPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    docClient.send.mockResolvedValue({ Item: { PK: 'mock-user', limsId: 'PVS001' } })

    const response = await server.inject({ method: 'GET', url: '/submissions?status=submitted' })

    expect(response.statusCode).toBe(200)
    expect(response.result.totalCount).toBe(1)
    expect(response.result.results[0]).toMatchObject({
      id: 'SUB-123',
      statuses: ['Submitted']
    })
  })
})
