import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('LIMS Backend Proxy - Network Mock Tests', () => {
  let server

  beforeAll(async () => {
    server = await createServer({ port: 9180, limsBaseUrl: 'https://mock-lims.local' })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should pass downstream mock LIMS data straight back through the proxy', async () => {
    const testSubmissionsMock = [
      {
        id: 'TEST-1234',
        statuses: ['Submitted'],
        client: 'TESTING CLIENT',
        hasTests: false,
        tests: []
      }
    ]

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      // Assert that our code targeted the correct environment endpoint configuration
      expect(url).toMatch(/^https:\/\/mock-lims\.local/)

      // Simulate a successful network response stream container
      return new Response(JSON.stringify({
        results: testSubmissionsMock,
        totalCount: testSubmissionsMock.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const res = await server.inject({
      method: 'GET',
      url: '/submissions?client=TESTING'
    })

    expect(res.statusCode).toBe(200)

    const data = JSON.parse(res.payload)
    expect(data.totalCount).toBe(1)
    expect(data.results[0].id).toBe('TEST-1234')
    expect(data.results[0].client).toBe('TESTING CLIENT')
  })

  test('should gracefully handle 500 downstream outages from LIMS platform', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: 500
      })
    })

    const res = await server.inject({
      method: 'GET',
      url: '/submissions'
    })

    // Validates our proxy accurately catches bad error states
    expect(res.statusCode).toBe(500)
    const data = JSON.parse(res.payload)
    expect(data.error).toBe('LIMS integration error')
  })
})
