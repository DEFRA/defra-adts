import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// DYNAMODB_ENDPOINT is only set locally (e.g. http://localhost:8000); in AWS the SDK resolves it from the region.
export const createDocumentClient = () => {
  const endpoint = process.env.DYNAMODB_ENDPOINT

  return DynamoDBDocumentClient.from(new DynamoDBClient({
    region: process.env.AWS_REGION || 'eu-west-2',
    ...(endpoint && { endpoint })
  }))
}

export const referenceDataTable = () => process.env.REFERENCE_DATA_TABLE || 'adts-reference-data'
