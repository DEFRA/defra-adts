import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { loadConfig } from '../../src/config.js'

describe('arbitrary connection health probe', () => {
  let server
  let limsClient

  beforeAll(async () => {
    limsClient = { request: jest.fn() }
    server = await createServer({
      config: loadConfig({
        LIMS_BASE_URL: 'https://lims.example.test',
        LIMS_PREFIX: 'api',
        LIMS_TIMEOUT_MS: '1000'
      }),
      limsClient
    })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('does not expose a caller-controlled connection probe', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch')
    const response = await server.inject({
      method: 'GET',
      url: '/connection_health?protocol=http&host=my-target-host.internal&port=9000'
    })

    expect(response.statusCode).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
    expect(limsClient.request).not.toHaveBeenCalled()
  })
})
