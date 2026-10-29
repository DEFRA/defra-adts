import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { referenceDataTable } from './dynamo.js'

const getSpeciesItems = async (docClient, exclusiveStartKey) => {
  const result = await docClient.send(new QueryCommand({
    TableName: referenceDataTable(),
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': 'REF#SPECIES' },
    ExclusiveStartKey: exclusiveStartKey
  }))

  const items = result.Items ?? []
  if (!result.LastEvaluatedKey) {
    return items
  }

  return [...items, ...await getSpeciesItems(docClient, result.LastEvaluatedKey)]
}

// Species records share the REF#SPECIES partition and are sorted by their configured order.
export const getSpecies = async (docClient) => {
  const items = await getSpeciesItems(docClient)
  return items.map((item) => ({ speciesId: String(item.code), name: item.description }))
}
