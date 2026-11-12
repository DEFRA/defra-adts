/**
 * Integration tests for GET /GetAnimalDetails against the local DynamoDB
 * instance (http://localhost:8000) with the seed data in
 * local/dynamodb/seed/adts-ref-data-*.json.
 *
 * Verifies the handler's end-to-end behaviour against real Dynamo:
 *  - returns the expected lookup shape with the seeded options
 *  - applies species-specific vs generic fallback partitions
 *  - applies avian / non-avian filtering (forAvianSpecies)
 *  - returns the correct error responses for missing/unknown species
 *  - reports a gateway error when Dynamo is unreachable
 *
 * Prereq: local Dynamo running with seeded data
 * (npm run test:db:up && npm run test:db:reset from repo root).
 */

import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('GET /GetAnimalDetails with local DynamoDB', () => {
  let server
  const testEnvironment = {
    DYNAMODB_ENDPOINT: 'http://localhost:8000',
    AWS_REGION: 'eu-west-2',
    AWS_ACCESS_KEY_ID: 'local',
    AWS_SECRET_ACCESS_KEY: 'local'
  }
  const originalEnvironment = Object.fromEntries(
    Object.keys(testEnvironment).map((key) => [key, process.env[key]])
  )

  beforeAll(async () => {
    Object.assign(process.env, testEnvironment)
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  test('returns species-specific breeds and purposes for a non-avian species (CATTLE)', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=CATTLE' })

    expect(response.statusCode).toBe(200)
    expect(response.result.speciesId).toBe('CATTLE')

    expect(response.result.breeds).toContainEqual({ value: 'BEEFMASTER', label: 'Beefmaster' })
    expect(response.result.purposes).toContainEqual({ value: 'MILK', label: 'Dairy' })
  })

  test('includes non-avian keeping types, sexes, ages and organic flag for CATTLE', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=CATTLE' })

    expect(response.statusCode).toBe(200)

    // HOUSED and OUTDOOR are non-avian; avian housing is filtered out.
    const housingValues = response.result.keepingTypes.map((option) => option.value)
    expect(housingValues).toEqual(expect.arrayContaining(['HOUSED', 'OUTDOOR']))
    expect(housingValues).not.toContain('BARN')

    const sexValues = response.result.sexes.map((option) => option.value)
    expect(sexValues).toEqual(expect.arrayContaining(['FEMALE', 'MALE', 'CASTRATE']))

    const ageValues = response.result.ageCategories.map((option) => option.value)
    expect(ageValues).toContain('ADULT')
    expect(ageValues).toContain('NEONATAL')

    expect(response.result.organicAccreditationApplicable).toBe(true)
  })

  test('applies avian filtering for CHICKEN', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=CHICKEN' })

    expect(response.statusCode).toBe(200)
    expect(response.result.speciesId).toBe('CHICKEN')

    expect(response.result.breeds.length).toBeGreaterThan(0)
    expect(response.result.breeds.map((option) => option.value)).not.toContain('BEEFMASTER')
    expect(response.result.purposes.map((option) => option.value)).not.toContain('MILK')

    const housingValues = response.result.keepingTypes.map((option) => option.value)
    expect(housingValues).toContain('BARN')
    expect(housingValues).not.toContain('HOUSED')

    const ageValues = response.result.ageCategories.map((option) => option.value)
    expect(ageValues).toContain('0-3')
    expect(ageValues).not.toContain('NEONATAL')

    expect(response.result.organicAccreditationApplicable).toBe(false)

    const sexValues = response.result.sexes.map((option) => option.value)
    expect(sexValues).toContain('CASTRATE')
    expect(sexValues).not.toContain('FEMALE')
  })

  test('returns Sheep-specific lookups without leaking Cattle breeds', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=SHEEP' })

    expect(response.statusCode).toBe(200)
    expect(response.result.speciesId).toBe('SHEEP')

    expect(response.result.breeds.length).toBeGreaterThan(0)
    expect(response.result.breeds.map((option) => option.value)).not.toContain('BEEFMASTER')
    expect(response.result.purposes).toContainEqual({ value: 'HILLSHEEP', label: 'Hill' })

    expect(response.result.keepingTypes.map((o) => o.value)).toEqual(expect.arrayContaining(['HOUSED', 'OUTDOOR']))
    expect(response.result.ageCategories.map((o) => o.value)).toContain('NEONATAL')
    expect(response.result.organicAccreditationApplicable).toBe(true)
  })

  test('rejects a request without speciesId (Joi validation)', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails' })

    expect(response.statusCode).toBe(400)
  })

  test('rejects a request with an empty speciesId', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=' })

    expect(response.statusCode).toBe(400)
  })

  test('returns 404 for an unknown species', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=UNKNOWN-SPECIES-999' })

    expect(response.statusCode).toBe(404)
    expect(response.result).toEqual({ error: 'Species not found' })
  })

  test('reports a DynamoDB failure as 502 instead of returning empty results', async () => {
    const originalTable = process.env.REFERENCE_DATA_TABLE
    process.env.REFERENCE_DATA_TABLE = 'missing-integration-test-table'
    jest.spyOn(console, 'error').mockImplementation(() => {})

    let response
    try {
      response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=COW' })
    } finally {
      if (originalTable === undefined) {
        delete process.env.REFERENCE_DATA_TABLE
      } else {
        process.env.REFERENCE_DATA_TABLE = originalTable
      }
      jest.restoreAllMocks()
    }

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to retrieve animal details' })
  })
})
