import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import Hapi from '@hapi/hapi'
import createBackendServer from '../../../adts-backend/src/app.js'
import createSubmissionsServer from '../../../adts-submissions-service/src/app.js'
import createUiServer from '../../src/app.js'

const clientRecords = [
  {
    clientId: 'client-001',
    name: 'Example Farm',
    farmName: 'North Field',
    addressLine1: '1 Test Lane',
    addressLine2: 'Teston',
    county: 'Example County',
    postcode: 'ZZ1 1ZZ',
    cph: '12/345/6789'
  },
  {
    clientId: 42,
    name: 'Second Example Farm'
  }
]

describe('Get clients across UI, backend, submissions service and LIMS', () => {
  let limsServer
  let submissionsServer
  let backendServer
  let uiServer
  let limsClientRequests
  let limsClientQuery
  let originalEnvironment

  beforeAll(async () => {
    originalEnvironment = {
      PORT: process.env.PORT,
      SESSION_SECRET: process.env.SESSION_SECRET,
      LIMS_BASE_URL: process.env.LIMS_BASE_URL,
      LIMS_PVS_ID: process.env.LIMS_PVS_ID,
      SUBMISSIONS_SERVICE_URL: process.env.SUBMISSIONS_SERVICE_URL,
      BACKEND_SERVICE_URL: process.env.BACKEND_SERVICE_URL
    }

    process.env.PORT = '0'
    process.env.SESSION_SECRET = 'integration-test-secret-with-at-least-32-characters'
    limsClientRequests = 0
    limsClientQuery = undefined

    limsServer = Hapi.server({ port: 0 })
    limsServer.route({
      method: 'GET',
      path: '/general/getClients',
      handler: (request) => {
        limsClientRequests += 1
        limsClientQuery = request.query
        return clientRecords
      }
    })
    await limsServer.start()

    process.env.LIMS_BASE_URL = limsServer.info.uri
    process.env.LIMS_PVS_ID = 'TEST-PVS-001'
    submissionsServer = await createSubmissionsServer()
    await submissionsServer.start()

    process.env.SUBMISSIONS_SERVICE_URL = submissionsServer.info.uri
    backendServer = await createBackendServer()
    await backendServer.start()

    process.env.BACKEND_SERVICE_URL = backendServer.info.uri
    uiServer = await createUiServer()
    await uiServer.start()
  })

  afterAll(async () => {
    for (const server of [uiServer, backendServer, submissionsServer, limsServer]) {
      if (server) {
        await server.stop()
      }
    }

    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  test('renders LIMS client records as selectable UI options', async () => {
    const response = await fetch(`${uiServer.info.uri}/submission-01-client-details`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('<option value="client-001">Example Farm</option>')
    expect(html).toContain('<option value="42">Second Example Farm</option>')
    expect(limsClientRequests).toBe(1)
    expect(limsClientQuery).toEqual({ pvsId: 'TEST-PVS-001', filter: '' })
  })
})
