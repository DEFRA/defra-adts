import { mock } from 'node:test'
import Lab from '@hapi/lab'
import Code from '@hapi/code'
import createServer from '../../src/app.js'

export const lab = Lab.script()
const { expect } = Code
const { describe, it, before, after, afterEach } = lab

describe('LIMS Backend Proxy - Network Mock Tests', () => {
  let server

  before(async () => {
    // Direct our code to a dummy endpoint during test runtimes
    process.env.LIMS_BASE_URL = 'https://mock-lims.local'
    process.env.PORT = 3100
    server = await createServer()
  })

  after(async () => {
    await server.stop()
  })

  afterEach(() => {
    // Reset all native mocks after each test run
    mock.reset()
  })

  it('should pass downstream mock LIMS data straight back through the proxy', async () => {
    const testSubmissionsMock = [
      {
        id: 'TEST-1234',
        statuses: ['Submitted'],
        client: 'TESTING CLIENT',
        hasTests: false,
        tests: []
      }
    ]

    mock.method(global, 'fetch', async (url) => {
      expect(url).to.startWith('https://mock-lims.local')
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

    expect(res.statusCode).to.equal(200)

    const data = JSON.parse(res.payload)
    expect(data.totalCount).to.equal(1)
    expect(data.results[0].id).to.equal('TEST-1234')
    expect(data.results[0].client).to.equal('TESTING CLIENT')
  })

  it('should gracefully handle 500 downstream outages from LIMS platform', async () => {
    mock.method(global, 'fetch', async () => {
      return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: 500
      })
    })

    const res = await server.inject({
      method: 'GET',
      url: '/submissions'
    })
    expect(res.statusCode).to.equal(500)
    const data = JSON.parse(res.payload)
    expect(data.error).to.equal('LIMS integration error')
  })
})
