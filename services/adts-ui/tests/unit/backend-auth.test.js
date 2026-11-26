import { describe, expect, test } from '@jest/globals'
import { getBackendHeaders } from '../../src/backend/auth.js'

const createRequest = (session, authMode) => ({
  server: {
    app: {
      authMode,
      getAuthSession: () => session
    }
  }
})

describe('backend authentication headers', () => {
  test('returns the session access token as a bearer header', () => {
    expect(getBackendHeaders(createRequest({ token: 'access-token' }, 'live')))
      .toEqual({ Authorization: 'Bearer access-token' })
  })

  test('returns no authorization header in mock mode without a token', () => {
    expect(getBackendHeaders(createRequest({}, 'mock'))).toEqual({})
  })

  test('requires an access token in live mode', () => {
    expect(() => getBackendHeaders(createRequest({}, 'live')))
      .toThrow('Authenticated access token is missing')
  })
})
