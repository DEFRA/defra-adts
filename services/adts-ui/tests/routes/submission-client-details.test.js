import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => {
  const setCookieHeader = response.headers['set-cookie']
  return setCookieHeader?.[0]?.split(';')[0] || ''
}

const url = '/submission-01-client-details'
const createClientPayload = {
  cph: '',
  name: '',
  farmName: '',
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  county: '',
  postcode: ''
}

describe('Submission client details page', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    server = await createServer()
  })

  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toBe('http://localhost:3200/GetClients')
      return new Response(JSON.stringify([
        { clientId: 101, name: 'Acme Farm' },
        { clientId: '102', name: 'Green Acres' }
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('renders the client details journey page', async () => {
    const response = await server.inject({
      method: 'GET',
      url
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('1. Client details')
    expect(response.payload).toContain('Animal Disease Testing Service')
    expect(response.payload).toContain('create a new client')
    expect(response.payload).toContain('href="/create-edit-client?mode=create">create a new client</a>')
    expect(response.payload).toContain('<form method="post" action="/submission-01-client-details">')
    expect(response.payload).toContain('<select class="govuk-select" id="client" name="clientId"')
    expect(response.payload).toMatch(/>\s*Continue\s*</)
    expect(response.payload).toContain('href="/assets/css/accessible-autocomplete.min.css"')
    expect(response.payload).toContain('<option value="101">Acme Farm</option>')
    expect(response.payload).toContain('<option value="102">Green Acres</option>')
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetClients')
    expect(response.request.response.source.context.submissionFormState).toEqual({})
    expect(response.request.response.source.context.clientOptions).toEqual([
      { value: '', text: 'Select a client', selected: true },
      { value: '101', text: 'Acme Farm', selected: false },
      { value: '102', text: 'Green Acres', selected: false }
    ])
  })

  test('stores the selected client id and name in Yar and redirects back to the page', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101' }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(url)

    const sessionCookie = getCookieHeader(response)
    expect(sessionCookie).toContain('session=')

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: sessionCookie }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      clientId: '101',
      name: 'Acme Farm'
    })
    expect(revisitResponse.payload).toContain('<option value="101" selected>Acme Farm</option>')
    expect(revisitResponse.payload).toContain('data-default-value="Acme Farm"')
  })

  test.each([
    [{ cph: '48/123/4567' }, '48/123/4567'],
    [{}, 'New client']
  ])('uses a fallback label for a new client', async (clientDetails, expectedLabel) => {
    const createResponse = await server.inject({
      method: 'POST',
      url: '/create-edit-client?mode=create',
      payload: { ...createClientPayload, ...clientDetails }
    })

    const response = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(createResponse) }
    })

    expect(response.statusCode).toBe(200)
    expect(response.request.response.source.context.clientOptions).toContainEqual({
      value: 'new-client',
      text: expectedLabel,
      selected: true
    })
  })

  test('keeps a newly created client when it is selected on the client details page', async () => {
    const createResponse = await server.inject({
      method: 'POST',
      url: '/create-edit-client?mode=create',
      payload: { ...createClientPayload, name: 'New farm' }
    })

    const response = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(createResponse) },
      payload: { clientId: 'new-client' }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(url)

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      ...createClientPayload,
      name: 'New farm'
    })
    expect(revisitResponse.request.response.source.context.clientOptions).toContainEqual({
      value: 'new-client',
      text: 'New farm',
      selected: true
    })
  })

  test('does not select a new client when there is no created client in the session', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: 'new-client' }
    })

    expect(response.statusCode).toBe(302)

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toBeUndefined()
    expect(revisitResponse.request.response.source.context.clientOptions).not.toContainEqual(
      expect.objectContaining({ value: 'new-client' })
    )
  })

  test('does not treat an existing client as a newly created client', async () => {
    const existingClientResponse = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101' }
    })

    const response = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(existingClientResponse) },
      payload: { clientId: 'new-client' }
    })

    expect(response.statusCode).toBe(302)

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toBeUndefined()
    expect(revisitResponse.request.response.source.context.clientOptions).not.toContainEqual(
      expect.objectContaining({ value: 'new-client' })
    )
  })

  test('does not save an id that is not present in the clients list', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: 'unknown' }
    })
    expect(response.payload).not.toContain('Select a client from the list.')
  })

  test('redirects without saving a client when clients cannot be loaded on submit', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('Adapter unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101' }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(url)
    expect(console.error).toHaveBeenCalledWith('Error contacting backend server:', 'Adapter unavailable')

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.clientOptions).toEqual([
      { value: '', text: 'Select a client', selected: true },
      { value: '101', text: 'Acme Farm', selected: false },
      { value: '102', text: 'Green Acres', selected: false }
    ])
  })

  test('shows an error when clients cannot be loaded', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('Adapter unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'GET',
      url
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('1. Client details')
    expect(response.payload).toContain('<select class="govuk-select" id="client" name="clientId"')
    expect(response.request.response.source.context.clientOptions).toEqual([
      { value: '', text: 'Select a client', selected: true }
    ])
    expect(console.error).toHaveBeenCalledWith('Error contacting backend server:', 'Adapter unavailable')
  })

  test('serves the accessible autocomplete stylesheet', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/assets/css/accessible-autocomplete.min.css'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/css')
    expect(response.payload).toContain('.autocomplete__input')
  })
})
