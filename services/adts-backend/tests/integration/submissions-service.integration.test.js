import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
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
  let originalPvsId
  let originalFetch

  beforeAll(async () => {
    originalPort = process.env.PORT
    originalServiceUrl = process.env.SUBMISSIONS_SERVICE_URL
    originalPvsId = process.env.LIMS_PVS_ID
    originalFetch = globalThis.fetch
    process.env.PORT = '0'
    process.env.LIMS_PVS_ID = 'PVS001'

    const config = loadConfig({
      LIMS_BASE_URL: 'https://lims.example.test',
      LIMS_PREFIX: 'api',
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
    if (originalPvsId === undefined) {
      delete process.env.LIMS_PVS_ID
    } else {
      process.env.LIMS_PVS_ID = originalPvsId
    }
  })

  beforeEach(() => {
    limsClient.request.mockReset()
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation((...args) => originalFetch(...args))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('routes product search through the Submission Service to LIMS without LIMS credentials in Backend request', async () => {
    const products = [{ productId: 'PC0203', name: 'Synthetic product', price: 1 }]
    limsClient.request.mockResolvedValue(new Response(JSON.stringify(products), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

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

  test('routes client-scoped submission reference lookup through the Submission Service to LIMS', async () => {
    const submissions = [
      { submissionId: 'SUB-1', clientName: 'Acme Farm', clientFarm: 'North Field' },
      { submissionId: 'SUB-2', clientName: 'Acme Farm', clientFarm: 'South Field' },
      { submissionId: 'SUB-3', clientName: 'Other Farm', clientFarm: 'North Field' },
      { submissionId: 'SUB-1', clientName: 'Acme Farm', clientFarm: 'North Field' },
      { draftSubmissionId: 'DRAFT-1', clientName: 'Acme Farm', clientFarm: 'North Field' }
    ]
    limsClient.request.mockResolvedValue(new Response(JSON.stringify(submissions), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    const response = await backendServer.inject({
      method: 'GET',
      url: '/submission-references?clientId=C-456&clientName=Acme%20Farm&clientFarm=North%20Field'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(['SUB-1'])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      `${process.env.SUBMISSIONS_SERVICE_URL}/v1/submissions?pvsId=PVS001&clientId=C-456`
    )
    expect(fetchSpy.mock.calls[0][1]?.headers?.authorization).toBeUndefined()
    expect(limsClient.request).toHaveBeenCalledTimes(1)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/getSubmissions', {
      method: 'GET',
      query: { pvsid: 'PVS001', clientId: 'C-456' }
    })
  })
})
 