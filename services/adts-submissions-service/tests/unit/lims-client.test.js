import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { createLimsClient } from '../../src/clients/lims-client.js'

const createClient = (fetchImpl, overrides = {}) => createLimsClient({
  baseUrl: 'https://lims.example.test',
  prefix: '/lims/api',
  timeoutMs: 1000,
  fetchImpl,
  ...overrides
})

describe('LIMS client', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('constructs the configured URL and sends no Authorization header without following redirects', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    const client = createClient(fetchImpl)

    const response = await client.request('general/getProducts', {
      method: 'GET',
      query: { filter: 'mastitis', species: 'CATTLE' }
    })

    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, options] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe('https://lims.example.test/lims/api/general/getProducts?filter=mastitis&species=CATTLE')
    expect(options.headers).not.toHaveProperty('authorization')
    expect(options.redirect).toBe('manual')
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(options).not.toHaveProperty('dispatcher')
    expect(options).not.toHaveProperty('agent')
  })

  test('rejects HTTP unless the temporary exception is explicitly enabled', async () => {
    const fetchImpl = jest.fn()

    expect(() => createClient(fetchImpl, {
      baseUrl: 'http://lims.example.test'
    })).toThrow(/HTTP.*exception/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('allows HTTP only for the configured LIMS origin when the exception is enabled', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('{"status":"UP"}', { status: 200 }))
    const client = createClient(fetchImpl, {
      baseUrl: 'http://lims.example.test',
      allowHttp: true
    })

    await client.request('general/getpingOK')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0][0])).toBe('http://lims.example.test/lims/api/general/getpingOK')
  })

  test('rejects absolute paths and traversal outside the configured LIMS origin', async () => {
    const fetchImpl = jest.fn()
    const client = createClient(fetchImpl, {
      baseUrl: 'http://lims.example.test',
      allowHttp: true
    })

    await expect(client.request('https://other.example.test/steal')).rejects.toThrow()
    await expect(client.request('../other')).rejects.toThrow()
    await expect(client.request('%2e%2e/other')).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('rejects malformed or credential-bearing base URLs', () => {
    const fetchImpl = jest.fn()

    expect(() => createClient(fetchImpl, { baseUrl: 'ftp://lims.example.test' })).toThrow(/HTTP\(S\) origin/i)
    expect(() => createClient(fetchImpl, { baseUrl: 'https://user@lims.example.test' })).toThrow(/HTTP\(S\) origin/i)
    expect(() => createClient(fetchImpl, { baseUrl: 'https://lims.example.test/?query=1' })).toThrow(/HTTP\(S\) origin/i)
  })

  test('requires a positive integer timeout and a fetch implementation', () => {
    const fetchImpl = jest.fn()

    expect(() => createClient(fetchImpl, { timeoutMs: 0 })).toThrow(/positive integer/i)
    expect(() => createClient(null)).toThrow(/fetch implementation is required/i)
  })

  test('sends a JSON body and preserves explicitly supplied headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('{"draftId":"DRAFT-1"}', { status: 201 }))
    const client = createClient(fetchImpl, { prefix: '' })

    await client.request('submissions/createUpdateDraftSubmission', {
      method: 'POST',
      headers: { 'x-request-id': 'request-1' },
      body: { pvsId: 'PVS001' }
    })

    const [url, options] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe('https://lims.example.test/submissions/createUpdateDraftSubmission')
    expect(options.headers['content-type']).toBe('application/json')
    expect(options.headers['x-request-id']).toBe('request-1')
    expect(options.body).toBe('{"pvsId":"PVS001"}')
  })

  test('does not retry after an upstream transport failure', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('connection reset'))
    const client = createClient(fetchImpl)

    await expect(client.request('general/getpingOK')).rejects.toThrow('connection reset')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('aborts the upstream request at the configured deadline without retrying', async () => {
    const fetchImpl = jest.fn((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const client = createClient(fetchImpl, { timeoutMs: 5 })

    await expect(client.request('general/getpingOK')).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
