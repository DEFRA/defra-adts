import { describe, expect, jest, test } from '@jest/globals'
import { getAnimalDetails } from '../../src/data/animalDetails.js'

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
      123: {
        Items: [referenceItem({
          type: 'SPECIES',
          code: '123',
          description: 'Bird',
          order: '0001',
          index: 0,
          isAvian: true,
          isMammal: false,
          isRuminant: false,
          mostCommon: true
        })]
      },
      'REF#SPECIES_ANIMAL_BREED': [
        {
          Items: [
            referenceItem({
              type: 'SPECIES_ANIMAL_BREED',
              speciesCode: '123',
              code: 'BREED-1',
              description: 'First breed',
              order: '0001',
              index: 1
            }),
            referenceItem({
              type: 'SPECIES_ANIMAL_BREED',
              speciesCode: '456',
              code: 'OTHER-BREED',
              description: 'Other breed',
              order: '0002',
              index: 2
            })
          ],
          LastEvaluatedKey: {
            PK: 'REF#SPECIES_ANIMAL_BREED',
            SK: 'ORDER#0002#456#OTHER-BREED'
          }
        },
        {
          Items: [referenceItem({
            type: 'SPECIES_ANIMAL_BREED',
            speciesCode: '123',
            code: 'BREED-2',
            description: 'Second breed',
            order: '0003',
            index: 3
          })]
        }
      ],
      'REF#SPECIES_ANIMAL_PURPOSE': {
        Items: [referenceItem({
          type: 'SPECIES_ANIMAL_PURPOSE',
          speciesCode: '123',
          code: 'PURPOSE',
          description: 'Purpose',
          order: '0001',
          index: 1,
          isAvian: true
        })]
      },
      'REF#SPECIES_HOUSING': {
        Items: [
          referenceItem({
            type: 'SPECIES_HOUSING',
            code: 'BARN',
            description: 'Pen/Barns',
            order: '0001',
            index: 1,
            isAvian: true
          }),
          referenceItem({
            type: 'SPECIES_HOUSING',
            code: 'HOUSED',
            description: 'Housed',
            order: '0002',
            index: 2,
            isAvian: false
          })
        ]
      },
      'REF#SEX_GROUP': {
        Items: [
          referenceItem({
            type: 'SEX_GROUP',
            code: 'FEMALE',
            description: 'Female',
            order: '0002',
            index: 1,
            excludeAvian: true
          }),
          referenceItem({
            type: 'SEX_GROUP',
            code: 'CASTRATE',
            description: 'Castrate',
            order: '0001',
            index: 0,
            excludeAvian: false
          })
        ]
      },
      'REF#AGE_CATEGORY': {
        Items: [
          referenceItem({
            type: 'AGE_CATEGORY',
            code: '0-3',
            description: '0-3 Days',
            order: '0001',
            index: 1,
            isAvian: true
          }),
          referenceItem({
            type: 'AGE_CATEGORY',
            code: 'NEONATAL',
            description: 'Neonatal (1 week old or less)',
            order: '0009',
            index: 9,
            isAvian: false
          })
        ]
      },
      'REF#ORGANIC_ENVIRONMENT': {
        Items: [referenceItem({
          type: 'ORGANIC_ENVIRONMENT',
          code: 'ORGANIC',
          description: 'Organic',
          order: '0001',
          index: 0,
          forAvianSpecies: false
        })]
      }
    })

    const details = await getAnimalDetails(docClient, '123')

    expect(details).toEqual({
      speciesId: '123',
      ageCategories: [{ value: '0-3', label: '0-3 Days' }],
      purposes: [{ value: 'PURPOSE', label: 'Purpose' }],
      keepingTypes: [{ value: 'BARN', label: 'Pen/Barns' }],
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
      SK: 'ORDER#0002#456#OTHER-BREED'
    })
  })

  test('filters option partitions by species and avian applicability', async () => {
    const docClient = createDocClient({
      CHICKEN: {
        Items: [referenceItem({
          type: 'SPECIES',
          code: 'CHICKEN',
          description: 'Chicken',
          order: '0003',
          index: 2,
          isAvian: true,
          isMammal: false,
          isRuminant: false,
          mostCommon: true
        })]
      },
      'REF#SPECIES_ANIMAL_BREED': {
        Items: [
          referenceItem({
            type: 'SPECIES_ANIMAL_BREED',
            speciesCode: 'CHICKEN',
            code: 'BIRD-BREED',
            description: 'Bird breed',
            order: '0001',
            index: 1
          }),
          referenceItem({
            type: 'SPECIES_ANIMAL_BREED',
            speciesCode: 'SHEEP',
            code: 'SHEEP-BREED',
            description: 'Sheep breed',
            order: '0002',
            index: 2
          })
        ]
      },
      'REF#SPECIES_ANIMAL_PURPOSE': {
        Items: [
          referenceItem({
            type: 'SPECIES_ANIMAL_PURPOSE',
            speciesCode: 'CHICKEN',
            code: 'AVIAN-PURPOSE',
            description: 'Avian purpose',
            order: '0001',
            index: 1,
            isAvian: true
          }),
          referenceItem({
            type: 'SPECIES_ANIMAL_PURPOSE',
            speciesCode: 'CATTLE',
            code: 'MAMMAL-PURPOSE',
            description: 'Mammal purpose',
            order: '0002',
            index: 2,
            isAvian: false
          })
        ]
      },
      'REF#SPECIES_HOUSING': {
        Items: [
          referenceItem({
            type: 'SPECIES_HOUSING',
            code: 'BARN',
            description: 'Pen/Barns',
            order: '0001',
            index: 1,
            isAvian: true
          }),
          referenceItem({
            type: 'SPECIES_HOUSING',
            code: 'HOUSED',
            description: 'Housed',
            order: '0002',
            index: 14,
            isAvian: false
          })
        ]
      },
      'REF#SEX_GROUP': {
        Items: [
          referenceItem({
            type: 'SEX_GROUP',
            code: 'FEMALE',
            description: 'Female',
            order: '0002',
            index: 1,
            excludeAvian: true
          }),
          referenceItem({
            type: 'SEX_GROUP',
            code: 'CASTRATE',
            description: 'Castrate',
            order: '0001',
            index: 0,
            excludeAvian: false
          })
        ]
      },
      'REF#AGE_CATEGORY': {
        Items: [
          referenceItem({
            type: 'AGE_CATEGORY',
            code: '0-3',
            description: '0-3 Days',
            order: '0001',
            index: 1,
            isAvian: true
          }),
          referenceItem({
            type: 'AGE_CATEGORY',
            code: 'NEONATAL',
            description: 'Neonatal (1 week old or less)',
            order: '0009',
            index: 9,
            isAvian: false
          })
        ]
      },
      'REF#ORGANIC_ENVIRONMENT': {}
    })

    const details = await getAnimalDetails(docClient, 'CHICKEN')

    expect(details).toEqual({
      speciesId: 'CHICKEN',
      ageCategories: [{ value: '0-3', label: '0-3 Days' }],
      purposes: [{ value: 'AVIAN-PURPOSE', label: 'Avian purpose' }],
      keepingTypes: [{ value: 'BARN', label: 'Pen/Barns' }],
      breeds: [{ value: 'BIRD-BREED', label: 'Bird breed' }],
      sexes: [{ value: 'CASTRATE', label: 'Castrate' }],
      organicAccreditationApplicable: false
    })
  })

  test('returns undefined when the species code is not found', async () => {
    const docClient = createDocClient({
      CATTLE: {
        Items: [referenceItem({
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
      }
    })

    await expect(getAnimalDetails(docClient, 'UNKNOWN')).resolves.toBeUndefined()
    expect(docClient.send).toHaveBeenCalledTimes(1)
  })

  test('returns empty lists when the species has no configured reference options', async () => {
    const docClient = createDocClient({
      CATTLE: {
        Items: [referenceItem({
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
      }
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
