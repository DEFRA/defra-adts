/**
 * Route-level tests for Dashboard filter persistence (server-side session).
 *
 * Verifies that filter values applied on /results persist back into the
 * dashboard form on return navigation to /, via the Yar session store.
 *
 * @story DASH-02
 * @acs AC3, AC7
 */

import { expect } from '@hapi/code'
import Lab from '@hapi/lab'
import { mock } from 'node:test'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => {
  const setCookieHeader = response.headers['set-cookie']
  if (setCookieHeader && setCookieHeader.length > 0) {
    return setCookieHeader[0].split(';')[0]
  }
  return ''
}

const lab = Lab.script()
export { lab }

lab.experiment('Dashboard Filter State Persistence', () => {
  let server

  lab.before(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer()
  })

  lab.after(async () => {
    await server.stop()
  })

  lab.afterEach(() => {
    mock.reset()
  })

  lab.test('should fall back to Joi schema defaults on absolute first load', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).to.equal(200)

    // Extract the template view context passed to home.njk
    const context = response.request.response.source.context

    expect(context.filteredValues).to.equal({
      client: '',
      clinician: '',
      status: 'show_all',
      submitted_date: '18_months'
    })
  })

  lab.test('should persist active filters when navigating back to the home page cleanly', async () => {
    // Mock the LIMS adapter backend call since hitting /results will trigger a fetch request
    mock.method(global, 'fetch', async () => {
      return new Response(JSON.stringify({ results: [], totalCount: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const searchResponse = await server.inject({
      method: 'GET',
      url: '/results?client=Acme+Corp&status=draft&clinician=Dr+Smith'
    })

    expect(searchResponse.statusCode).to.equal(200)

    const sessionCookie = getCookieHeader(searchResponse)
    expect(sessionCookie).to.contain('session=')

    const cleanNavResponse = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: sessionCookie
      }
    })

    expect(cleanNavResponse.statusCode).to.equal(200)

    const context = cleanNavResponse.request.response.source.context

    expect(context.filteredValues.client).to.equal('Acme Corp')
    expect(context.filteredValues.clinician).to.equal('Dr Smith')
    expect(context.filteredValues.status).to.equal('draft')
    expect(context.filteredValues.submitted_date).to.equal('18_months')

    const html = cleanNavResponse.payload

    expect(html).to.contain('value="Acme Corp"')
    expect(html).to.contain('value="Dr Smith"')
    expect(html).to.contain('value="draft"')
  })
})
