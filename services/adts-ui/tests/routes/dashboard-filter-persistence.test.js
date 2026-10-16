/**
 * Route-level tests for Dashboard filter persistence (server-side session).
 *
 * Verifies that filter values applied on /results persist back into the
 * dashboard form on return navigation to /, via the Yar session store.
 *
 * @story DASH-02
 * @acs AC3, AC7
 */

import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => {
  const setCookieHeader = response.headers['set-cookie']
  if (setCookieHeader && setCookieHeader.length > 0) {
    return setCookieHeader[0].split(';')[0]
  }
  return ''
}

describe('Dashboard Filter State Persistence', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
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

  test('should persist all submitted filters when the results adapter is unavailable', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Adapter unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const searchResponse = await server.inject({
      method: 'GET',
      url: '/results?client=Acme+Corp&status=draft&clinician=Dr+Smith&submitted-date=6_months'
    })

    expect(searchResponse.statusCode).toBe(200)
    expect(searchResponse.request.response.source.context.filteredValues).toEqual({
      client: 'Acme Corp',
      clinician: 'Dr Smith',
      status: 'draft',
      submitted_date: '6_months'
    })
    expect(searchResponse.payload).toContain('value="Acme Corp"')
    expect(searchResponse.payload).toContain('value="Dr Smith"')
    expect(searchResponse.payload).toContain('<option value="draft" selected>Draft</option>')
    expect(searchResponse.payload).toContain('<option value="6_months" selected>In the last 6 months</option>')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const adapterUrl = new URL(globalThis.fetch.mock.calls[0][0])
    expect(adapterUrl.pathname).toBe('/submissions')
    expect(Object.fromEntries(adapterUrl.searchParams)).toEqual({
      client: 'Acme Corp',
      status: 'draft',
      clinician: 'Dr Smith',
      'submitted-date': '6_months'
    })

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
    expect(context.filteredValues.submitted_date).toBe('6_months')

    const html = cleanNavResponse.payload

    expect(html).toContain('value="Acme Corp"')
    expect(html).toContain('value="Dr Smith"')
    expect(html).toContain('<option value="draft" selected>Draft</option>')
    expect(html).toContain('<option value="6_months" selected>In the last 6 months</option>')
  })
})
