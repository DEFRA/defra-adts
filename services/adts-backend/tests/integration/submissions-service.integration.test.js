import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createBackendServer from '../../src/app.js'
import createSubmissionServer from '../../../adts-submissions-service/src/app.js'
import { loadConfig } from '../../../adts-submissions-service/src/config.js'

describe('Backend to Submission Service integration', () => {
  let backendServer
  let submissionServer
  let limsClient
  let fetchSpy
  let originalPort
  let originalServiceUrl

  beforeAll(async () => {
    originalPort = process.env.PORT
    originalServiceUrl = process.env.SUBMISSIONS_SERVICE_URL
    process.env.PORT = '0'

    const config = loadConfig({
      LIMS_BASE_URL: 'https://lims.example.test',
      LIMS_PREFIX: 'api',
      LIMS_USERNAME: 'service-user',
      LIMS_PASSWORD: 'test-password',
      LIMS_TIMEOUT_MS: '1000'
    })
    const products = [{ productId: 'PC0203', name: 'Synthetic product', price: 1 }]
    limsClient = {
      request: jest.fn().mockResolvedValue(new Response(JSON.stringify(products), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }))
    }

    submissionServer = await createSubmissionServer({ config, limsClient })
    await submissionServer.start()
    process.env.SUBMISSIONS_SERVICE_URL = `http://127.0.0.1:${submissionServer.listener.address().port}`

    backendServer = await createBackendServer({ docClient: { send: jest.fn() } })
  })

  afterAll(async () => {
    await backendServer?.stop()
    await submissionServer?.stop()
    jest.restoreAllMocks()

    if (originalPort === undefined) {
      delete process.env.PORT
    } else {
      process.env.PORT = originalPort
    }

    if (originalServiceUrl === undefined) {
      delete process.env.SUBMISSIONS_SERVICE_URL
    } else {
      process.env.SUBMISSIONS_SERVICE_URL = originalServiceUrl
    }
  })

  test('routes product search through the Submission Service to LIMS without LIMS credentials in Backend request', async () => {
    const actualFetch = globalThis.fetch
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation((...args) => actualFetch(...args))

    const response = await backendServer.inject({
      method: 'GET',
      url: '/v1/products?filter=mastitis&species=CATTLE'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual([{ productId: 'PC0203', name: 'Synthetic product', price: 1 }])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe(`${process.env.SUBMISSIONS_SERVICE_URL}/v1/products?filter=mastitis&species=CATTLE`)
    expect(fetchSpy.mock.calls[0][1]?.headers?.authorization).toBeUndefined()
    expect(limsClient.request).toHaveBeenCalledTimes(1)
    expect(limsClient.request).toHaveBeenCalledWith('general/getProducts', {
      method: 'GET',
      query: { filter: 'mastitis', species: 'CATTLE' }
    })
  })
})
