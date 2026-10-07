import { describe, test, expect, afterAll } from '@jest/globals'
import createServer from '../../src/app.js'

describe('createServer', () => {
  let server

  afterAll(async () => {
    if (server) {
      await server.stop()
    }
  })

  test('returns a Hapi server instance with inject capability', async () => {
    process.env.PORT = '9181'
    process.env.SESSION_SECRET = 'jcgBvzmcBdLDIorYTvedmnNqIiiHIiymBokR'
    process.env.LIMS_ADAPTER_URL = 'http://localhost:9180'
    server = await createServer()
    expect(server).toBeDefined()
    expect(typeof server.inject).toBe('function')
  })

  test('home route responds with 200', async () => {
    const response = await server.inject({ method: 'GET', url: '/' })
    expect(response.statusCode).toBe(200)
  })

  test('home route returns HTML', async () => {
    const response = await server.inject({ method: 'GET', url: '/' })
    expect(response.headers['content-type']).toContain('text/html')
  })

  test('/health responds wih 200', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
  })
})
