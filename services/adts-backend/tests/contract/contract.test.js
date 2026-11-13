import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Backend API contracts', () => {
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
    docClient.send.mockResolvedValue({
      Items: [{
        submissionId: 'draft-001',
        status: 'Draft',
        submittedAt: '2026-10-20T00:00:00.000Z',
        client: 'Acme Farm',
        clinician: 'Dr Alice Morgan',
        tests: []
      }]
    })

    const response = await server.inject({ method: 'GET', url: '/submissions?status=draft' })

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

  test('GET /submissions for non-Draft status preserves downstream status and body', async () => {
    const downstreamPayload = {
      results: [{ id: 'SUB-123', statuses: ['Submitted'] }],
      totalCount: 1
    }
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(downstreamPayload), {
      status: 206,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({ method: 'GET', url: '/submissions?status=submitted' })

    expect(response.statusCode).toBe(206)
    expect(response.result).toEqual(downstreamPayload)
  })
})
