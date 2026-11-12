import { describe, expect, jest, test } from '@jest/globals'
import { getAnimalDetails } from '../../src/data/animalDetails.js'

const createDocClient = (partitions) => {
  const pages = new Map()
  const send = jest.fn(async (command) => {
    const partition = command.input.IndexName === 'ByCode'
      ? command.input.ExpressionAttributeValues[':gsi1sk']
      : command.input.ExpressionAttributeValues[':pk']
    const pageIndex = pages.get(partition) ?? 0
    pages.set(partition, pageIndex + 1)

    const partitionPages = partitions[partition]
    return (Array.isArray(partitionPages) ? partitionPages[pageIndex] : partitionPages) ?? {}
  })

  return { send, pages }
}

describe('getAnimalDetails', () => {
  test('maps species-specific options, filters applicability, and follows pagination', async () => {
    const docClient = createDocClient({
      '123': { Items: [{ code: '123', description: 'Bird', isAvian: true }] },
      'REF#SPECIES_ANIMAL_BREED': [
        {
          Items: [
            { speciesCode: '123', code: 'BREED-1', description: 'First breed' },
            { speciesCode: '456', code: 'OTHER-BREED', description: 'Other breed' }
          ],
          LastEvaluatedKey: { PK: 'REF#SPECIES_ANIMAL_BREED', SK: 'next' }
        },
        { Items: [{ speciesCode: '123', code: 'BREED-2', description: 'Second breed' }] }
      ],
      'REF#SPECIES_ANIMAL_PURPOSE': {
        Items: [{ speciesCode: '123', code: 'PURPOSE', description: 'Purpose', isAvian: true }]
      },
      'REF#SPECIES_HOUSING': {
        Items: [
          { code: 'AVIARY', description: 'Aviary', isAvian: true },
          { code: 'HOUSED', description: 'Housed', isAvian: false },
          { code: 'EXCLUDED', description: 'Excluded', excludeSpeciesLimsCodes: ['123'] },
          { code: 'GENERAL', name: 'General' }
        ]
      },
      'REF#SEX_GROUP': {
        Items: [
          { code: 'FEMALE', description: 'Female', excludeAvian: true },
          { code: 'CASTRATE', description: 'Castrate', excludeAvian: false },
          { code: 'NO-LABEL' },
          { description: 'No code' },
          { code: 'INVALID-LABEL', description: 12 }
        ]
      },
      'REF#AGE_CATEGORY': {
        Items: [
          { code: 'CHICK', description: 'Chick', isAvian: true },
          { code: 'CALF', description: 'Calf', isAvian: false }
        ]
      },
      'REF#ORGANIC_ENVIRONMENT': {
        Items: [{ code: 'ORGANIC', description: 'Organic', forAvianSpecies: false }]
      }
    })

    const details = await getAnimalDetails(docClient, '123')

    expect(details).toEqual({
      speciesId: '123',
      ageCategories: [{ value: 'CHICK', label: 'Chick' }],
      purposes: [{ value: 'PURPOSE', label: 'Purpose' }],
      keepingTypes: [
        { value: 'AVIARY', label: 'Aviary' },
        { value: 'GENERAL', label: 'General' }
      ],
      breeds: [
        { value: 'BREED-1', label: 'First breed' },
        { value: 'BREED-2', label: 'Second breed' }
      ],
      sexes: [{ value: 'CASTRATE', label: 'Castrate' }],
      organicAccreditationApplicable: false
    })
    const speciesLookupCall = docClient.send.mock.calls.find(([command]) =>
      command.input.IndexName === 'ByCode'
    )
    expect(speciesLookupCall[0].input.KeyConditionExpression).toBe(
      'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk'
    )
    expect(speciesLookupCall[0].input.ExpressionAttributeValues).toEqual({
      ':gsi1pk': 'CODE#SPECIES',
      ':gsi1sk': '123'
    })
    const breedPageCall = docClient.send.mock.calls.find(([command]) =>
      command.input.ExpressionAttributeValues[':pk'] === 'REF#SPECIES_ANIMAL_BREED' &&
      command.input.ExclusiveStartKey
    )
    expect(breedPageCall[0].input.ExclusiveStartKey).toEqual({
      PK: 'REF#SPECIES_ANIMAL_BREED',
      SK: 'next'
    })
  })

  test('filters option partitions by species and avian applicability', async () => {
    const docClient = createDocClient({
      CHICKEN: { Items: [{ code: 'CHICKEN', description: 'Chicken', isAvian: true }] },
      'REF#SPECIES_ANIMAL_BREED': {
        Items: [
          { speciesCode: 'CHICKEN', code: 'BIRD-BREED', description: 'Bird breed' },
          { speciesCode: 'SHEEP', code: 'SHEEP-BREED', description: 'Sheep breed' }
        ]
      },
      'REF#SPECIES_ANIMAL_PURPOSE': {
        Items: [
          { speciesCode: 'CHICKEN', code: 'AVIAN-PURPOSE', description: 'Avian purpose', isAvian: true },
          { speciesCode: 'CATTLE', code: 'MAMMAL-PURPOSE', description: 'Mammal purpose', isAvian: false }
        ]
      },
      'REF#SPECIES_HOUSING': {
        Items: [
          { code: 'AVIARY', description: 'Aviary', isAvian: true },
          { code: 'HOUSED', description: 'Housed', isAvian: false }
        ]
      },
      'REF#SEX_GROUP': {
        Items: [
          { code: 'FEMALE', description: 'Female', excludeAvian: true },
          { code: 'CASTRATE', description: 'Castrate', excludeAvian: false }
        ]
      },
      'REF#AGE_CATEGORY': {
        Items: [
          { code: 'CHICK', description: 'Chick', isAvian: true },
          { code: 'CALF', description: 'Calf', isAvian: false }
        ]
      },
      'REF#ORGANIC_ENVIRONMENT': {}
    })

    const details = await getAnimalDetails(docClient, 'CHICKEN')

    expect(details).toEqual({
      speciesId: 'CHICKEN',
      ageCategories: [{ value: 'CHICK', label: 'Chick' }],
      purposes: [{ value: 'AVIAN-PURPOSE', label: 'Avian purpose' }],
      keepingTypes: [{ value: 'AVIARY', label: 'Aviary' }],
      breeds: [{ value: 'BIRD-BREED', label: 'Bird breed' }],
      sexes: [{ value: 'CASTRATE', label: 'Castrate' }],
      organicAccreditationApplicable: false
    })
  })

  test('returns undefined when the species code is not found', async () => {
    const docClient = createDocClient({
      CATTLE: { Items: [{ code: 'CATTLE', description: 'Cattle' }] }
    })

    await expect(getAnimalDetails(docClient, 'UNKNOWN')).resolves.toBeUndefined()
    expect(docClient.send).toHaveBeenCalledTimes(1)
  })

  test('returns empty lists when the species has no configured reference options', async () => {
    const docClient = createDocClient({
      CATTLE: { Items: [{ code: 'CATTLE', description: 'Cattle' }] }
    })

    await expect(getAnimalDetails(docClient, 'CATTLE')).resolves.toEqual({
      speciesId: 'CATTLE',
      ageCategories: [],
      purposes: [],
      keepingTypes: [],
      breeds: [],
      sexes: [],
      organicAccreditationApplicable: false
    })
    expect(docClient.pages.get('REF#SPECIES_ANIMAL_BREED')).toBe(1)
    expect(docClient.pages.get('REF#SPECIES_ANIMAL_PURPOSE')).toBe(1)
    expect(docClient.pages.get('REF#SPECIES_HOUSING')).toBe(1)
    expect(docClient.pages.get('REF#SEX_GROUP')).toBe(1)
    expect(docClient.pages.get('REF#AGE_CATEGORY')).toBe(1)
  })
})
