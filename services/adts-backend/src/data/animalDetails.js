import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { referenceDataTable } from './dynamo.js'

const ageUnits = [
  { value: 'DAYS', label: 'Days' },
  { value: 'WEEKS', label: 'Weeks' },
  { value: 'MONTHS', label: 'Months' },
  { value: 'YEARS', label: 'Years' }
]

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

const speciesOptions = (items, speciesId) => items.filter((item) => item.speciesCode === speciesId)

// Species-specific purposes take precedence. Species with none fall back to purposes with no species code.
const purposeOptions = (items, speciesId, isAvian) => {
  const speciesPurposes = speciesOptions(items, speciesId)
  const purposes = speciesPurposes.length > 0
    ? speciesPurposes
    : items.filter((item) => item.speciesCode == null)

  return applicableOptions(purposes, speciesId, isAvian)
}

export const getAnimalDetails = async (docClient, speciesId) => {
  const species = await querySpecies(docClient, speciesId)
  if (!species) {
    return undefined
  }

  const isAvian = species.isAvian === true
  const [breedItems, purposeItems, keepingTypes, sexes, ageCategories, organicOptions] = await Promise.all([
    queryItems(docClient, 'REF#SPECIES_ANIMAL_BREED'),
    queryItems(docClient, 'REF#SPECIES_ANIMAL_PURPOSE'),
    queryItems(docClient, 'REF#SPECIES_HOUSING'),
    queryItems(docClient, 'REF#SEX_GROUP'),
    queryItems(docClient, 'REF#AGE_CATEGORY'),
    queryItems(docClient, 'REF#ORGANIC_ENVIRONMENT')
  ])

  return {
    speciesId,
    ageCategories: applicableOptions(ageCategories, speciesId, isAvian),
    ageUnits,
    purposes: purposeOptions(purposeItems, speciesId, isAvian),
    keepingTypes: applicableOptions(keepingTypes, speciesId, isAvian),
    breeds: applicableOptions(speciesOptions(breedItems, speciesId), speciesId, isAvian),
    sexes: applicableOptions(sexes, speciesId, isAvian),
    organicAccreditationApplicable: applicableOptions(organicOptions, speciesId, isAvian).length > 0
  }
}
