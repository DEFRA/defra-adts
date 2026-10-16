import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => response.headers['set-cookie']?.[0]?.split(';')[0] || ''

describe('Create client page', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    server = await createServer()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('renders the page with counties returned by the backend lookup', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toBe('http://localhost:3200/GetCounties')
      return new Response(JSON.stringify([
        { countyId: 1, name: 'Northshire' },
        { countyId: 2, name: 'Southshire' }
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({ method: 'GET', url: '/create-client' })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('<form method="post" action="/create-client">')
    expect(response.payload).toContain('id="cph" name="cph" type="text"')
    expect(response.payload).toContain('<option value="1">Northshire</option>')
    expect(response.payload).toContain('<option value="2">Southshire</option>')
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetCounties')
  })

  test('stores the client details in submission form state and redirects to the first page', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === 'http://localhost:3200/GetCounties') {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (url === 'http://localhost:3200/GetClients') {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      throw new Error(`Unexpected backend URL: ${url}`)
    })

    const response = await server.inject({
      method: 'POST',
      url: '/create-client',
      payload: {
        cph: '48/234/2348',
        name: 'Jane Smith',
        farmName: 'Green Farm',
        addressLine1: '1 Farm Lane',
        addressLine2: 'Village',
        addressLine3: '',
        county: '1',
        postcode: 'AB1 2CD'
      }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-01-client-details')

    const revisitResponse = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details',
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.formDetails.client).toEqual({
      cph: '48/234/2348',
      name: 'Jane Smith',
      farmName: 'Green Farm',
      addressLine1: '1 Farm Lane',
      addressLine2: 'Village',
      addressLine3: '',
      county: '1',
      postcode: 'AB1 2CD'
    })
    expect(revisitResponse.payload).toContain('<option value="new-client" selected>Jane Smith</option>')
  })
})
