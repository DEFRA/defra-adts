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
})
