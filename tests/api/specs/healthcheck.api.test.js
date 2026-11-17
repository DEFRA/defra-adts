import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import createBackendServer from '../../../services/adts-backend/src/app.js'
import createSubmissionsServer from '../../../services/adts-submissions-service/src/app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const loadJson = (relativePath) =>
  JSON.parse(readFileSync(path.resolve(__dirname, relativePath), 'utf8'))

const healthSchema = loadJson('../schemas/healthcheck.schema.json')
const healthcheckData = loadJson('../test-data/healthcheck-data.json')

const assertHealthPayloadMatchesSchema = (payload) => {
  expect(healthSchema.type).toBe('object')
  expect(payload).not.toBeNull()
  expect(typeof payload).toBe('object')

  for (const requiredProperty of healthSchema.required) {
    expect(Object.hasOwn(payload, requiredProperty)).toBe(true)
  }

  const expectedType = healthSchema.properties.status.type
  expect(typeof payload.status).toBe(expectedType)
}

describe('API healthcheck contract', () => {
  let backendServer
  let submissionsServer

  beforeAll(async () => {
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    process.env.LIMS_API_URL = 'http://localhost:8500'

    process.env.PORT = '3200'
    backendServer = await createBackendServer()
    process.env.PORT = '3100'
    submissionsServer = await createSubmissionsServer()
  })

  afterAll(async () => {
    await backendServer.stop()
    await submissionsServer.stop()
  })

  test.each([
    ['backend', () => backendServer.inject({ method: 'GET', url: '/health' })],
    ['submissions-service', () => submissionsServer.inject({ method: 'GET', url: '/health' })]
  ])('%s returns a valid health payload', async (_serviceName, request) => {
    const response = await request()

    expect(response.statusCode).toBe(200)
    assertHealthPayloadMatchesSchema(response.result)
    expect(response.result.status).toBe(healthcheckData.expectedStatus)
  })
})