/**
 * Route-level tests for container health (server-side session).
 *
 * Verifies that the /health endpoint returns HTTP statusCode 200.
 *
 */

import { expect } from '@hapi/code'
import Lab from '@hapi/lab'
import { mock } from 'node:test'
import createServer from '../../src/app.js'

const lab = Lab.script()
export { lab }

lab.experiment('Healthcheck endpoint', () => {
  let server

  lab.before(async () => {
    process.env.PORT = '3000'
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

  lab.test('should return http statusCode 200', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).to.equal(200)
  })
})
