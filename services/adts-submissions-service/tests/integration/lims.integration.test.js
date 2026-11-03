import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import { constants } from 'node:http2'
import createServer from '../../src/app.js'

describe('Submissions-service LIMS integration', () => {
  let server

  beforeAll(async () => {
    process.env.PORT = '3100'
    process.env.LIMS_BASE_URL = 'https://mock-lims.local'
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('proxies query parameters to the LIMS endpoint and returns the response body', async () => {
    const limsPayload = {
      results: [{ id: 'LIMS-001', statuses: ['Submitted'], client: 'Acme Farm' }],
      totalCount: 1
    }
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(limsPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const response = await server.inject({
      method: 'GET',
      url: '/submissions?client=Acme&status=submitted'
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://mock-lims.local/submissions?client=Acme&status=submitted'
    )
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(limsPayload)
  })

  test('returns downstream status codes when the LIMS responds unsuccessfully', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: 'Service unavailable'
    }), { status: 503 }))

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(503)
    expect(response.result).toEqual({ error: 'LIMS integration error' })
  })

  test('returns 502 when the LIMS endpoint cannot be reached', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'))

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(constants.HTTP_STATUS_BAD_GATEWAY)
    expect(response.result).toEqual({ error: 'LIMS connectivity failure' })
  })
})
