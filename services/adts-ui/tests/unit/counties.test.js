import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { getCounties } from '../../src/backend/counties.js'

describe('getCounties', () => {
  const originalBackendUrl = process.env.BACKEND_SERVICE_URL
  const request = {
    server: {
      app: {
        getAuthSession: () => ({ token: 'test-token' }),
        authMode: 'live'
      }
    }
  }

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

    const counties = await getCounties(request)

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3200/GetCounties', {
      headers: { Authorization: 'Bearer test-token' }
    })
    expect(counties).toEqual([
      { countyCode: '1', name: 'Dorset' },
      { countyCode: 'AB', name: 'Argyll and Bute' }
    ])
  })

  test('throws when the backend responds with a non-OK status', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Server error', { status: 500 }))

    await expect(getCounties(request)).rejects.toThrow('GetCounties failed with status 500')
  })
})
