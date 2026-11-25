import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { getSubmissionReferences } from '../../src/backend/submissionReferences.js'

describe('submission references backend client', () => {
  const originalBackendUrl = process.env.BACKEND_SERVICE_URL

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_SERVICE_URL
    } else {
      process.env.BACKEND_SERVICE_URL = originalBackendUrl
    }
  })

  test('requests references scoped to the current client and farm', async () => {
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(['SUB-123']), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const references = await getSubmissionReferences({
      clientId: 'C-456',
      name: 'Acme Farm',
      farmName: 'North Field'
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3200/submission-references?clientId=C-456&clientName=Acme+Farm&clientFarm=North+Field'
    )
    expect(references).toEqual(['SUB-123'])
  })

  test('does not request references without client details', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    await expect(getSubmissionReferences()).resolves.toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('rejects a failed reference lookup', async () => {
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))

    await expect(getSubmissionReferences({ clientId: 'C-456' }))
      .rejects.toThrow('status 503')
  })

  test('rejects an invalid reference response', async () => {
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(['SUB-123', 123]),
      { status: 200 }
    ))

    await expect(getSubmissionReferences({ clientId: 'C-456' }))
      .rejects.toThrow('invalid response')
  })
})
