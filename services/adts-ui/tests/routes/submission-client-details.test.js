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
    expect(response.payload).toContain('href="/submission-01-client-address?intent=new"')
    expect(response.payload).toContain('create a new client')
    expect(response.payload).toMatch(/>\s*Continue\s*</)
    expect(response.payload).toContain('href="/assets/css/accessible-autocomplete.min.css"')
    expect(response.payload).toContain('<option value="101">Acme Farm</option>')
    expect(response.payload).toContain('<option value="102">Green Acres</option>')
    expect(response.payload).toContain('<select class="govuk-select" id="animalAddress" name="animalAddressClientId"')
    expect(response.payload).toContain('href="/submission-01-animal-address?intent=new"')
    expect(response.payload).toContain('create a new animal\'s address')
    expect(response.payload).toMatch(/data-client-edit-button\s+hidden/)
    expect(response.payload).toMatch(/data-animal-address-edit-button[^>]*\shidden(?:\s|>)/)
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

  test('renders the animal location question with a separate create-address link', async () => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.payload).toContain('Are the animals at the client’s address?')
    expect(response.payload).toMatch(/name="animalsAtClientAddress"[^>]*value="yes"/)
    expect(response.payload).toMatch(/id="animal-address-selection" hidden/)
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

  test('does not render selected client or animal address summaries', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '101',
        animalsAtClientAddress: 'no',
        animalAddressClientId: '102'
      }
    })
    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(response) }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(revisitResponse.payload).not.toContain('Selected client')
    expect(revisitResponse.payload).not.toContain('Selected animal address')
    expect(revisitResponse.payload).not.toContain('govuk-inset-text')
    expect(revisitResponse.payload).toMatch(/data-client-edit-button\s*>Edit<\/button>/)
    expect(revisitResponse.payload).toMatch(/data-animal-address-edit-button[^>]*>Edit<\/button>/)
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
    expect(revisitResponse.payload).not.toContain('<p class="govuk-body">Edited Farm Name</p>')
    expect(revisitResponse.payload).not.toContain('<p class="govuk-body">2 Farm Road, Farmsville</p>')
    expect(revisitResponse.payload).not.toContain('Selected client')
    expect(revisitResponse.payload).not.toContain('govuk-inset-text')
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
      method: 'GET',
      url: '/submission-01-animal-address?intent=new'
    })

    expect(animalAddressResponse.statusCode).toBe(200)
    expect(animalAddressResponse.payload).toMatch(
      /<select class="govuk-select[^"]*" id="animalAddressCounty" name="animalAddressCounty"/
    )
    expect(animalAddressResponse.request.response.source.context.animalAddressCountyOptions).toHaveLength(4)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetCounties')
  })

  test('renders account navigation on the client and animal address forms', async () => {
    for (const addressUrl of [
      '/submission-01-client-address?intent=new',
      '/submission-01-animal-address?intent=new'
    ]) {
      const response = await server.inject({ method: 'GET', url: addressUrl })

      expect(response.statusCode).toBe(200)
      expect(response.payload).toMatch(/>\s*My Account\s*<\/a>/)
      expect(response.payload).toMatch(/>\s*Sign out\s*<\/a>/)
    }
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
      url: '/submission-01-client-address?intent=new'
    })

    expect(newClientPage.statusCode).toBe(200)
    expect(newClientPage.payload).toContain('name="name"')
    expect(newClientPage.payload).toContain('name="addressLine1"')
    expect(newClientPage.payload).toContain('name="cph"')
    expect(newClientPage.payload).not.toContain('name="animalsAtClientAddress"')
    expect(newClientPage.payload).toMatch(/>\s*Save\s*</)
    expect(newClientPage.payload).toMatch(/govuk-button--secondary[^>]*name="intent"[^>]*value="cancel"[^>]*>Cancel</)

    const response = await server.inject({
      method: 'POST',
      url: '/submission-01-client-address',
      headers: { cookie: getCookieHeader(newClientPage) },
      payload: {
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
    expect(response.headers.location).toBe(url)
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
    expect(revisitResponse.payload).not.toContain('New client')
    expect(revisitResponse.payload).not.toContain('govuk-inset-text')
    expect(revisitResponse.payload).toContain(
      'data-default-value="Jane Smith, Green Farm, 1 Farm Lane, Village, Northshire, AB1 2CD, 48/234/2348"'
    )
    expect(revisitResponse.payload).toContain('href="/submission-01-client-address?intent=edit"')

    const continueResponse = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(response) },
      payload: { clientId: '' }
    })
    expect(continueResponse.statusCode).toBe(302)
    expect(continueResponse.headers.location).toBe('/submission-02-species')
    const continuedState = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(continueResponse) }
    })
    expect(continuedState.request.response.source.context.submissionFormState.formData.clientDetails).toMatchObject({
      name: 'Jane Smith',
      addressLine1: '1 Farm Lane',
      cph: '48/234/2348'
    })
  })

  test('shows a GOV.UK error when a manually entered client CPH has the wrong format', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/submission-01-client-address',
      payload: {
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

  test('shows client and animal-address CPH errors on the client details page', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '102',
        name: 'Green Acres',
        cph: '12/34/5678',
        animalAddressName: 'Second Site',
        animalAddressCph: '12-345-6789'
      }
    })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('href="#cph"')
    expect(response.payload).toContain('href="#animalAddressCph"')
    expect(response.request.response.source.context.clientDetails.cph).toBe('12/34/5678')
    expect(response.request.response.source.context.animalAddressDetails.cph).toBe('12-345-6789')
    expect(response.payload).toMatch(/data-animal-address-edit-button[^>]*hidden/)
  })

  test('canceling a new client address returns to the saved client selection', async () => {
    const selectedClient = await server.inject({
      method: 'POST',
      url,
      payload: { clientId: '101', animalsAtClientAddress: 'no' }
    })
    const startResponse = await server.inject({
      method: 'POST',
      url: '/submission-01-client-address/start',
      headers: { cookie: getCookieHeader(selectedClient) },
      payload: {
        clientId: '101',
        animalsAtClientAddress: 'no',
        animalAddressClientId: '102',
        intent: 'newClientAddress'
      }
    })
    expect(startResponse.statusCode).toBe(302)

    const cancelled = await server.inject({
      method: 'POST',
      url: '/submission-01-client-address',
      headers: { cookie: getCookieHeader(startResponse) },
      payload: { intent: 'cancel' }
    })
    expect(cancelled.statusCode).toBe(302)
    expect(cancelled.headers.location).toBe(url)

    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(cancelled) || getCookieHeader(startResponse) }
    })
    expect(revisitResponse.request.response.source.context.submissionFormState.formData.clientDetails).toMatchObject({
      clientId: '101',
      animalsAtClientAddress: 'no',
      animalAddressClientId: '102'
    })
  })

  test('shows a GOV.UK error when a manually entered animal address CPH has the wrong format', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/submission-01-animal-address',
      payload: {
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

  test('canceling an animal address returns to client details without saving it', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/submission-01-animal-address',
      payload: { intent: 'cancel' }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(url)
  })

  test('shows and saves separate manual client and animal address forms', async () => {
    const newClientPage = await server.inject({
      method: 'POST',
      url,
      payload: { intent: 'new' }
    })
    const animalAddressStart = await server.inject({
      method: 'POST',
      url: '/submission-01-animal-address/start',
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
    expect(animalAddressStart.statusCode).toBe(302)

    const animalAddressPage = await server.inject({
      method: 'GET',
      url: '/submission-01-animal-address?intent=new',
      headers: { cookie: getCookieHeader(animalAddressStart) }
    })

    expect(animalAddressPage.statusCode).toBe(200)
    expect(animalAddressPage.payload).toContain('name="animalAddressName"')
    expect(animalAddressPage.payload).toContain('name="animalAddressAddressLine1"')
    expect(animalAddressPage.payload.indexOf('name="animalAddressCph"')).toBeLessThan(
      animalAddressPage.payload.indexOf('name="animalAddressName"')
    )
    expect(animalAddressPage.payload).toMatch(
      /govuk-button--secondary[^>]*name="intent"[^>]*value="cancel"[^>]*>Cancel<\/button>/
    )
    expect(animalAddressPage.payload).not.toContain('name="cph"')

    const response = await server.inject({
      method: 'POST',
      url: '/submission-01-animal-address',
      headers: { cookie: getCookieHeader(animalAddressPage) || getCookieHeader(animalAddressStart) },
      payload: {
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
      animalAddressClientId: '',
      animalAddress: 'Second Site, Animal Farm, 2 Animal Road, Southshire, CD3 4EF, 49/345/3456',
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
    expect(revisitResponse.payload).toContain('Jane Smith')
    expect(revisitResponse.payload).toContain(
      'data-default-value="Second Site, Animal Farm, 2 Animal Road, Southshire, CD3 4EF, 49/345/3456"'
    )
    expect(revisitResponse.payload).toContain('data-manual-address="true"')
    expect(revisitResponse.payload).toMatch(/data-animal-address-edit-button data-manual-address="true"[^>]*>Edit<\/button>/)
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

    const editRedirect = await server.inject({
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
    expect(editRedirect.statusCode).toBe(302)
    const editResponse = await server.inject({
      method: 'GET',
      url: editRedirect.headers.location,
      headers: { cookie: getCookieHeader(editRedirect) }
    })
    expect(editResponse.statusCode).toBe(200)
    expect(editResponse.payload).toContain('Edit animal address')
    expect(editResponse.payload).toContain('value="Green Acres"')
    expect(editResponse.payload).toContain('value="2 Green Lane"')
    expect(editResponse.payload).toContain('value="22/222/2222"')
  })

  test('opens the edit form for a manually entered animal address', async () => {
    const saved = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '101',
        animalsAtClientAddress: 'no',
        animalAddress: '48/345/3456'
      }
    })
    const savedCookie = getCookieHeader(saved)
    const animalAddressSaved = await server.inject({
      method: 'POST',
      url: '/submission-01-animal-address',
      headers: { cookie: savedCookie },
      payload: {
        animalAddressName: 'Manual animal address',
        animalAddressFarmName: 'Animal Farm',
        animalAddressAddressLine1: '12 Animal Road',
        animalAddressCounty: 'Dorset',
        animalAddressPostcode: 'AB1 2CD',
        animalAddressCph: '48/345/3456'
      }
    })
    const revisitResponse = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(animalAddressSaved) }
    })
    const editResponse = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: getCookieHeader(animalAddressSaved) },
      payload: {
        clientId: '101',
        animalsAtClientAddress: 'no',
        animalAddressClientId: '',
        intent: 'editAnimalAddress'
      }
    })

    expect(revisitResponse.statusCode).toBe(200)
    expect(editResponse.statusCode).toBe(302)
    expect(editResponse.headers.location).toBe('/submission-01-animal-address?intent=edit')

    const editForm = await server.inject({
      method: 'GET',
      url: editResponse.headers.location,
      headers: { cookie: getCookieHeader(editResponse) }
    })
    expect(editForm.statusCode).toBe(200)
    expect(editForm.payload).toContain('Edit animal address')
    expect(editForm.payload).toContain('value="Manual animal address"')
    expect(editForm.payload).toContain('value="Animal Farm"')
    expect(editForm.payload).toContain('value="12 Animal Road"')
  })

  test('opens the manual animal-address form from its create link', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/submission-01-animal-address?intent=new'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('name="animalAddressName"')
    expect(response.payload).toContain('name="animalAddressAddressLine1"')
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
    expect(cancelled.payload).not.toContain('Selected client')
    expect(cancelled.payload).not.toContain('value="Unsaved change"')
  })

  test('GET client details redirects new-address intents to their address forms', async () => {
    const newAnimalAddress = await server.inject({
      method: 'GET',
      url: `${url}?intent=newAnimalAddress`
    })
    expect(newAnimalAddress.statusCode).toBe(302)
    expect(newAnimalAddress.headers.location).toBe('/submission-01-animal-address?intent=new')

    const newClientAddress = await server.inject({
      method: 'GET',
      url: `${url}?intent=new`
    })
    expect(newClientAddress.statusCode).toBe(302)
    expect(newClientAddress.headers.location).toBe('/submission-01-client-address?intent=new')
  })

  test('canceling animal-address entry returns to the client edit form', async () => {
    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        clientId: '102',
        intent: 'cancelAnimalAddress',
        manualClientEntry: 'yes',
        name: 'Green Acres'
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.request.response.source.context.editMode).toBe(true)
    expect(response.request.response.source.context.clientDetails.name).toBe('Green Acres')
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
