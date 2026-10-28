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

  test('renders common species as radios with an Other option revealing a species select', async () => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('2. Animal details')
    for (const name of ['Cattle', 'Sheep', 'Chicken', 'Pig', 'Turkey', 'Duck', 'Alpaca', 'Goat', 'Other']) {
      expect(response.payload).toMatch(new RegExp(`>\\s*${name}\\s*<`))
    }
    expect(response.payload).toContain('type="radio"')
    expect(response.payload).toContain('<form method="post" action="/submission-02-species"')
    expect(response.payload).toContain('Specify species')
    expect(response.payload).toContain('<option value="Llama">Llama</option>')
    expect(response.payload).toContain('No client name set')
  })

  test('AC1: persists a single common species with its id and redirects to animal details', async () => {
    const response = await post({ species: 'Sheep' })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-02-animal-details')
    const revisit = await getSaved(response)
    expect(savedAnimalDetails(revisit)).toEqual({ speciesId: '2', species: 'Sheep' })
    expect(revisit.payload).toMatch(/value="Sheep"\s+checked/)
  })

  test('AC1a/AC1b: persists a species chosen under Other and re-selects Other on return', async () => {
    const response = await post({ species: 'other', otherSpecies: 'Llama' })

    expect(response.statusCode).toBe(302)
    const revisit = await getSaved(response)
    expect(savedAnimalDetails(revisit)).toEqual({ speciesId: '20', species: 'Llama' })
    expect(revisit.payload).toMatch(/value="other"\s+checked/)
    expect(revisit.payload).toContain('data-default-value="Llama"')
  })

  test('AC1c: requires a species when Other is selected', async () => {
    const response = await post({ species: 'other', otherSpecies: '' })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('There is a problem')
    expect(response.payload).toContain('Specify the species')
  })

  test('rejects an Other species that is not in the available list', async () => {
    const response = await post({ species: 'other', otherSpecies: 'Dragon' })

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
    const failed = await post({ species: 'other' }, { cookie: getCookieHeader(saved) })
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
    const client = await server.inject({ method: 'POST', url: '/submission-01-client-details', payload: { clientId: '101' } })
    const response = await post({ species: 'Goat' }, { cookie: getCookieHeader(client) })
    const revisit = await getSaved(response)

    expect(revisit.request.response.source.context.submissionFormState.formData.clientDetails).toEqual({ clientId: '101' })
    expect(revisit.payload).toContain('Acme Farm')
    expect(revisit.payload).toContain('12/123/1234')
  })

  test('warns and blocks continuing when the species list cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch.mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetSpecies') return new Response('{}', { status: 500 })
      return new Response('[]', { status: 200 })
    })

    const page = await server.inject({ method: 'GET', url })
    expect(page.payload).toContain('full list of species could not be loaded')

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
