import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const url = '/submission-02-species'
const getCookieHeader = (response) => response.headers['set-cookie']?.[0]?.split(';')[0] || ''

const speciesList = [
  { speciesId: 1, name: 'Cattle' },
  { speciesId: 2, name: 'Sheep' },
  { speciesId: 3, name: 'Pig' },
  { speciesId: 4, name: 'Goat' },
  { speciesId: 20, name: 'Llama' },
  { speciesId: 21, name: 'Rabbit' }
]

describe('Submission species page', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    server = await createServer()
  })

  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetSpecies') {
        return new Response(JSON.stringify(speciesList), { status: 200 })
      }
      return new Response(JSON.stringify([
        { clientId: 101, name: 'Acme Farm', addressLine1: '1 Farm Road', postcode: 'L20 6EC', cph: '12/123/1234' }
      ]), { status: 200 })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  const post = (payload, headers = {}) => server.inject({ method: 'POST', url, payload, headers })
  const getSaved = (response) => server.inject({ method: 'GET', url, headers: { cookie: getCookieHeader(response) } })
  const savedAnimalDetails = (response) => response.request.response.source.context.submissionFormState.formData.animalDetails

  test('renders all available species in a select enhanced with autocomplete', async () => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('2. Animal details')
    expect(response.payload).toContain('<select class="govuk-select" id="species" name="species"')
    expect(response.payload).not.toContain('type="radio"')
    expect(response.payload).toContain('<form method="post" action="/submission-02-species"')
    expect(response.payload).toContain('<option value="Cattle">Cattle</option>')
    expect(response.payload).toContain('<option value="Llama">Llama</option>')
    expect(response.payload).toContain('href="/assets/css/accessible-autocomplete.min.css"')
    expect(response.payload).toContain('No client name set')
  })

  test('persists a selected species and redirects to animal details', async () => {
    const response = await post({ species: 'Sheep' })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-02-animal-details')
    const revisit = await getSaved(response)
    expect(savedAnimalDetails(revisit)).toEqual({ speciesId: '2', species: 'Sheep' })
    expect(revisit.payload).toMatch(/<option value="Sheep" selected>Sheep<\/option>/)
  })

  test('allows selecting any species in the backend list', async () => {
    const response = await post({ species: 'Llama' })

    expect(response.statusCode).toBe(302)
    const revisit = await getSaved(response)
    expect(savedAnimalDetails(revisit)).toEqual({ speciesId: '20', species: 'Llama' })
    expect(revisit.payload).toMatch(/<option value="Llama" selected>Llama<\/option>/)
  })

  test('rejects a species that is not in the available list', async () => {
    const response = await post({ species: 'Dragon' })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('Select a species from the list')
  })

  test('requires a species selection', async () => {
    const response = await post({})

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('Select a species')
  })

  test('does not save when validation fails and keeps previously saved species', async () => {
    const saved = await post({ species: 'Pig' })
    const failed = await post({ species: 'Dragon' }, { cookie: getCookieHeader(saved) })
    expect(failed.statusCode).toBe(400)

    const revisit = await server.inject({ method: 'GET', url, headers: { cookie: getCookieHeader(saved) } })
    expect(savedAnimalDetails(revisit).species).toBe('Pig')
  })

  test('replaces the saved species when it changes', async () => {
    const first = await post({ species: 'Cattle' })
    const changed = await post({ species: 'Goat' }, { cookie: getCookieHeader(first) })

    expect(savedAnimalDetails(await getSaved(changed))).toEqual({ speciesId: '4', species: 'Goat' })
  })

  test('preserves existing form state such as the selected client', async () => {
    const client = await server.inject({
      method: 'POST',
      url: '/submission-01-client-details',
      payload: {
        clientId: '101',
        name: 'Updated Client Name',
        farmName: 'Updated Farm',
        addressLine1: '2 Farm Road',
        addressLine2: 'New Village',
        addressLine3: '',
        county: 'Northshire',
        postcode: 'AB1 2CD',
        cph: '48/234/2348'
      }
    })
    globalThis.fetch.mockClear()
    const response = await post({ species: 'Goat' }, { cookie: getCookieHeader(client) })
    const revisit = await getSaved(response)

    expect(revisit.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      clientId: '101',
      cph: '48/234/2348',
      name: 'Updated Client Name',
      farmName: 'Updated Farm',
      addressLine1: '2 Farm Road',
      addressLine2: 'New Village',
      addressLine3: '',
      county: 'Northshire',
      postcode: 'AB1 2CD'
    })
    expect(revisit.payload).toContain('Updated Client Name')
    expect(revisit.payload).toContain('Updated Farm')
    expect(revisit.payload).toContain('2 Farm Road, New Village, Northshire, AB1 2CD')
    expect(revisit.payload).toContain('48/234/2348')
    expect(globalThis.fetch).not.toHaveBeenCalledWith('http://localhost:3200/GetClients')
  })

  test('shows manually entered client details on the species page', async () => {
    const manualEntry = await server.inject({
      method: 'POST',
      url: '/submission-01-client-details',
      payload: { intent: 'new' }
    })
    const clientDetails = await server.inject({
      method: 'POST',
      url: '/submission-01-client-details',
      headers: { cookie: getCookieHeader(manualEntry) },
      payload: {
        clientId: '',
        name: 'Jane Smith',
        farmName: 'Green Farm',
        addressLine1: '1 Farm Lane',
        addressLine2: 'Village',
        addressLine3: '',
        county: 'Northshire',
        postcode: 'AB1 2CD',
        cph: '48/234/2348',
        animalsAtClientAddress: 'yes'
      }
    })

    expect(clientDetails.statusCode).toBe(302)
    expect(clientDetails.headers.location).toBe('/submission-02-species')

    globalThis.fetch.mockClear()
    const response = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: getCookieHeader(clientDetails) }
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('Jane Smith')
    expect(response.payload).toContain('Green Farm')
    expect(response.payload).toContain('1 Farm Lane, Village, Northshire, AB1 2CD')
    expect(response.payload).toContain('48/234/2348')
    expect(response.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({
      name: 'Jane Smith',
      farmName: 'Green Farm',
      addressLine1: '1 Farm Lane',
      addressLine2: 'Village',
      addressLine3: '',
      county: 'Northshire',
      postcode: 'AB1 2CD',
      cph: '48/234/2348',
      animalsAtClientAddress: 'yes'
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetSpecies')
    expect(globalThis.fetch).not.toHaveBeenCalledWith('http://localhost:3200/GetClients')
  })

  test('warns and blocks continuing when the species list cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch.mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetSpecies') return new Response('{}', { status: 500 })
      return new Response('[]', { status: 200 })
    })

    const page = await server.inject({ method: 'GET', url })
    expect(page.payload).toContain('The list of species could not be loaded. Try again later.')

    const response = await post({ species: 'Cattle' })
    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('The species list is unavailable')
  })

  test('shows an explicit error when client details cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch.mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetSpecies') {
        return new Response(JSON.stringify(speciesList), { status: 200 })
      }
      return new Response('{}', { status: 500 })
    })

    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(502)
    expect(response.payload).toContain('Client details could not be loaded')
    expect(response.payload).toContain('Client details unavailable')
    expect(response.payload).not.toContain('No client name set')
  })
})
