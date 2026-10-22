import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => response.headers['set-cookie']?.[0]?.split(';')[0] || ''

describe('Create/edit client page', () => {
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

  test('renders the page with counties returned by the backend lookup', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toBe('http://localhost:3200/GetCounties')
      return new Response(JSON.stringify([
        { countyId: 1, name: 'Northshire' },
        { countyId: 2, name: 'Southshire' }
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({ method: 'GET', url: '/create-edit-client?mode=create' })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('<form method="post" action="/create-edit-client?mode=create">')
    expect(response.payload).toContain('id="cph" name="cph" type="text"')
    expect(response.payload).toContain('<option value="1">Northshire</option>')
    expect(response.payload).toContain('<option value="2">Southshire</option>')
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetCounties')
  })

  test.each([
    '/create-edit-client',
    '/create-edit-client?mode=unknown'
  ])('requires a valid form mode for %s', async (url) => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(400)
  })

  test('stores the client details in submission form state and redirects to the first page', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === 'http://localhost:3200/GetCounties') {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (url === 'http://localhost:3200/GetClients') {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      throw new Error(`Unexpected backend URL: ${url}`)
    })

    const response = await server.inject({
      method: 'POST',
      url: '/create-edit-client?mode=create',
      payload: {
        cph: '48/234/2348',
        name: 'Jane Smith',
        farmName: 'Green Farm',
        addressLine1: '1 Farm Lane',
        addressLine2: 'Village',
        addressLine3: '',
        county: '1',
        postcode: 'AB1 2CD'
      }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-01-client-details')

    const revisitResponse = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details',
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      cph: '48/234/2348',
      name: 'Jane Smith',
      farmName: 'Green Farm',
      addressLine1: '1 Farm Lane',
      addressLine2: 'Village',
      addressLine3: '',
      county: '1',
      postcode: 'AB1 2CD'
    })
    expect(revisitResponse.payload).toContain('<option value="new-client" selected>Jane Smith</option>')
  })

  test('pre-populates the edit form and saves changes to the selected existing client', async () => {
    const selectedClient = {
      clientId: 101,
      name: 'Old McDonald',
      farmName: 'Animal Farm',
      addressLine1: '1 Farm Road',
      addressLine2: 'Farmsville',
      addressLine3: '',
      countyId: 2,
      postcode: 'L20 6EC',
      cph: '12/123/1234'
    }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === 'http://localhost:3200/GetCounties') {
        return new Response(JSON.stringify([{ countyId: 2, name: 'Merseyside' }]), { status: 200 })
      }
      if (url === 'http://localhost:3200/GetClients') {
        return new Response(JSON.stringify([selectedClient]), { status: 200 })
      }
      throw new Error(`Unexpected backend URL: ${url}`)
    })

    const selectionResponse = await server.inject({
      method: 'POST',
      url: '/submission-01-client-details',
      payload: { clientId: '101' }
    })
    const cookie = getCookieHeader(selectionResponse)

    const editResponse = await server.inject({
      method: 'GET',
      url: '/create-edit-client?mode=edit',
      headers: { cookie }
    })

    expect(editResponse.statusCode).toBe(200)
    expect(editResponse.payload).toContain('<form method="post" action="/create-edit-client?mode=edit">')
    expect(editResponse.payload).toContain('value="Old McDonald"')
    expect(editResponse.payload).toContain('value="Animal Farm"')
    expect(editResponse.payload).toContain('value="1 Farm Road"')
    expect(editResponse.payload).toContain('<option value="2" selected>Merseyside</option>')
    expect(editResponse.payload).toContain('value="L20 6EC"')

    const saveResponse = await server.inject({
      method: 'POST',
      url: '/create-edit-client?mode=edit',
      headers: { cookie },
      payload: {
        cph: '12/123/1234',
        name: 'Old McDonald Updated',
        farmName: 'New Animal Farm',
        addressLine1: '2 Farm Road',
        addressLine2: 'New Farmsville',
        addressLine3: '',
        county: '2',
        postcode: 'L21 7EC'
      }
    })

    expect(saveResponse.statusCode).toBe(302)
    expect(saveResponse.headers.location).toBe('/submission-01-client-details')

    const revisitResponse = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details',
      headers: { cookie: getCookieHeader(saveResponse) }
    })

    const updatedClient = revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails
    expect(updatedClient).toEqual({
      ...selectedClient,
      clientId: '101',
      name: 'Old McDonald Updated',
      farmName: 'New Animal Farm',
      addressLine1: '2 Farm Road',
      addressLine2: 'New Farmsville',
      county: '2',
      countyId: '2',
      countyName: 'Merseyside',
      postcode: 'L21 7EC'
    })
    expect(revisitResponse.payload).toContain('Old McDonald Updated')
    expect(revisitResponse.payload).toContain('New Animal Farm')
    expect(revisitResponse.payload).toContain('2 Farm Road, New Farmsville')
    expect(revisitResponse.payload).toContain('Merseyside')
    expect(revisitResponse.payload).toContain('L21 7EC')
    expect(revisitResponse.payload).toContain('href="/create-edit-client?mode=edit">Edit</a>')
  })

  test('redirects to client selection when edit is opened without an existing selected client', async () => {
    const response = await server.inject({ method: 'GET', url: '/create-edit-client?mode=edit' })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-01-client-details')
  })
})
