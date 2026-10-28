import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const url = '/submission-02-animal-details'
const getCookieHeader = (response) => response.headers['set-cookie']?.[0]?.split(';')[0] || ''

const sheepDetails = {
  speciesId: '2',
  ageCategories: [{ value: 'lamb', label: 'Lamb' }, { value: 'adult', label: 'Adult' }],
  purposes: [{ value: 'meat', label: 'Meat' }, { value: 'wool', label: 'Wool' }],
  keepingTypes: [{ value: 'outdoor', label: 'Outdoor' }],
  breeds: [{ value: 'texel', label: 'Texel' }],
  sexes: [{ value: 'ewe', label: 'Ewe' }, { value: 'ram', label: 'Ram' }],
  organicAccreditationApplicable: true
}

const goatDetails = {
  speciesId: '4',
  ageCategories: [{ value: 'kid', label: 'Kid' }],
  purposes: [{ value: 'milk', label: 'Milk' }],
  keepingTypes: [],
  breeds: [],
  sexes: [],
  organicAccreditationApplicable: false
}

describe('Submission animal details page', () => {
  let server
  let detailsResponses

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    server = await createServer()
  })

  beforeEach(() => {
    detailsResponses = { 2: sheepDetails, 4: goatDetails }
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetSpecies') {
        return new Response(JSON.stringify([
          { speciesId: 2, name: 'Sheep' },
          { speciesId: 4, name: 'Goat' }
        ]), { status: 200 })
      }
      const match = /GetAnimalDetails\?speciesId=(\d+)/.exec(requestUrl)
      if (match) {
        return new Response(JSON.stringify(detailsResponses[match[1]]), { status: 200 })
      }
      return new Response('[]', { status: 200 })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  // Yar stores session state in the cookie, so each session tracks its latest cookie.
  const sessions = new WeakMap()
  const track = (session, response) => {
    const cookie = getCookieHeader(response)
    if (cookie) sessions.set(session, cookie)
    return response
  }
  const selectSpecies = async (species) => {
    const session = {}
    const response = await server.inject({ method: 'POST', url: '/submission-02-species', payload: { species } })
    track(session, response)
    return session
  }
  const get = async (session) => track(session, await server.inject({
    method: 'GET',
    url,
    headers: { cookie: sessions.get(session) }
  }))
  const post = async (session, payload) => track(session, await server.inject({
    method: 'POST',
    url,
    payload,
    headers: { cookie: sessions.get(session) }
  }))
  const saved = (response) => response.request.response.source.context.submissionFormState.formData.animalDetails

  test('redirects to the species page when no species has been chosen', async () => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-02-species')
    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('GetAnimalDetails'))
  })

  test('redirects POST to the species page when no species has been chosen', async () => {
    const response = await server.inject({ method: 'POST', url, payload: {} })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-02-species')
  })

  test('AC2: loads options from the backend using the saved speciesId and renders them for the species', async () => {
    const selection = await selectSpecies('Sheep')
    const response = await get(selection)

    expect(response.statusCode).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetAnimalDetails?speciesId=2')
    expect(response.payload).toContain('2. Animal details')
    expect(response.payload).toContain('href="/submission-02-species"')
    for (const label of ['Lamb', 'Adult', 'Meat', 'Wool', 'Outdoor', 'Texel', 'Ewe', 'Ram', 'accredited organic', 'In transition', 'Number of animals']) {
      expect(response.payload).toContain(label)
    }
  })

  test('AC2: shows only the fields and options the species supports', async () => {
    const selection = await selectSpecies('Goat')
    const response = await get(selection)

    expect(response.payload).toContain('Kid')
    expect(response.payload).toContain('Milk')
    expect(response.payload).not.toContain('Lamb')
    expect(response.payload).not.toContain('Where are they kept')
    expect(response.payload).not.toContain('Breed')
    expect(response.payload).not.toContain('Sex (optional)')
    expect(response.payload).not.toContain('accredited organic')
  })

  test('AC3/AC5: optional fields can be left blank', async () => {
    const selection = await selectSpecies('Sheep')
    const response = await post(selection, { ageCategory: 'lamb', purpose: 'meat', numberOfAnimals: '1' })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(url)
    expect(saved(await get(selection))).toEqual({
      speciesId: '2',
      species: 'Sheep',
      numberOfAnimals: 1,
      ageCategory: 'lamb',
      purpose: 'meat'
    })
  })

  test('requires age category and purpose when the species offers them', async () => {
    const selection = await selectSpecies('Sheep')
    const response = await post(selection, {})

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('Select the age category')
    expect(response.payload).toContain('Select the purpose')
  })

  test('does not require age category or purpose when the species has none', async () => {
    detailsResponses[2] = { speciesId: '2' }
    const selection = await selectSpecies('Sheep')

    expect((await post(selection, {})).statusCode).toBe(302)
  })

  test('renders age as categories only, with no age detail fields', async () => {
    const response = await get(await selectSpecies('Sheep'))

    expect(response.payload).not.toContain('Age detail')
    expect(response.payload).not.toContain('ageUnit')
  })

  test('persists chosen values and restores them on return', async () => {
    const selection = await selectSpecies('Sheep')
    const response = await post(selection, {
      ageCategory: 'lamb',
      purpose: 'meat',
      keepingType: 'outdoor',
      breed: 'texel',
      sex: 'ewe',
      organicAccreditation: 'in-transition',
      numberOfAnimals: '3',
      animalId1: ' UK123 ',
      animalId2: '',
      animalId3: 'UK125',
      animalId4: 'ignored'
    })
    expect(response.statusCode).toBe(302)

    const revisit = await get(selection)
    expect(saved(revisit)).toEqual({
      speciesId: '2',
      species: 'Sheep',
      numberOfAnimals: 3,
      animalIds: ['UK123', '', 'UK125'],
      ageCategory: 'lamb',
      purpose: 'meat',
      keepingType: 'outdoor',
      breed: 'texel',
      sex: 'ewe',
      organicAccreditation: 'in-transition'
    })
    expect(revisit.payload).toMatch(/value="lamb"\s+checked/)
    expect(revisit.payload).toMatch(/value="meat"\s+checked/)
    expect(revisit.payload).toMatch(/value="in-transition"\s+checked/)
    expect(revisit.payload).toMatch(/value="3"\s+selected/)
    expect(revisit.payload).toContain('value="UK125"')
  })

  test.each([
    [{ ageCategory: 'foal', purpose: 'meat' }, 'Select a valid age category'],
    [{ ageCategory: 'lamb', purpose: 'racing' }, 'Select a valid purpose'],
    [{ ageCategory: 'lamb', purpose: 'meat', keepingType: 'indoor' }, 'Select a valid option for where the animals are kept'],
    [{ ageCategory: 'lamb', purpose: 'meat', breed: 'unknown' }, 'Select a valid breed'],
    [{ ageCategory: 'lamb', purpose: 'meat', sex: 'gelding' }, 'Select a valid sex'],
    [{ ageCategory: 'lamb', purpose: 'meat', organicAccreditation: 'maybe' }, 'Select a valid option for organic accreditation'],
    [{ ageCategory: 'lamb', purpose: 'meat', numberOfAnimals: '11' }, 'Select a number of animals from 1 to 10'],
    [{ ageCategory: 'lamb', purpose: 'meat', numberOfAnimals: 'x' }, 'Select a number of animals from 1 to 10'],
    [{ ageCategory: 'lamb', purpose: 'meat', animalId1: 'x'.repeat(51) }, 'Animal 1 ID must be 50 characters or fewer']
  ])('rejects invalid input %j', async (payload, message) => {
    const selection = await selectSpecies('Sheep')
    const response = await post(selection, payload)

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('There is a problem')
    expect(response.payload).toContain(message)
  })

  test('does not accept organic accreditation for a species where it does not apply', async () => {
    const selection = await selectSpecies('Goat')
    const response = await post(selection, { ageCategory: 'kid', purpose: 'milk', organicAccreditation: 'yes' })

    expect(response.statusCode).toBe(400)
  })

  test('keeps submitted values and does not save when validation fails', async () => {
    const selection = await selectSpecies('Sheep')
    await post(selection, { purpose: 'meat', ageCategory: 'lamb' })
    const response = await post(selection, { purpose: 'wool', ageCategory: 'foal' })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toMatch(/value="wool"\s+checked/)
    expect(saved(await get(selection)).purpose).toBe('meat')
  })

  test('discards species-dependent answers when the species changes', async () => {
    const selection = await selectSpecies('Sheep')
    await post(selection, { purpose: 'meat', ageCategory: 'lamb', sex: 'ewe' })
    track(selection, await server.inject({
      method: 'POST',
      url: '/submission-02-species',
      payload: { species: 'Goat' },
      headers: { cookie: sessions.get(selection) }
    }))

    expect(saved(await get(selection))).toEqual({ speciesId: '4', species: 'Goat' })
  })

  test('shows an error and does not save when animal details cannot be loaded', async () => {
    const selection = await selectSpecies('Sheep')
    jest.spyOn(console, 'error').mockImplementation(() => {})
    detailsResponses = {}
    globalThis.fetch.mockImplementation(async () => new Response('{}', { status: 500 }))

    const page = await get(selection)
    expect(page.statusCode).toBe(502)
    expect(page.payload).toContain('could not be loaded')
    expect(page.payload).not.toContain('<form')

    const submit = await post(selection, { purpose: 'meat' })
    expect(submit.statusCode).toBe(502)
  })

  test('shows an explicit error when client details cannot be loaded', async () => {
    const selection = await selectSpecies('Sheep')
    jest.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch.mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetAnimalDetails?speciesId=2') {
        return new Response(JSON.stringify(sheepDetails), { status: 200 })
      }
      return new Response('{}', { status: 500 })
    })

    const response = await get(selection)

    expect(response.statusCode).toBe(502)
    expect(response.payload).toContain('Client details could not be loaded')
    expect(response.payload).toContain('Client details unavailable')
    expect(response.payload).not.toContain('No client name set')
    expect(response.payload).toContain('<form')
  })

  test('treats a response without option lists as having no optional fields', async () => {
    detailsResponses[2] = { speciesId: '2' }
    const selection = await selectSpecies('Sheep')
    const response = await get(selection)

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('Continue')
    expect(response.payload).not.toContain('Age category')
  })
})
