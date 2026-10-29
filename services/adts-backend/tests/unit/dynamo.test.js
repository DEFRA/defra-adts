import { afterEach, describe, expect, jest, test } from '@jest/globals'

const dynamoClientMock = jest.fn((config) => ({ config }))
const documentClient = { name: 'document-client' }
const documentClientFromMock = jest.fn(() => documentClient)

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: dynamoClientMock
}))
jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: documentClientFromMock }
}))

const { createDocumentClient, referenceDataTable } = await import('../../src/data/dynamo.js')
const originalEnvironment = {
  AWS_REGION: process.env.AWS_REGION,
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT,
  REFERENCE_DATA_TABLE: process.env.REFERENCE_DATA_TABLE
}

describe('DynamoDB client configuration', () => {
  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    jest.clearAllMocks()
  })

  test('uses the default region when no AWS region is configured', () => {
    delete process.env.AWS_REGION
    delete process.env.DYNAMODB_ENDPOINT

    expect(createDocumentClient()).toBe(documentClient)
    expect(dynamoClientMock).toHaveBeenCalledWith({ region: 'eu-west-2' })
    expect(documentClientFromMock).toHaveBeenCalledWith({ config: { region: 'eu-west-2' } })
  })

  test('uses the configured region and local endpoint', () => {
    process.env.AWS_REGION = 'us-east-1'
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000'

    createDocumentClient()

    expect(dynamoClientMock).toHaveBeenCalledWith({
      region: 'us-east-1',
      endpoint: 'http://localhost:8000'
    })
  })

  test('uses the default reference-data table unless overridden', () => {
    delete process.env.REFERENCE_DATA_TABLE
    expect(referenceDataTable()).toBe('adts-reference-data')

    process.env.REFERENCE_DATA_TABLE = 'custom-reference-data'
    expect(referenceDataTable()).toBe('custom-reference-data')
  })
})
