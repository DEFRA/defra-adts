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

describe('GET /submissions with local DynamoDB', () => {
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

  const expectDraftResults = async (query, expectedResults) => {
    const response = await server.inject({ method: 'GET', url: `/submissions?status=draft&${query}` })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      results: expectedResults,
      totalCount: expectedResults.length
    })
  }

  const draftResult = (id, client, clientFarm, species, clinician, orderSubmitted) => ({
    id,
    statuses: ['Draft'],
    samplesTo: '---',
    client,
    clientFarm,
    species,
    clinician,
    orderSubmitted,
    hasTests: false,
    tests: []
  })

  const draft001 = draftResult(
    'draft-001',
    'Acme Farm',
    'North Field',
    'Cattle',
    'Dr Alice Morgan',
    '20/Oct/2026'
  )
  const draft002 = draftResult(
    'draft-002',
    'Acme Farm',
    'South Field',
    'Sheep',
    'Dr Bob Jones',
    '10/Sep/2026'
  )
  const draft003 = draftResult(
    'draft-003',
    'Beta Farm',
    'East Field',
    'Goat',
    'Dr Alice Morgan',
    '01/Feb/2025'
  )

  test('filters Draft results by client', async () => {
    await expectDraftResults('client=Acme', [draft001, draft002])
  })

  test('filters Draft results by clinician', async () => {
    await expectDraftResults('clinician=Alice', [draft001, draft003])
  })

  test('filters Draft results by submitted date', async () => {
    await expectDraftResults('submitted-date=6_months', [draft001, draft002])
  })

  test('combines client, clinician, and submitted-date filters', async () => {
    await expectDraftResults(
      'client=Acme&clinician=Alice&submitted-date=6_months',
      [draft001]
    )
  })

  test('reports a DynamoDB failure instead of returning empty Draft results', async () => {
    const originalTable = process.env.SUBMISSIONS_TABLE
    process.env.SUBMISSIONS_TABLE = 'missing-integration-test-table'
    jest.spyOn(console, 'error').mockImplementation(() => {})

    let response
    try {
      response = await server.inject({ method: 'GET', url: '/submissions?status=draft' })
    } finally {
      if (originalTable === undefined) {
        delete process.env.SUBMISSIONS_TABLE
      } else {
        process.env.SUBMISSIONS_TABLE = originalTable
      }
      jest.restoreAllMocks()
    }

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve submissions' })
    expect(response.result).not.toEqual({ results: [], totalCount: 0 })
  })
})
