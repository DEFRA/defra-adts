import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('GET /GetCounties', () => {
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

  test('returns counties from the reference data table in the UI contract shape', async () => {
    docClient.send.mockResolvedValue({
      Items: [
        { PK: 'REF#COUNTY', SK: 'ORDER#0001#AB', code: 'AB', name: 'Argyll and Bute' },
        { PK: 'REF#COUNTY', SK: 'ORDER#0002#DEV', code: 'DEV', name: 'Devon' }
      ]
    })

    const response = await server.inject({ method: 'GET', url: '/GetCounties' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([
      { countyCode: 'AB', name: 'Argyll and Bute' },
      { countyCode: 'DEV', name: 'Devon' }
    ])

    const { input } = docClient.send.mock.calls[0][0]
    expect(input.TableName).toBe('adts-reference-data')
    expect(input.KeyConditionExpression).toBe('PK = :pk')
    expect(input.ExpressionAttributeValues).toEqual({ ':pk': 'REF#COUNTY' })
  })

  test('follows pagination until all counties are read', async () => {
    docClient.send
      .mockResolvedValueOnce({ Items: [{ code: 'AB', name: 'Argyll and Bute' }], LastEvaluatedKey: { PK: 'k' } })
      .mockResolvedValueOnce({ Items: [{ code: 'DEV', name: 'Devon' }] })

    const response = await server.inject({ method: 'GET', url: '/GetCounties' })

    expect(response.result).toEqual([
      { countyCode: 'AB', name: 'Argyll and Bute' },
      { countyCode: 'DEV', name: 'Devon' }
    ])
    expect(docClient.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ PK: 'k' })
  })

  test('returns an empty array when there are no counties', async () => {
    docClient.send.mockResolvedValue({ Items: [] })

    const response = await server.inject({ method: 'GET', url: '/GetCounties' })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([])
  })

  test('returns a gateway error when DynamoDB fails', async () => {
    docClient.send.mockRejectedValue(new Error('connect ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await server.inject({ method: 'GET', url: '/GetCounties' })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve counties' })
  })
})
