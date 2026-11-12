import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const typesWithNameIndex = new Set([
  'SPECIES',
  'SPECIES_ANIMAL_BREED',
  'SPECIES_ANIMAL_PURPOSE',
  'SPECIES_HOUSING'
])

const referenceItem = ({ type, code, description, order, index, ...attributes }) => {
  const speciesCode = attributes.speciesCode
  const itemCode = speciesCode ? `${speciesCode}#${code}` : code

  return {
    PK: `REF#${type}`,
    SK: `ORDER#${order}#${itemCode}`,
    type,
    code,
    description,
    index,
    GSI1PK: `CODE#${type}`,
    GSI1SK: code,
    ...(typesWithNameIndex.has(type)
      ? { GSI2PK: `NAME#${type}`, GSI2SK: description.toLowerCase() }
      : {}),
    ...attributes
  }
}

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
      if (command.input.IndexName === 'ByCode') {
        return {
          Items: command.input.ExpressionAttributeValues[':gsi1pk'] === 'CODE#SPECIES' &&
            command.input.ExpressionAttributeValues[':gsi1sk'] === 'CATTLE'
            ? [referenceItem({
                type: 'SPECIES',
                code: 'CATTLE',
                description: 'Cattle',
                order: '0001',
                index: 0,
                isAvian: false,
                isMammal: true,
                isRuminant: true,
                mostCommon: true
              })]
            : []
        }
      }

      const partition = command.input.ExpressionAttributeValues[':pk']
      const items = {
        'REF#SPECIES_ANIMAL_BREED': [
          referenceItem({
            type: 'SPECIES_ANIMAL_BREED',
            speciesCode: 'CATTLE',
            code: 'HOLSTEIN_FRIESIAN',
            description: 'Holstein Friesian',
            order: '0001',
            index: 1
          })
        ],
        'REF#SPECIES_ANIMAL_PURPOSE': [
          referenceItem({
            type: 'SPECIES_ANIMAL_PURPOSE',
            speciesCode: 'CATTLE',
            code: 'MILK',
            description: 'Dairy',
            order: '0001',
            index: 1,
            isAvian: false
          })
        ],
        'REF#SPECIES_HOUSING': [
          referenceItem({
            type: 'SPECIES_HOUSING',
            code: 'OUTDOOR',
            description: 'Outdoor',
            order: '0015',
            index: 15,
            isAvian: false
          }),
          referenceItem({
            type: 'SPECIES_HOUSING',
            code: 'BARN',
            description: 'Pen/Barns',
            order: '0001',
            index: 1,
            isAvian: true
          })
        ],
        'REF#SEX_GROUP': [
          referenceItem({
            type: 'SEX_GROUP',
            code: 'FEMALE',
            description: 'Female',
            order: '0002',
            index: 1,
            excludeAvian: true
          })
        ],
        'REF#AGE_CATEGORY': [
          referenceItem({
            type: 'AGE_CATEGORY',
            code: 'ADULT',
            description: 'Adult',
            order: '0012',
            index: 12,
            isAvian: false
          })
        ],
        'REF#ORGANIC_ENVIRONMENT': [
          referenceItem({
            type: 'ORGANIC_ENVIRONMENT',
            code: 'ORGANIC',
            description: 'Organic accreditation applies',
            order: '0001',
            index: 0,
            forAvianSpecies: false
          })
        ]
      }[partition]

      return { Items: items ?? [] }
    })

    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=CATTLE' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      speciesId: 'CATTLE',
      ageCategories: [{ value: 'ADULT', label: 'Adult' }],
      purposes: [{ value: 'MILK', label: 'Dairy' }],
      keepingTypes: [{ value: 'OUTDOOR', label: 'Outdoor' }],
      breeds: [{ value: 'HOLSTEIN_FRIESIAN', label: 'Holstein Friesian' }],
      sexes: [{ value: 'FEMALE', label: 'Female' }],
      organicAccreditationApplicable: true
    })
    expect(docClient.send.mock.calls.some(([command]) =>
      command.input.IndexName === 'ByCode' &&
      command.input.ExpressionAttributeValues[':gsi1pk'] === 'CODE#SPECIES' &&
      command.input.ExpressionAttributeValues[':gsi1sk'] === 'CATTLE'
    )).toBe(true)
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
