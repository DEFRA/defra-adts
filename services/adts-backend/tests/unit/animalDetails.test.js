import { describe, expect, jest, test } from '@jest/globals'
import { getAnimalDetails } from '../../src/data/animalDetails.js'

const createDocClient = (partitions) => {
  const pages = new Map()
  const send = jest.fn(async (command) => {
    const partition = command.input.ExpressionAttributeValues[':pk']
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
      'REF#SPECIES': [
        {
          Items: [{ code: 'CATTLE', description: 'Cattle', isAvian: false }],
          LastEvaluatedKey: { PK: 'REF#SPECIES', SK: 'next' }
        },
        { Items: [{ code: '123', description: 'Bird', isAvian: true }] }
      ],
      'REF#SPECIES_ANIMAL_BREEDS#SPECIES#123': [
        {
          Items: [{ code: 'BREED-1', description: 'First breed' }],
          LastEvaluatedKey: { PK: 'REF#SPECIES_ANIMAL_BREEDS#SPECIES#123', SK: 'next' }
        },
        { Items: [{ code: 'BREED-2', description: 'Second breed' }] }
      ],
      'REF#SPECIES_ANIMAL_PURPOSES#SPECIES#123': {
        Items: [{ code: 'PURPOSE', description: 'Purpose' }]
      },
      'REF#SPECIES_HOUSINGS': {
        Items: [
          { code: 'AVIARY', description: 'Aviary', forAvianSpecies: true },
          { code: 'HOUSED', description: 'Housed', forAvianSpecies: false },
          { code: 'EXCLUDED', description: 'Excluded', excludeSpeciesLimsCodes: ['123'] },
          { code: 'GENERAL', name: 'General' }
        ]
      },
      'REF#SEX_GROUPS': {
        Items: [
          { code: 'FEMALE', description: 'Female' },
          { code: 'NO-LABEL' },
          { description: 'No code' },
          { code: 'INVALID-LABEL', description: 12 }
        ]
      },
      'REF#AGE_CATEGORIES': {
        Items: [
          { code: 'CHICK', description: 'Chick', forAvianSpecies: true },
          { code: 'CALF', description: 'Calf', forAvianSpecies: false }
        ]
      },
      'REF#ORGANIC_ENVIRONMENT': {}
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
      sexes: [{ value: 'FEMALE', label: 'Female' }],
      organicAccreditationApplicable: false
    })
    const speciesPageCall = docClient.send.mock.calls.find(([command]) =>
      command.input.ExpressionAttributeValues[':pk'] === 'REF#SPECIES' &&
      command.input.ExclusiveStartKey
    )
    expect(speciesPageCall[0].input.ExclusiveStartKey).toEqual({
      PK: 'REF#SPECIES',
      SK: 'next'
    })
    const breedPageCall = docClient.send.mock.calls.find(([command]) =>
      command.input.ExpressionAttributeValues[':pk'] === 'REF#SPECIES_ANIMAL_BREEDS#SPECIES#123' &&
      command.input.ExclusiveStartKey
    )
    expect(breedPageCall[0].input.ExclusiveStartKey).toEqual({
      PK: 'REF#SPECIES_ANIMAL_BREEDS#SPECIES#123',
      SK: 'next'
    })
    expect(docClient.pages.has('REF#SPECIES_ANIMAL_BREEDS')).toBe(false)
    expect(docClient.pages.has('REF#SPECIES_ANIMAL_PURPOSES#AVIAN#1')).toBe(false)
  })

  test('uses avian and generic fallback partitions when species options are absent', async () => {
    const docClient = createDocClient({
      'REF#SPECIES': { Items: [{ code: 'CHICKEN', description: 'Chicken', isAvian: true }] },
      'REF#SPECIES_ANIMAL_BREEDS#SPECIES#CHICKEN': { Items: [] },
      'REF#SPECIES_ANIMAL_BREEDS': { Items: [{ code: 'BIRD-BREED', description: 'Bird breed' }] },
      'REF#SPECIES_ANIMAL_PURPOSES#SPECIES#CHICKEN': { Items: [] },
      'REF#SPECIES_ANIMAL_PURPOSES#AVIAN#1': { Items: [] },
      'REF#SPECIES_ANIMAL_PURPOSES': {
        Items: [
          { code: 'AVIAN-PURPOSE', description: 'Avian purpose', forAvianSpecies: true },
          { code: 'MAMMAL-PURPOSE', description: 'Mammal purpose', forAvianSpecies: false }
        ]
      },
      'REF#SPECIES_HOUSINGS': {},
      'REF#SEX_GROUPS': {},
      'REF#AGE_CATEGORIES': {},
      'REF#ORGANIC_ENVIRONMENT': {}
    })

    const details = await getAnimalDetails(docClient, 'CHICKEN')

    expect(details).toEqual({
      speciesId: 'CHICKEN',
      ageCategories: [],
      purposes: [{ value: 'AVIAN-PURPOSE', label: 'Avian purpose' }],
      keepingTypes: [],
      breeds: [{ value: 'BIRD-BREED', label: 'Bird breed' }],
      sexes: [],
      organicAccreditationApplicable: false
    })
    expect(docClient.pages.has('REF#SPECIES_ANIMAL_BREEDS')).toBe(true)
    expect(docClient.pages.has('REF#SPECIES_ANIMAL_PURPOSES')).toBe(true)
  })

  test('returns undefined when the species partition has no matching species', async () => {
    const docClient = createDocClient({
      'REF#SPECIES': { Items: [{ code: 'CATTLE', description: 'Cattle' }] }
    })

    await expect(getAnimalDetails(docClient, 'UNKNOWN')).resolves.toBeUndefined()
    expect(docClient.send).toHaveBeenCalledTimes(1)
  })

  test('returns empty lists when the species has no configured reference options', async () => {
    const docClient = createDocClient({
      'REF#SPECIES': { Items: [{ code: 'CATTLE', description: 'Cattle' }] }
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
    expect(docClient.pages.get('REF#SPECIES_ANIMAL_BREEDS')).toBe(1)
    expect(docClient.pages.get('REF#SPECIES_ANIMAL_PURPOSES#AVIAN#0')).toBe(1)
    expect(docClient.pages.get('REF#SPECIES_ANIMAL_PURPOSES')).toBe(1)
  })
})
