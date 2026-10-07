import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => {
  const setCookieHeader = response.headers['set-cookie']
  if (setCookieHeader && setCookieHeader.length > 0) {
    return setCookieHeader[0].split(';')[0]
  }
  return ''
}

describe('Home Filter State Persistence', () => {
  let server

  beforeAll(async () => {
    process.env.PORT = '9181'
    process.env.SESSION_SECRET = 'jcgBvzmcBdLDIorYTvedmnNqIiiHIiymBokR'
    process.env.LIMS_ADAPTER_URL = 'http://localhost:9180'
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should fall back to Joi schema defaults on absolute first load', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).toBe(200)

    // Extract the template view context passed to home.njk
    const context = response.request.response.source.context

    expect(context.filteredValues).toEqual({
      client: '',
      clinician: '',
      status: 'show_all',
      submitted_date: '18_months'
    })
  })

  test('should persist active filters when navigating back to the home page cleanly', async () => {
    // Mock the LIMS adapter backend call since hitting /results will trigger a fetch request
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ results: [], totalCount: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const searchResponse = await server.inject({
      method: 'GET',
      url: '/results?client=Acme+Corp&status=draft&clinician=Dr+Smith'
    })

    expect(searchResponse.statusCode).toBe(200)

    const sessionCookie = getCookieHeader(searchResponse)
    expect(sessionCookie).toContain('session=')

    const cleanNavResponse = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: sessionCookie
      }
    })

    expect(cleanNavResponse.statusCode).toBe(200)

    const context = cleanNavResponse.request.response.source.context

    expect(context.filteredValues.client).toBe('Acme Corp')
    expect(context.filteredValues.clinician).toBe('Dr Smith')
    expect(context.filteredValues.status).toBe('draft')
    expect(context.filteredValues.submitted_date).toBe('18_months')

    const html = cleanNavResponse.payload

    expect(html).toContain('value="Acme Corp"')
    expect(html).toContain('value="Dr Smith"')
    expect(html).toContain('value="draft"')
  })
})
