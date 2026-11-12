import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const speciesItem = ({ code, description, order, index, isAvian, isMammal, isRuminant }) => ({
  PK: 'REF#SPECIES',
  SK: `ORDER#${order}#${code}`,
  type: 'SPECIES',
  code,
  description,
  isAvian,
  isMammal,
  isRuminant,
  mostCommon: true,
  index,
  GSI1PK: 'CODE#SPECIES',
  GSI1SK: code,
  GSI2PK: 'NAME#SPECIES',
  GSI2SK: description.toLowerCase()
})

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
        speciesItem({
          code: 'CATTLE',
          description: 'Cattle',
          order: '0001',
          index: 0,
          isAvian: false,
          isMammal: true,
          isRuminant: true
        }),
        speciesItem({
          code: 'CHICKEN',
          description: 'Chicken',
          order: '0003',
          index: 2,
          isAvian: true,
          isMammal: false,
          isRuminant: false
        })
      ]
    })

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([
      { speciesId: 'CATTLE', name: 'Cattle' },
      { speciesId: 'CHICKEN', name: 'Chicken' }
    ])

    const { input } = docClient.send.mock.calls[0][0]
    expect(input.TableName).toBe('adts-reference-data')
    expect(input.KeyConditionExpression).toBe('PK = :pk')
    expect(input.ExpressionAttributeValues).toEqual({ ':pk': 'REF#SPECIES' })
  })

  test('follows pagination until all species are read', async () => {
    docClient.send
      .mockResolvedValueOnce({
        Items: [speciesItem({
          code: 'CATTLE',
          description: 'Cattle',
          order: '0001',
          index: 0,
          isAvian: false,
          isMammal: true,
          isRuminant: true
        })],
        LastEvaluatedKey: { PK: 'REF#SPECIES', SK: 'ORDER#0001#CATTLE' }
      })
      .mockResolvedValueOnce({
        Items: [speciesItem({
          code: 'CHICKEN',
          description: 'Chicken',
          order: '0003',
          index: 2,
          isAvian: true,
          isMammal: false,
          isRuminant: false
        })]
      })

    const response = await server.inject({ method: 'GET', url: '/GetSpecies' })

    expect(response.result).toEqual([
      { speciesId: 'CATTLE', name: 'Cattle' },
      { speciesId: 'CHICKEN', name: 'Chicken' }
    ])
    expect(docClient.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({
      PK: 'REF#SPECIES',
      SK: 'ORDER#0001#CATTLE'
    })
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
