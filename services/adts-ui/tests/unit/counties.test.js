import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { getCounties } from '../../src/backend/counties.js'

describe('getCounties', () => {
  const originalBackendUrl = process.env.BACKEND_SERVICE_URL

  beforeEach(() => {
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_SERVICE_URL
    } else {
      process.env.BACKEND_SERVICE_URL = originalBackendUrl
    }
  })

  test('requests counties from the backend and maps them to county code and name', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      { countyCode: 1, name: 'Dorset' },
      { countyCode: 'AB', name: 'Argyll and Bute' }
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))

    const counties = await getCounties()

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetCounties')
    expect(counties).toEqual([
      { countyCode: '1', name: 'Dorset' },
      { countyCode: 'AB', name: 'Argyll and Bute' }
    ])
  })

  test('throws when the backend responds with a non-OK status', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Server error', { status: 500 }))

    await expect(getCounties()).rejects.toThrow('GetCounties failed with status 500')
  })
})
