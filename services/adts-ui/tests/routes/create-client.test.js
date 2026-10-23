import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => response.headers['set-cookie']?.[0]?.split(';')[0] || ''

const existingClient = {
  clientId: 101,
  name: 'Old McDonald',
  farmName: 'Animal Farm',
  addressLine1: '1 Farm Road',
  addressLine2: 'Farmsville',
  addressLine3: '',
  county: 'Merseyside',
  postcode: 'L20 6EC',
  cph: '12/123/1234'
}

const clientPayload = {
  cph: '48/234/2348',
  name: 'Jane Smith',
  farmName: 'Green Farm',
  addressLine1: '1 Farm Lane',
  addressLine2: 'Village',
  addressLine3: '',
  county: 'Northshire',
  postcode: 'AB1 2CD'
}

const mockBackend = () =>
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === 'http://localhost:3200/GetClients') {
      return new Response(JSON.stringify([existingClient]), { status: 200 })
    }
    throw new Error(`Unexpected backend URL: ${url}`)
  })

describe('Standalone client create and edit pages', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    server = await createServer()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('renders the create page without a county lookup or submission journey', async () => {
    mockBackend()

    const response = await server.inject({ method: 'GET', url: '/create-client' })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('Create a new client')
    expect(response.payload).toContain('<form method="post" action="/create-client">')
    expect(response.payload).toContain('id="cph" name="cph" type="text"')
    expect(response.payload).toContain('id="county" name="county" type="text"')
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(response.payload).not.toContain('Submission progress')
    expect(response.payload).not.toContain('submission-01-client-details')
  })

  test('lists existing clients with links to their edit pages', async () => {
    mockBackend()

    const response = await server.inject({ method: 'GET', url: '/update-client' })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain("Update an existing client's details")
    expect(response.payload).toContain('href="/edit-client/101"')
    expect(response.payload).toContain('Old McDonald')
    expect(response.payload).toContain('Animal Farm')
    expect(response.payload).toContain('12/123/1234')
  })

  test('shows an empty state when there are no clients to update', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    const response = await server.inject({ method: 'GET', url: '/update-client' })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('There are no existing clients to update.')
  })

  test('returns an error when clients cannot be loaded', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Adapter unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/update-client' })

    expect(response.statusCode).toBe(500)
    expect(response.payload).toBe('Unable to load clients')
  })

  test('create does not touch submission state and does not redirect into the submission', async () => {
    mockBackend()

    const response = await server.inject({ method: 'POST', url: '/create-client', payload: clientPayload })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')

    const stepOneResponse = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details',
      headers: { cookie: getCookieHeader(response) }
    })

    expect(stepOneResponse.request.response.source.context.submissionFormState).toEqual({})
    expect(stepOneResponse.request.response.source.context.clientOptions).toEqual([
      { value: '', text: 'Select a client', selected: true },
      { value: '101', text: 'Old McDonald', selected: false }
    ])
  })

  test('pre-populates the edit form for the client in the URL', async () => {
    mockBackend()

    const response = await server.inject({ method: 'GET', url: '/edit-client/101' })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('Edit client details')
    expect(response.payload).toContain('<form method="post" action="/edit-client/101">')
    expect(response.payload).toContain('value="Old McDonald"')
    expect(response.payload).toContain('value="Animal Farm"')
    expect(response.payload).toContain('value="1 Farm Road"')
    expect(response.payload).toContain('id="county" name="county" type="text" autocomplete="address-level1" value="Merseyside"')
    expect(globalThis.fetch).not.toHaveBeenCalledWith('http://localhost:3200/GetCounties')
    expect(response.payload).toContain('value="L20 6EC"')
    expect(response.payload).not.toContain('Submission progress')
  })

  test('edit does not touch submission state and redirects away from the submission', async () => {
    mockBackend()

    const selectionResponse = await server.inject({
      method: 'POST',
      url: '/submission-01-client-details',
      payload: { clientId: '101' }
    })
    const cookie = getCookieHeader(selectionResponse)

    const response = await server.inject({
      method: 'POST',
      url: '/edit-client/101',
      headers: { cookie },
      payload: { ...clientPayload, name: 'Changed Name' }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')

    const stepOneResponse = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details',
      headers: { cookie }
    })

    expect(stepOneResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({ clientId: '101' })
  })

  test.each(['GET', 'POST'])('%s edit returns 404 for an unknown client', async (method) => {
    mockBackend()

    const response = await server.inject({ method, url: '/edit-client/999', payload: clientPayload })

    expect(response.statusCode).toBe(404)
  })

  test('edit returns 404 when clients cannot be loaded', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Adapter unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/edit-client/101' })

    expect(response.statusCode).toBe(404)
  })

  test('the old session-based edit route no longer exists', async () => {
    const response = await server.inject({ method: 'GET', url: '/edit-client' })

    expect(response.statusCode).toBe(404)
  })
})
