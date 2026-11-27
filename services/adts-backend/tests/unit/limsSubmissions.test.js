import { afterEach, describe, expect, jest, test } from '@jest/globals'
import {
  getLimsSubmissionReferences,
  getLimsSubmissions
} from '../../src/data/limsSubmissions.js'

describe('LIMS submissions data access', () => {
  const originalServiceUrl = process.env.SUBMISSIONS_SERVICE_URL

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    if (originalServiceUrl === undefined) {
      delete process.env.SUBMISSIONS_SERVICE_URL
    } else {
      process.env.SUBMISSIONS_SERVICE_URL = originalServiceUrl
    }
  })

  test('requires a PVS ID for submission references', async () => {
    await expect(getLimsSubmissionReferences('', { clientId: 'C-1' }))
      .rejects.toThrow('A PVS ID is required')
  })

  test('requires a client filter for submission references', async () => {
    await expect(getLimsSubmissionReferences('PVS001')).rejects.toThrow(
      'A client ID, name, or farm is required'
    )
  })

  test('rejects failed and invalid reference responses', async () => {
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ invalid: true }), { status: 200 }))

    await expect(getLimsSubmissionReferences('PVS001', { clientId: 'C-1' }))
      .rejects.toThrow('status: 503')
    await expect(getLimsSubmissionReferences('PVS001', { clientId: 'C-1' }))
      .rejects.toThrow('invalid response')
  })

  test('requires a PVS ID for submissions', async () => {
    await expect(getLimsSubmissions('')).rejects.toThrow('A PVS ID is required')
  })

  test('rejects invalid submission responses', async () => {
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), { status: 200 })
    )

    await expect(getLimsSubmissions('PVS001')).rejects.toThrow('invalid response')
  })

  test('uses submission fallbacks without replacing a zero sample count', async () => {
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{
      submissionId: '',
      draftSubmissionId: 'D-1',
      status: 'Submitted',
      products: [{ name: '' }],
      numberSamples: 0,
      clientName: ''
    }]), { status: 200 }))

    const [result] = await getLimsSubmissions('PVS001')

    expect(result).toMatchObject({
      id: 'D-1',
      statuses: ['Submitted'],
      client: '---',
      hasTests: true,
      tests: [{ name: '---', qty: 0 }]
    })
  })

  test('filters submissions by status, client, and clinician', async () => {
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      { submissionId: 'S-1', status: 'Submitted', clientName: 'Alice Farms', clinician: 'Dr Jones' },
      { submissionId: 'S-2', status: 'Draft', clientName: 'Alice Farms', clinician: 'Dr Jones' },
      { submissionId: 'S-3', status: 'Submitted', clientName: 'Other Farm', clinician: 'Dr Jones' }
    ]), { status: 200 }))

    const results = await getLimsSubmissions('PVS001', {
      status: 'submitted',
      client: 'alice',
      clinician: 'jones'
    })

    expect(results.map(({ id }) => id)).toEqual(['S-1'])
  })

  test.each([
    ['2026-03-31', '1_month', '2026-02-28'],
    ['2024-03-31', '1_month', '2024-02-29'],
    ['2026-08-31', '6_months', '2026-02-28'],
    ['2026-08-31', '18_months', '2025-02-28']
  ])('clamps %s - %s to %s', async (today, period, expectedCutoff) => {
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    jest.useFakeTimers().setSystemTime(new Date(`${today}T12:00:00.000Z`))
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }))

    await getLimsSubmissions('PVS001', { 'submitted-date': period })

    const requestUrl = new URL(globalThis.fetch.mock.calls[0][0])
    expect(requestUrl.searchParams.get('submittedDateBegin')).toBe(expectedCutoff)
  })
})
