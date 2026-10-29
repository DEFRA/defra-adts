import { describe, expect, jest, test } from '@jest/globals'
import { getSubmissions } from '../../src/data/submissions.js'

const draft = (overrides = {}) => ({
  submissionId: 'draft-001',
  status: 'Draft',
  submittedAt: new Date().toISOString(),
  client: 'Acme Farm',
  clinician: 'Dr Alice Morgan',
  tests: [],
  ...overrides
})

const clientReturning = (...responses) => ({
  send: jest.fn().mockImplementation(async () => responses.shift())
})

describe('getSubmissions', () => {
  test.each(['1_day', '1_week', '14_days', '1_month', '6_months', '1_year', '18_months'])(
    'accepts the %s submitted-date filter',
    async (period) => {
      const docClient = clientReturning({ Items: [draft()] })

      const response = await getSubmissions(docClient, { 'submitted-date': period })

      expect(response.totalCount).toBe(1)
    }
  )

  test('rejects unsupported submitted-date filters', async () => {
    await expect(
      getSubmissions(clientReturning({ Items: [] }), { 'submitted-date': '2_years' })
    ).rejects.toThrow('Unsupported submitted-date filter: 2_years')
  })

  test('formats missing fields and invalid dates with safe display values', async () => {
    const docClient = clientReturning({
      Items: [draft({
        client: undefined,
        clientFarm: undefined,
        clinician: undefined,
        samplesTo: undefined,
        species: undefined,
        submittedAt: 'not-a-date',
        tests: undefined
      })]
    })

    const response = await getSubmissions(docClient)

    expect(response.results[0]).toEqual({
      id: 'draft-001',
      statuses: ['Draft'],
      samplesTo: '---',
      client: '---',
      clientFarm: '---',
      species: '---',
      clinician: '---',
      orderSubmitted: '---',
      hasTests: false,
      tests: []
    })
  })

  test('matches text filters case-insensitively and excludes missing text values', async () => {
    const docClient = clientReturning({
      Items: [
        draft({ submissionId: 'matching-draft', client: 'ACME Farm', clinician: 'Dr Alice Morgan' }),
        draft({ submissionId: 'missing-client', client: undefined })
      ]
    })

    const response = await getSubmissions(docClient, { client: ' acme ', clinician: 'ALICE' })

    expect(response.results.map(({ id }) => id)).toEqual(['matching-draft'])
  })

  test('follows pagination and maps submissions with tests', async () => {
    const docClient = clientReturning(
      {
        Items: [draft({ submissionId: 'draft-older', submittedAt: '2026-10-01T00:00:00.000Z' })],
        LastEvaluatedKey: { PK: 'next-page' }
      },
      {
        Items: [draft({
          submissionId: 'draft-newer',
          submittedAt: '2026-10-02T00:00:00.000Z',
          tests: [{ name: 'Test A' }]
        })]
      }
    )

    const response = await getSubmissions(docClient)

    expect(docClient.send).toHaveBeenCalledTimes(2)
    expect(docClient.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ PK: 'next-page' })
    expect(response.results.map(({ id }) => id)).toEqual(['draft-newer', 'draft-older'])
    expect(response.results[0].hasTests).toBe(true)
  })

  test('uses the configured submissions table', async () => {
    const originalTable = process.env.SUBMISSIONS_TABLE
    process.env.SUBMISSIONS_TABLE = 'custom-submissions-table'
    const docClient = clientReturning({ Items: [] })

    try {
      await getSubmissions(docClient)
      expect(docClient.send.mock.calls[0][0].input.TableName).toBe('custom-submissions-table')
    } finally {
      if (originalTable === undefined) {
        delete process.env.SUBMISSIONS_TABLE
      } else {
        process.env.SUBMISSIONS_TABLE = originalTable
      }
    }
  })

  test('treats a response without Items as empty', async () => {
    const response = await getSubmissions(clientReturning({}))

    expect(response).toEqual({ results: [], totalCount: 0 })
  })
})
