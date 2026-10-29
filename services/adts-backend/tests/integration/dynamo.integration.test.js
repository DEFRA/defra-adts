import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('GET /GetSpecies with local DynamoDB', () => {
  let server
  const testEnvironment = {
    DYNAMODB_ENDPOINT: 'http://localhost:8000',
    AWS_REGION: 'eu-west-2',
    AWS_ACCESS_KEY_ID: 'local',
    AWS_SECRET_ACCESS_KEY: 'local'
  }
  const originalEnvironment = Object.fromEntries(
    Object.keys(testEnvironment).map((key) => [key, process.env[key]])
  )

  beforeAll(async () => {
    Object.assign(process.env, testEnvironment)
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  test('returns seeded species in the expected shape and order', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([
      { speciesId: 'CHICKEN', name: 'Chicken' },
      { speciesId: 'COW', name: 'Cow' },
      { speciesId: 'SHEEP', name: 'Sheep' }
    ])
  })

  test('reports a DynamoDB query failure instead of returning an empty result', async () => {
    const originalTable = process.env.REFERENCE_DATA_TABLE
    process.env.REFERENCE_DATA_TABLE = 'missing-integration-test-table'
    jest.spyOn(console, 'error').mockImplementation(() => {})

    let response
    try {
      response = await server.inject({ method: 'GET', url: '/GetSpecies' })
    } finally {
      if (originalTable === undefined) {
        delete process.env.REFERENCE_DATA_TABLE
      } else {
        process.env.REFERENCE_DATA_TABLE = originalTable
      }
      jest.restoreAllMocks()
    }

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve species' })
    expect(response.result).not.toEqual([])
  })
})
