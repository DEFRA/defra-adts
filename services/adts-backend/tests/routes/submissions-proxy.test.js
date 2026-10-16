import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Submissions service proxy routes', () => {
  let server

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test.each([
    ['/GetClients', 'http://localhost:3100/GetClients'],
    ['/GetCounties', 'http://localhost:3100/GetCounties'],
    ['/submissions?client=Acme+Farm&status=draft', 'http://localhost:3100/submissions?client=Acme+Farm&status=draft']
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

  test('returns a gateway error when the submissions service cannot be reached', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/submissions' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to reach submissions service' })
    expect(console.error).toHaveBeenCalledWith('Error contacting submissions service:', 'Connection refused')
  })
})
