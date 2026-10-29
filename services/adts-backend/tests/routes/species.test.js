import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('GET /GetSpecies', () => {
  let server
  const docClient = { send: jest.fn() }

  beforeAll(async () => {
    process.env.PORT = '3200'
    server = await createServer({ docClient })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('returns species from the reference data table in the UI contract shape', async () => {
    docClient.send.mockResolvedValue({
      Items: [
        { PK: 'REF#SPECIES', SK: 'ORDER#0001#CHICKEN', code: 'CHICKEN', description: 'Chicken', isAvian: true },
        { PK: 'REF#SPECIES', SK: 'ORDER#0002#COW', code: 'COW', description: 'Cow', isAvian: false }
      ]
    })

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([
      { speciesId: 'CHICKEN', name: 'Chicken' },
      { speciesId: 'COW', name: 'Cow' }
    ])

    const { input } = docClient.send.mock.calls[0][0]
    expect(input.TableName).toBe('adts-reference-data')
    expect(input.KeyConditionExpression).toBe('PK = :pk')
    expect(input.ExpressionAttributeValues).toEqual({ ':pk': 'REF#SPECIES' })
  })

  test('follows pagination until all species are read', async () => {
    docClient.send
      .mockResolvedValueOnce({ Items: [{ code: 'A', description: 'Alpaca' }], LastEvaluatedKey: { PK: 'k' } })
      .mockResolvedValueOnce({ Items: [{ code: 'B', description: 'Bee' }] })

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.result).toEqual([
      { speciesId: 'A', name: 'Alpaca' },
      { speciesId: 'B', name: 'Bee' }
    ])
    expect(docClient.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ PK: 'k' })
  })

  test('returns an empty array when there are no species', async () => {
    docClient.send.mockResolvedValue({ Items: [] })

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([])
  })

  test('returns an empty array when the query response has no Items field', async () => {
    docClient.send.mockResolvedValue({})

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([])
  })

  test('returns a gateway error rather than an empty result when DynamoDB fails', async () => {
    docClient.send.mockRejectedValue(new Error('connect ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve species' })
  })
})
