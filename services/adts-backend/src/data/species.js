import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { referenceDataTable } from './dynamo.js'

// Species records share the REF#SPECIES partition and are sorted by their configured order.
export const getSpecies = async (docClient) => {
  const items = []
  let exclusiveStartKey

  do {
    const result = await docClient.send(new QueryCommand({
      TableName: referenceDataTable(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'REF#SPECIES' },
      ExclusiveStartKey: exclusiveStartKey
    }))

    items.push(...(result.Items ?? []))
    exclusiveStartKey = result.LastEvaluatedKey
  } while (exclusiveStartKey)

  return items.map((item) => ({ speciesId: String(item.code), name: item.description }))
}
