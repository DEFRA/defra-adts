import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { ciLimsMappingTable } from './dynamo.js'

export const getLimsIdForCiId = async (docClient, ciId) => {
  if (typeof ciId !== 'string' || !ciId.trim()) {
    throw new TypeError('Authenticated CI ID is required to resolve the LIMS ID')
  }

  const { Item } = await docClient.send(new GetCommand({
    TableName: ciLimsMappingTable(),
    Key: { PK: ciId }
  }))
  const limsId = Item?.limsId

  return typeof limsId === 'string' && limsId.trim() ? limsId : undefined
}
