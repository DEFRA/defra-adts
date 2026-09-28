import createServer from '../../src/app.js'

export const testSessionSecret = 'test-session-secret-with-at-least-32-characters'

export const createTestServer = async (options = {}) => {
  // Ensure the environment variable is globally satisfied for the runtime of the tests
  process.env.SESSION_SECRET = testSessionSecret

  const { configure, ...serverOptions } = options
  const server = await createServer({
    sessionSecret: testSessionSecret,
    ...serverOptions
  })

  if (configure) {
    configure(server)
  }

  await server.initialize()
  return server
}

export const getCookieHeader = (response) => {
  const rawCookies = response.headers['set-cookie']
  
  if (!rawCookies) {
    return ''
  }

  // Handle both a single string cookie or an array of cookies returned by Hapi
  const cookieArray = Array.isArray(rawCookies) ? rawCookies : [rawCookies]
  
  return cookieArray.map((cookie) => cookie.split(';', 1)[0]).join('; ')
}
