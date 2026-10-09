import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => {
  const setCookieHeader = response.headers['set-cookie']
  return setCookieHeader?.[0]?.split(';')[0] || ''
}

describe('Submission client details page', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('renders the client details journey page', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('1. Client details')
    expect(response.payload).toContain('Animal Disease Testing Service')
    expect(response.payload).toContain('create a new client')
    expect(response.request.response.source.context.client).toBe('')
  })

  test('restores the client value from the Yar session when revisiting the page', async () => {
    const clientDetailsResponse = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details?client=Acme+Farm'
    })

    expect(clientDetailsResponse.statusCode).toBe(200)
    expect(clientDetailsResponse.request.response.source.context.client).toBe('Acme Farm')

    const sessionCookie = getCookieHeader(clientDetailsResponse)
    expect(sessionCookie).toContain('session=')

    const homeResponse = await server.inject({
      method: 'GET',
      url: '/',
      headers: { cookie: sessionCookie }
    })

    expect(homeResponse.statusCode).toBe(200)

    const revisitResponse = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details',
      headers: { cookie: sessionCookie }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.client).toBe('Acme Farm')
    expect(revisitResponse.payload).toContain('value="Acme Farm"')
  })
})
