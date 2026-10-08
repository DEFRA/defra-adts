import { describe, test, expect, afterAll } from '@jest/globals'
import createServer from '../../src/app.js'

/**
 * Unit test — server factory only.
 *
 * Route-level behaviour (GET / responds, returns HTML) is covered by
 * route tests in services/adts-ui/tests/routes/dashboard-layout.lab.test.js
 * and dashboard-filter-persistence.lab.test.js — not duplicated here.
 */
describe('createServer', () => {
  let server

  afterAll(async () => {
    if (server) {
      await server.stop()
    }
  })

  test('returns a Hapi server instance with inject capability', async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    server = await createServer()
    expect(server).toBeDefined()
    expect(typeof server.inject).toBe('function')
  })
})
