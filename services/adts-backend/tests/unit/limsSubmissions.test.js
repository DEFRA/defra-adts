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
})
