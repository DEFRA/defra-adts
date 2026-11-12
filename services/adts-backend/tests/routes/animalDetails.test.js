import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('GET /GetAnimalDetails', () => {
  let server
  const docClient = { send: jest.fn() }

  beforeAll(async () => {
    process.env.PORT = '3200'
    server = await createServer({ docClient })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('returns species animal options in the UI contract shape from the seed schema', async () => {
    docClient.send.mockImplementation(async (command) => {
      const partition = command.input.ExpressionAttributeValues[':pk']
      const items = {
        'REF#SPECIES': [
          { code: 'CATTLE', description: 'Cattle', isAvian: false }
        ],
        'REF#SPECIES_ANIMAL_BREED': [
          { speciesCode: 'CATTLE', code: 'HOLSTEIN', description: 'Holstein' }
        ],
        'REF#SPECIES_ANIMAL_PURPOSE': [
          { speciesCode: 'CATTLE', code: 'DAIRY', description: 'Dairy' }
        ],
        'REF#SPECIES_HOUSING': [
          { code: 'OUTDOOR', description: 'Outdoor', isAvian: false },
          { code: 'AVIARY', description: 'Aviary', isAvian: true },
          { code: 'NOT-CATTLE', description: 'Not for cattle', excludeSpeciesLimsCodes: ['CATTLE'] }
        ],
        'REF#SEX_GROUP': [{ code: 'FEMALE', description: 'Female', excludeAvian: true }],
        'REF#AGE_CATEGORY': [{ code: 'ADULT', description: 'Adult', isAvian: false }],
        'REF#ORGANIC_ENVIRONMENT': [
          { code: 'ORGANIC', description: 'Organic', forAvianSpecies: false }
        ]
      }[partition]

      return { Items: items ?? [] }
    })

    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=CATTLE' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      speciesId: 'CATTLE',
      ageCategories: [{ value: 'ADULT', label: 'Adult' }],
      purposes: [{ value: 'DAIRY', label: 'Dairy' }],
      keepingTypes: [{ value: 'OUTDOOR', label: 'Outdoor' }],
      breeds: [{ value: 'HOLSTEIN', label: 'Holstein' }],
      sexes: [{ value: 'FEMALE', label: 'Female' }],
      organicAccreditationApplicable: true
    })
    expect(docClient.send.mock.calls.map(([command]) =>
      command.input.ExpressionAttributeValues[':pk']
    )).toContain('REF#SPECIES_ANIMAL_BREED')
  })

  test('rejects a request without speciesId', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails' })

    expect(response.statusCode).toBe(400)
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('returns not found for an unknown species', async () => {
    docClient.send.mockResolvedValue({ Items: [] })

    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=UNKNOWN' })

    expect(response.statusCode).toBe(404)
    expect(response.result).toEqual({ error: 'Species not found' })
  })

  test('returns a gateway error when DynamoDB fails', async () => {
    docClient.send.mockRejectedValue(new Error('connect ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=CATTLE' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve animal details' })
  })
})
