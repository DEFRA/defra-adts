import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
})

describe('Species and animal details routes', () => {
  let server

  beforeAll(async () => {
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('GetSpecies normalises ids to strings and drops malformed entries', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      { speciesId: 1, name: 'Cattle', extra: 'ignored' },
      { speciesId: 2 },
      null
    ]))

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3100/GetSpecies')
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([{ speciesId: '1', name: 'Cattle' }])
  })

  test('GetAnimalDetails forwards speciesId and returns the normalised contract', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      ageCategories: [{ value: 1, label: 'Calf' }, { value: 2 }],
      purposes: [{ value: 'dairy', label: 'Dairy' }],
      sexes: [{ value: 'f', label: 'Female' }],
      organicAccreditationApplicable: true
    }))

    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=1' })

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3100/GetAnimalDetails?speciesId=1')
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      speciesId: '1',
      ageCategories: [{ value: '1', label: 'Calf' }],
      purposes: [{ value: 'dairy', label: 'Dairy' }],
      keepingTypes: [],
      breeds: [],
      sexes: [{ value: 'f', label: 'Female' }],
      organicAccreditationApplicable: true
    })
  })

  test('GetAnimalDetails requires a speciesId', async () => {
    jest.spyOn(globalThis, 'fetch')

    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails' })

    expect(response.statusCode).toBe(400)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test.each(['/GetSpecies', '/GetAnimalDetails?speciesId=1'])('%s preserves a downstream error status', async (url) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Not found' }, 404))

    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(404)
    expect(response.result).toEqual({ error: 'Not found' })
  })

  test.each(['/GetSpecies', '/GetAnimalDetails?speciesId=1'])('%s returns a gateway error for unusable downstream data', async (url) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse('not-valid-shape'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(502)
  })

  test('returns a gateway error when the submissions service cannot be reached', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(502)
  })
})
