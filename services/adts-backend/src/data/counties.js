import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { referenceDataTable } from './dynamo.js'

const getCountyItems = async (docClient, exclusiveStartKey) => {
  const result = await docClient.send(new QueryCommand({
    TableName: referenceDataTable(),
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': 'REF#COUNTY' },
    ExclusiveStartKey: exclusiveStartKey
  }))

  const items = result.Items ?? []
  if (!result.LastEvaluatedKey) {
    return items
  }

  return [...items, ...await getCountyItems(docClient, result.LastEvaluatedKey)]
}

// County records share the REF#COUNTY partition and are sorted by their configured order.
export const getCounties = async (docClient) => {
  const items = await getCountyItems(docClient)
  return items.map((item) => ({ countyCode: String(item.code), name: item.name }))
}

// LIMS identifies counties by code only, so the code-to-name map is built from reference data.
export const getCountyNames = async (docClient) => {
  const items = await getCountyItems(docClient)
  return new Map(items.map((item) => [String(item.code), item.name]))
}
