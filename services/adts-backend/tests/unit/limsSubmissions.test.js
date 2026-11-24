import { afterEach, describe, expect, jest, test } from '@jest/globals'
import {
  getLimsSubmissionReferences,
  getLimsSubmissions
} from '../../src/data/limsSubmissions.js'

describe('LIMS submissions data access', () => {
  const originalPvsId = process.env.LIMS_PVS_ID
  const originalServiceUrl = process.env.SUBMISSIONS_SERVICE_URL

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    if (originalPvsId === undefined) {
      delete process.env.LIMS_PVS_ID
    } else {
      process.env.LIMS_PVS_ID = originalPvsId
    }
    if (originalServiceUrl === undefined) {
      delete process.env.SUBMISSIONS_SERVICE_URL
    } else {
      process.env.SUBMISSIONS_SERVICE_URL = originalServiceUrl
    }
  })

  test('requires a PVS ID for submission references', async () => {
    delete process.env.LIMS_PVS_ID

    await expect(getLimsSubmissionReferences({ clientId: 'C-1' }))
      .rejects.toThrow('LIMS_PVS_ID must be configured')
  })

  test('requires a client filter for submission references', async () => {
    process.env.LIMS_PVS_ID = 'PVS001'

    await expect(getLimsSubmissionReferences()).rejects.toThrow(
      'A client ID, name, or farm is required'
    )
  })

  test('rejects failed and invalid reference responses', async () => {
    process.env.LIMS_PVS_ID = 'PVS001'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ invalid: true }), { status: 200 }))

    await expect(getLimsSubmissionReferences({ clientId: 'C-1' }))
      .rejects.toThrow('status: 503')
    await expect(getLimsSubmissionReferences({ clientId: 'C-1' }))
      .rejects.toThrow('invalid response')
  })

  test('requires a PVS ID for submissions', async () => {
    delete process.env.LIMS_PVS_ID

    await expect(getLimsSubmissions()).rejects.toThrow('LIMS_PVS_ID must be configured')
  })

  test('rejects invalid submission responses', async () => {
    process.env.LIMS_PVS_ID = 'PVS001'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), { status: 200 })
    )

    await expect(getLimsSubmissions()).rejects.toThrow('invalid response')
  })

  test.each([
    ['2026-03-31', '1_month', '2026-02-28'],
    ['2024-03-31', '1_month', '2024-02-29'],
    ['2026-08-31', '6_months', '2026-02-28'],
    ['2026-08-31', '18_months', '2025-02-28']
  ])('clamps %s - %s to %s', async (today, period, expectedCutoff) => {
    process.env.LIMS_PVS_ID = 'PVS001'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.useFakeTimers().setSystemTime(new Date(`${today}T12:00:00.000Z`))
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }))

    await getLimsSubmissions({ 'submitted-date': period })

    const requestUrl = new URL(globalThis.fetch.mock.calls[0][0])
    expect(requestUrl.searchParams.get('submittedDateBegin')).toBe(expectedCutoff)
  })
})
