import { expect } from '@hapi/code'
import Lab from '@hapi/lab'
import { createTestServer, getCookieHeader } from '../test-utils/utils.js'

const lab = Lab.script()
export { lab }

lab.experiment('Home Filter State Persistence', () => {
  let server

  lab.before(async () => {
    server = await createTestServer()
  })

  lab.after(async () => {
    await server.stop()
  })

  lab.test('should fall back to Joi schema defaults on absolute first load', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).to.equal(200)

    // Extract the template view context passed to home.njk
    const context = response.request.response.source.context

    expect(context.query).to.equal({
      client: '',
      clinician: '',
      status: 'show all',
      submitted_date: '18_months'
    })
  })

  lab.test('should persist active filters when navigating back to the home page cleanly', async () => {
    // Step 1: Simulate the user hitting the "Search" button with custom criteria
    const searchResponse = await server.inject({
      method: 'GET',
      url: '/?client=Acme+Corp&status=draft&clinician=Dr+Smith'
    })

    expect(searchResponse.statusCode).to.equal(200)

    // Extract the encrypted yar session cookie returned by the server
    const sessionCookie = getCookieHeader(searchResponse)
    expect(sessionCookie).to.contain('session=')

    // Step 2: Simulate navigating away and coming back cleanly to the home page
    // We send NO query parameters, but we pass the user's session cookie back
    const cleanNavResponse = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: sessionCookie
      }
    })

    expect(cleanNavResponse.statusCode).to.equal(200)

    // The template view context should still have our custom criteria intact!
    const context = cleanNavResponse.request.response.source.context

    expect(context.query.client).to.equal('Acme Corp')
    expect(context.query.clinician).to.equal('Dr Smith')
    expect(context.query.status).to.equal('draft')
    expect(context.query.submitted_date).to.equal('18_months') // Remained its default value
  })
})
