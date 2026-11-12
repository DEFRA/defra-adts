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
  const result = await docClient.send(new QueryCommand({
    TableName: referenceDataTable(),
    IndexName: 'ByCode',
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk',
    ExpressionAttributeValues: {
      ':gsi1pk': 'CODE#SPECIES',
      ':gsi1sk': speciesId
    }
  }))

  return result.Items?.[0]
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

  if (typeof item.isAvian === 'boolean' && item.isAvian !== isAvian) {
    return false
  }

  if (item.excludeAvian === true && isAvian) {
    return false
  }

  return typeof item.forAvianSpecies !== 'boolean' || item.forAvianSpecies === isAvian
}

const applicableOptions = (items, speciesId, isAvian) =>
  optionItems(items.filter((item) => appliesToSpecies(item, speciesId, isAvian)))

const speciesOptions = async (docClient, type, speciesId) => {
  const items = await queryItems(docClient, `REF#${type}`)
  return items.filter((item) => item.speciesCode === speciesId)
}

export const getAnimalDetails = async (docClient, speciesId) => {
  const species = await querySpecies(docClient, speciesId)
  if (!species) {
    return undefined
  }

  const isAvian = species.isAvian === true
  const [breeds, purposes, keepingTypes, sexes, ageCategories, organicOptions] = await Promise.all([
    speciesOptions(docClient, 'SPECIES_ANIMAL_BREED', speciesId),
    speciesOptions(docClient, 'SPECIES_ANIMAL_PURPOSE', speciesId),
    queryItems(docClient, 'REF#SPECIES_HOUSING'),
    queryItems(docClient, 'REF#SEX_GROUP'),
    queryItems(docClient, 'REF#AGE_CATEGORY'),
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
