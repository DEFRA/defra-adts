import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => {
  const setCookieHeader = response.headers['set-cookie']
  return setCookieHeader?.[0]?.split(';')[0] || ''
}

const url = '/submission-01-client-details'

const DEFAULT_CLIENTS = [
  { clientId: 101, name: 'Acme Farm' },
  { clientId: '102', name: 'Green Acres' }
]
const DEFAULT_COUNTIES = [
  { countyCode: 'AB', name: 'Argyll and Bute' },
  { countyCode: 'DORS', name: 'Dorset' },
  { countyCode: 'MERS', name: 'Merseyside' }
]

const jsonResponse = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})

const routeBackend = ({ clients = DEFAULT_CLIENTS, counties = DEFAULT_COUNTIES } = {}) => async (requestUrl) => {
  if (requestUrl === 'http://localhost:3200/GetClients') return jsonResponse(clients)
  if (requestUrl === 'http://localhost:3200/GetCounties') return jsonResponse(counties)
  throw new Error(`Unexpected backend request: ${requestUrl}`)
}
describe('Submission client details page', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    server = await createServer()
  })

  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(routeBackend())
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
    expect(response.payload).toContain('<form method="post" action="/submission-01-client-details" novalidate>')
    expect(response.payload).toContain('<select class="govuk-select" id="client" name="clientId"')
    expect(response.payload).toContain('name="intent"')
    expect(response.payload).toContain('href="/submission-01-client-details?intent=new">create a new client</a>')
    expect(response.payload).toMatch(/>\s*Continue\s*</)
    expect(response.payload).toContain('href="/assets/css/accessible-autocomplete.min.css"')
    expect(response.payload).toContain('<option value="101">Acme Farm</option>')
    expect(response.payload).toContain('<option value="102">Green Acres</option>')
    expect(response.payload).toContain('<select class="govuk-select" id="animalAddress" name="animalAddressClientId"')
    expect(response.payload).toContain('href="/submission-01-client-details?intent=newAnimalAddress">create a new animal\'s address</a>')
    expect(response.payload).toMatch(/data-client-edit-button\s+hidden/)
    expect(response.payload).toMatch(/data-animal-address-edit-button hidden/)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetClients')
    expect(response.request.response.source.context.submissionFormState).toEqual({})
    expect(response.request.response.source.context.clientOptions).toEqual([
      { value: '', text: 'Select a client', selected: true },
      { value: '101', text: 'Acme Farm', selected: false },
      { value: '102', text: 'Green Acres', selected: false }
    ])
  })

  test('stores selected client details in Yar and redirects to species capture', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101' }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-02-species')

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
      cph: '',
      name: 'Acme Farm',
      farmName: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      county: '',
      postcode: ''
    })
    expect(revisitResponse.payload).toContain('<option value="101" selected>Acme Farm</option>')
    expect(revisitResponse.payload).toContain('data-default-value="Acme Farm"')
    expect(revisitResponse.payload).toMatch(/data-client-edit-button\s*>Edit<\/button>/)
  })

  test('renders the animal location question with a conditional animal address section', async () => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.payload).toContain('Are the animals at the client’s address?')
    expect(response.payload).toMatch(/name="animalsAtClientAddress"[^>]*value="yes"/)
    expect(response.payload).toMatch(/name="animalsAtClientAddress"[^>]*value="no"[^>]*data-aria-controls="conditional-animalsAtClientAddress-2"/)
    expect(response.payload).toContain('govuk-radios__conditional govuk-radios__conditional--hidden')
    expect(response.payload).toContain('Animal address or location')
    expect(response.payload).toContain('name="animalAddressClientId"')
    expect(response.payload).toContain('Select an animal address')
    expect(response.payload).toContain('create a new animal\'s address')
    expect(response.payload).not.toContain('govuk-radios--inline')
    expect(response.payload).not.toMatch(/name="animalsAtClientAddress"[^>]*checked/)
  })

  test('stores and restores the animal address when the animals are not at the client address', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', animalsAtClientAddress: 'no', animalAddress: '  48/234/2348 ' }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-02-species')

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      clientId: '101',
      cph: '',
      name: 'Acme Farm',
      farmName: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      county: '',
      postcode: '',
      animalsAtClientAddress: 'no',
      animalAddress: '48/234/2348'
    })
    expect(revisitResponse.payload).toMatch(/name="animalsAtClientAddress"[^>]*value="no"[^>]*checked/)
    expect(revisitResponse.payload).toContain('value="48/234/2348"')
  })

  test('discards the animal address when the animals are at the client address', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', animalsAtClientAddress: 'yes', animalAddress: '48/234/2348' }
    })

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      clientId: '101',
      cph: '',
      name: 'Acme Farm',
      farmName: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      county: '',
      postcode: '',
      animalsAtClientAddress: 'yes'
    })
    expect(revisitResponse.payload).toMatch(/name="animalsAtClientAddress"[^>]*value="yes"[^>]*checked/)
  })

  test('omits the animal address when No is chosen but the address is blank', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', animalsAtClientAddress: 'no', animalAddress: '   ' }
    })

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      clientId: '101',
      cph: '',
      name: 'Acme Farm',
      farmName: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      county: '',
      postcode: '',
      animalsAtClientAddress: 'no'
    })
  })

  test('rejects an invalid animal location answer', async () => {
    const invalidAnswer = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', animalsAtClientAddress: 'maybe' }
    })

    expect(invalidAnswer.statusCode).toBe(400)
  })

  test('requires an existing selection or the manual-entry form before continuing', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '', animalsAtClientAddress: 'yes' }
    })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('Select a client from the list, or enter client details manually.')
  })

  test('prefills the edit form from the selected client and stores edited values for the submission', async () => {
    globalThis.fetch.mockImplementation(routeBackend({
      clients: [
        {
          clientId: 101,
          name: 'Acme Farm',
          farmName: 'Acme Holdings',
          addressLine1: '1 Farm Road',
          addressLine2: 'Farmsville',
          county: 'Merseyside',
          postcode: 'L20 6EC',
          cph: '12/123/1234'
        }
      ]
    }))

    const editResponse = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '101',
        intent: 'edit',
        animalsAtClientAddress: 'no',
        animalAddress: '48/234/2348'
      }
    })

    expect(editResponse.statusCode).toBe(200)
    expect(editResponse.payload).toContain('type="hidden" name="clientId" value="101"')
    expect(editResponse.payload).toContain('value="Acme Holdings"')
    expect(editResponse.payload).toContain('value="1 Farm Road"')
    expect(editResponse.payload).toContain('<option value="Merseyside" selected>Merseyside</option>')
    expect(editResponse.payload).toContain('value="L20 6EC"')
    expect(editResponse.payload).toMatch(/name="animalsAtClientAddress"[^>]*value="no"[^>]*checked/)
    expect(editResponse.payload).toContain('value="48/234/2348"')

    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '101',
        name: 'Acme Farm',
        farmName: 'Edited Farm Name',
        addressLine1: '2 Farm Road',
        addressLine2: 'Farmsville',
        addressLine3: '',
        county: 'Merseyside',
        postcode: 'L20 6EC',
        cph: '12/123/1234'
      }
    })

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      clientId: '101',
      name: 'Acme Farm',
      farmName: 'Edited Farm Name',
      addressLine1: '2 Farm Road',
      addressLine2: 'Farmsville',
      addressLine3: '',
      county: 'Merseyside',
      postcode: 'L20 6EC',
      cph: '12/123/1234'
    })
    expect(revisitResponse.payload).toContain('<p class="govuk-body">Edited Farm Name</p>')
    expect(revisitResponse.payload).toContain('<p class="govuk-body">2 Farm Road, Farmsville</p>')
    expect(revisitResponse.payload).toContain(
      '<option value="101" selected>Acme Farm, Acme Holdings, 1 Farm Road, Farmsville, Merseyside, L20 6EC, 12/123/1234</option>'
    )
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetCounties')
  })

  test('renders county as a select for the client and animal address', async () => {
    const clientResponse = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', intent: 'edit', animalsAtClientAddress: 'no' }
    })

    expect(clientResponse.statusCode).toBe(200)
    expect(clientResponse.payload).toMatch(/<select class="govuk-select[^"]*" id="county" name="county"/)
    expect(clientResponse.payload).toContain('<option value="Dorset">Dorset</option>')
    expect(clientResponse.payload).toContain('<option value="Argyll and Bute">Argyll and Bute</option>')
    expect(clientResponse.request.response.source.context.countyOptions).toEqual([
      { value: '', text: 'Select a county', selected: true },
      { value: 'Argyll and Bute', text: 'Argyll and Bute', selected: false },
      { value: 'Dorset', text: 'Dorset', selected: false },
      { value: 'Merseyside', text: 'Merseyside', selected: false }
    ])

    const animalAddressResponse = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', intent: 'newAnimalAddress', animalsAtClientAddress: 'no' }
    })

    expect(animalAddressResponse.statusCode).toBe(200)
    expect(animalAddressResponse.payload).toMatch(
      /<select class="govuk-select[^"]*" id="animalAddressCounty" name="animalAddressCounty"/
    )
    expect(animalAddressResponse.request.response.source.context.animalAddressCountyOptions).toHaveLength(4)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetCounties')
  })

  test('keeps a saved county that is missing from the reference data as an option', async () => {
    globalThis.fetch.mockImplementation(routeBackend({
      clients: [{ clientId: 101, name: 'Acme Farm', county: 'Old County' }],
      counties: [{ countyCode: 'DORS', name: 'Dorset' }]
    }))

    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', intent: 'edit', animalsAtClientAddress: 'no' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('<option value="Old County" selected>Old County</option>')
  })

  test('still renders the page with no county options when counties cannot be loaded', async () => {
    globalThis.fetch.mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetCounties') throw new Error('Adapter unavailable')
      return jsonResponse(DEFAULT_CLIENTS)
    })
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', intent: 'edit', animalsAtClientAddress: 'no' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toMatch(/<select class="govuk-select[^"]*" id="county" name="county"/)
    expect(response.request.response.source.context.countyOptions).toEqual([
      { value: '', text: 'Select a county', selected: true }
    ])
    expect(console.error).toHaveBeenCalledWith('Error loading counties:', 'Adapter unavailable')
  })

  test('allows entering new client details manually without a client record', async () => {
    const newClientPage = await server.inject({
      method: 'GET',
      url: `${url}?intent=new`
    })

    expect(newClientPage.statusCode).toBe(200)
    expect(newClientPage.payload).toContain('name="name"')
    expect(newClientPage.payload).toContain('name="addressLine1"')
    expect(newClientPage.payload).toContain('name="cph"')

    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '',
        name: 'Jane Smith',
        farmName: 'Green Farm',
        addressLine1: '1 Farm Lane',
        addressLine2: 'Village',
        addressLine3: '',
        county: 'Northshire',
        postcode: 'AB1 2CD',
        cph: '48/234/2348'
      }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-02-species')
    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      name: 'Jane Smith',
      farmName: 'Green Farm',
      addressLine1: '1 Farm Lane',
      addressLine2: 'Village',
      addressLine3: '',
      county: 'Northshire',
      postcode: 'AB1 2CD',
      cph: '48/234/2348'
    })
    expect(revisitResponse.payload).toContain('value="Jane Smith"')
  })

  test('shows a GOV.UK error when a manually entered client CPH has the wrong format', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '',
        manualClientEntry: 'yes',
        cph: '12/34/5678'
      }
    })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('There is a problem')
    expect(response.payload).toContain('Enter a CPH number in the format XX/XXX/XXXX')
    expect(response.payload).toContain('href="#cph"')
    expect(response.payload).toContain('id="cph-error"')
    expect(response.payload).toContain('value="12/34/5678"')
  })

  test('shows a GOV.UK error when a manually entered animal address CPH has the wrong format', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        animalsAtClientAddress: 'no',
        animalAddressName: 'Second Site',
        animalAddressCph: '12-345-6789'
      }
    })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('There is a problem')
    expect(response.payload).toContain('Enter a CPH number in the format XX/XXX/XXXX')
    expect(response.payload).toContain('href="#animalAddressCph"')
    expect(response.payload).toContain('id="animalAddressCph-error"')
    expect(response.payload).toContain('value="12-345-6789"')
  })

  test('shows and saves separate manual client and animal address forms', async () => {
    const newClientPage = await server.inject({
      method: 'POST',
      url,
      payload: { intent: 'new' }
    })
    const animalAddressPage = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(newClientPage) },
      payload: {
        intent: 'newAnimalAddress',
        manualClientEntry: 'yes',
        clientId: '',
        name: 'Jane Smith',
        farmName: 'Client Farm',
        addressLine1: '1 Client Lane',
        addressLine2: '',
        addressLine3: '',
        county: 'Northshire',
        postcode: 'AB1 2CD',
        cph: '48/234/2348',
        animalsAtClientAddress: 'no'
      }
    })

    expect(animalAddressPage.statusCode).toBe(200)
    expect(animalAddressPage.payload).toContain('name="name"')
    expect(animalAddressPage.payload).toContain('name="addressLine1"')
    expect(animalAddressPage.payload).toContain('name="animalAddressName"')
    expect(animalAddressPage.payload).toContain('name="animalAddressAddressLine1"')
    expect(animalAddressPage.payload.indexOf('name="cph"')).toBeLessThan(
      animalAddressPage.payload.indexOf('name="name"')
    )
    expect(animalAddressPage.payload.indexOf('name="animalAddressCph"')).toBeLessThan(
      animalAddressPage.payload.indexOf('name="animalAddressName"')
    )
    expect(animalAddressPage.payload).toContain('>Cancel</button>')
    expect(animalAddressPage.payload).not.toContain('Cancel new animal address')
    expect(animalAddressPage.payload).toContain('value="Jane Smith"')

    const response = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(animalAddressPage) },
      payload: {
        manualClientEntry: 'yes',
        clientId: '',
        name: 'Jane Smith',
        farmName: 'Client Farm',
        addressLine1: '1 Client Lane',
        addressLine2: '',
        addressLine3: '',
        county: 'Northshire',
        postcode: 'AB1 2CD',
        cph: '48/234/2348',
        animalsAtClientAddress: 'no',
        animalAddressName: 'Second Site',
        animalAddressFarmName: 'Animal Farm',
        animalAddressAddressLine1: '2 Animal Road',
        animalAddressAddressLine2: '',
        animalAddressAddressLine3: '',
        animalAddressCounty: 'Southshire',
        animalAddressPostcode: 'CD3 4EF',
        animalAddressCph: '49/345/3456'
      }
    })

    expect(response.statusCode).toBe(302)
    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      name: 'Jane Smith',
      farmName: 'Client Farm',
      addressLine1: '1 Client Lane',
      addressLine2: '',
      addressLine3: '',
      county: 'Northshire',
      postcode: 'AB1 2CD',
      cph: '48/234/2348',
      animalsAtClientAddress: 'no',
      animalAddressDetails: {
        name: 'Second Site',
        farmName: 'Animal Farm',
        addressLine1: '2 Animal Road',
        addressLine2: '',
        addressLine3: '',
        county: 'Southshire',
        postcode: 'CD3 4EF',
        cph: '49/345/3456'
      }
    })
    expect(revisitResponse.payload).toContain('value="Jane Smith"')
    expect(revisitResponse.payload).toContain('value="Second Site"')
  })

  test('looks up and edits an existing animal address from the client records', async () => {
    globalThis.fetch.mockImplementation(routeBackend({
      clients: [
        { clientId: '101', name: 'Acme Farm', addressLine1: '1 Farm Road', county: 'Dorset', cph: '12/123/1234' },
        { clientId: '102', name: 'Green Acres', addressLine1: '2 Green Lane', county: 'Merseyside', cph: '22/222/2222' }
      ]
    }))

    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '101',
        animalsAtClientAddress: 'no',
        animalAddressClientId: '102'
      }
    })

    expect(response.statusCode).toBe(302)
    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toMatchObject({
      animalAddressClientId: '102',
      animalAddress: 'Green Acres, 2 Green Lane, Merseyside, 22/222/2222',
      animalAddressDetails: {
        name: 'Green Acres',
        addressLine1: '2 Green Lane',
        county: 'Merseyside',
        cph: '22/222/2222'
      }
    })
    expect(revisitResponse.payload).toContain('id="animalAddress" name="animalAddressClientId"')
    expect(revisitResponse.payload).toContain('data-default-value="Green Acres, 2 Green Lane, Merseyside, 22/222/2222"')
    expect(revisitResponse.payload).toContain('data-animal-address-edit-button')
    expect(revisitResponse.payload).toMatch(/data-animal-address-edit-button[^>]*>Edit<\/button>/)

    const editResponse = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(response) },
      payload: {
        clientId: '101',
        animalsAtClientAddress: 'no',
        animalAddressClientId: '102',
        intent: 'editAnimalAddress'
      }
    })
    expect(editResponse.statusCode).toBe(200)
    expect(editResponse.payload).toContain('value="Green Acres"')
    expect(editResponse.payload).toContain('value="2 Green Lane"')
    expect(editResponse.payload).toContain('value="22/222/2222"')
  })

  test('opens the manual animal-address form from its create link', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `${url}?intent=newAnimalAddress`
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('name="animalAddressName"')
    expect(response.payload).toContain('name="animalAddressAddressLine1"')
    expect(response.payload).toMatch(/name="animalsAtClientAddress"[^>]*value="no"[^>]*checked/)
  })

  test('cancel returns to client selection without saving edits', async () => {
    const selected = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101' }
    })
    const cookie = getCookieHeader(selected)

    const cancelled = await server.inject({
      method: 'POST',
      url,
      headers: { cookie },
      payload: { clientId: '101', name: 'Unsaved change', intent: 'cancel' }
    })

    expect(cancelled.statusCode).toBe(200)
    expect(cancelled.payload).toContain('Selected client')
    expect(cancelled.payload).not.toContain('value="Unsaved change"')
  })

  test('does not select a client that is not in the backend list', async () => {
    const existingClientResponse = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101' }
    })

    const response = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(existingClientResponse) },
      payload: { clientId: 'unknown-client' }
    })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('Select a client from the list')

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(existingClientResponse) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      clientId: '101',
      cph: '',
      name: 'Acme Farm',
      farmName: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      county: '',
      postcode: ''
    })
  })

  test('requires a valid client selection or manually entered client details', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: 'unknown' }
    })
    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('Select a client from the list')
  })

  test('blocks an existing-client selection when clients cannot be loaded', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('Adapter unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101' }
    })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('Select a client from the list')
    expect(console.error).toHaveBeenCalledWith('Error contacting backend server:', 'Adapter unavailable')

    expect(response.request.response.source.context.clientOptions).toEqual([
      { value: '', text: 'Select a client', selected: true }
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
