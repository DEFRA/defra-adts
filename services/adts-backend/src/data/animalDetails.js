import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { referenceDataTable } from './dynamo.js'

const queryItems = async (docClient, partitionKey, exclusiveStartKey) => {
  const result = await docClient.send(new QueryCommand({
    TableName: referenceDataTable(),
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': partitionKey },
    ExclusiveStartKey: exclusiveStartKey
  }))

  const items = result.Items ?? []
  if (!result.LastEvaluatedKey) {
    return items
  }

  return [...items, ...await queryItems(docClient, partitionKey, result.LastEvaluatedKey)]
}

const querySpecies = async (docClient, speciesId) => {
  const species = await queryItems(docClient, 'REF#SPECIES')
  return species.find((item) => String(item.code) === speciesId)
}

const optionItems = (items) => items.map((item) => ({
  value: String(item.code),
  label: item.description ?? item.name
})).filter(({ value, label }) => value !== 'undefined' && typeof label === 'string')

const appliesToSpecies = (item, speciesId, isAvian) => {
  if (Array.isArray(item.excludeSpeciesLimsCodes) &&
    item.excludeSpeciesLimsCodes.includes(speciesId)) {
    return false
  }

  return typeof item.forAvianSpecies !== 'boolean' || item.forAvianSpecies === isAvian
}

const applicableOptions = (items, speciesId, isAvian) =>
  optionItems(items.filter((item) => appliesToSpecies(item, speciesId, isAvian)))

const speciesOptions = async (docClient, speciesId, type, fallbackPartitions = []) => {
  const speciesItems = await queryItems(docClient, `REF#${type}#SPECIES#${speciesId}`)
  if (speciesItems.length) {
    return speciesItems
  }

  for (const partition of fallbackPartitions) {
    const items = await queryItems(docClient, partition)
    if (items.length) {
      return items
    }
  }

  return []
}

export const getAnimalDetails = async (docClient, speciesId) => {
  const species = await querySpecies(docClient, speciesId)
  if (!species) {
    return undefined
  }

  const isAvian = species.isAvian === true
  const [breeds, purposes, keepingTypes, sexes, ageCategories, organicOptions] = await Promise.all([
    speciesOptions(docClient, speciesId, 'SPECIES_ANIMAL_BREEDS', ['REF#SPECIES_ANIMAL_BREEDS']),
    speciesOptions(docClient, speciesId, 'SPECIES_ANIMAL_PURPOSES', [
      `REF#SPECIES_ANIMAL_PURPOSES#AVIAN#${isAvian ? '1' : '0'}`,
      'REF#SPECIES_ANIMAL_PURPOSES'
    ]),
    queryItems(docClient, 'REF#SPECIES_HOUSINGS'),
    queryItems(docClient, 'REF#SEX_GROUPS'),
    queryItems(docClient, 'REF#AGE_CATEGORIES'),
    queryItems(docClient, 'REF#ORGANIC_ENVIRONMENT')
  ])

  return {
    speciesId,
    ageCategories: applicableOptions(ageCategories, speciesId, isAvian),
    purposes: applicableOptions(purposes, speciesId, isAvian),
    keepingTypes: applicableOptions(keepingTypes, speciesId, isAvian),
    breeds: applicableOptions(breeds, speciesId, isAvian),
    sexes: applicableOptions(sexes, speciesId, isAvian),
    organicAccreditationApplicable: applicableOptions(organicOptions, speciesId, isAvian).length > 0
  }
}
