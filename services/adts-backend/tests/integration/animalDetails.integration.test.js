/**
 * Integration tests for GET /GetAnimalDetails against the local DynamoDB
 * instance (http://localhost:8000) with the seed data in
 * local/dynamodb/seed/adts-reference-data.json.
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

// TODO: Re-enable when get-clients cross-service test is moved out of UI integration suite.
// Currently fails in CI because UI workflow doesn't install submissions-service/backend deps.
// Tracked by: <755932>
describe.skip('GET /GetAnimalDetails with local DynamoDB', () => {
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

  const expectOption = (option, value, label) => {
    expect(option).toEqual({ value, label })
  }

  test('returns species-specific breeds and purposes for a non-avian species (COW)', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=COW' })

    expect(response.statusCode).toBe(200)
    expect(response.result.speciesId).toBe('COW')

    // Species-specific partitions: only one breed and one purpose seeded for Cow
    expect(response.result.breeds).toHaveLength(1)
    expectOption(response.result.breeds[0], 'HOLSTEIN', 'Holstein')
    expect(response.result.purposes).toHaveLength(1)
    expectOption(response.result.purposes[0], 'DAIRY', 'Dairy')
  })

  test('includes non-avian keeping types, sexes, ages and organic flag for COW', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=COW' })

    expect(response.statusCode).toBe(200)

    // Housings: HOUSED + OUTDOOR are non-avian, AVIARY is avian and must be filtered out
    const housingValues = response.result.keepingTypes.map((option) => option.value)
    expect(housingValues).toEqual(expect.arrayContaining(['HOUSED', 'OUTDOOR']))
    expect(housingValues).not.toContain('AVIARY')

    // Sex groups: no forAvianSpecies filter, all three expected
    const sexValues = response.result.sexes.map((option) => option.value)
    expect(sexValues).toEqual(expect.arrayContaining(['FEMALE', 'MALE', 'MIXED']))

    // Age categories: both seeded entries are non-avian
    const ageValues = response.result.ageCategories.map((option) => option.value)
    expect(ageValues).toEqual(expect.arrayContaining(['ADULT', 'CALF']))

    // Organic applies for non-avian species
    expect(response.result.organicAccreditationApplicable).toBe(true)
  })

  test('applies avian filtering for CHICKEN — only avian options and no non-avian lookups', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=CHICKEN' })

    expect(response.statusCode).toBe(200)
    expect(response.result.speciesId).toBe('CHICKEN')

    // No chicken-specific breed or purpose seeded, and generic fallback has none either
    expect(response.result.breeds).toEqual([])
    expect(response.result.purposes).toEqual([])

    // Housings: only AVIARY applies for avian; HOUSED and OUTDOOR are non-avian
    const housingValues = response.result.keepingTypes.map((option) => option.value)
    expect(housingValues).toEqual(['AVIARY'])

    // Age categories: both seeded entries are non-avian → chicken sees none
    expect(response.result.ageCategories).toEqual([])

    // Organic entries are all non-avian → not applicable for chicken
    expect(response.result.organicAccreditationApplicable).toBe(false)

    // Sex groups have no forAvianSpecies filter → still returned for chicken
    const sexValues = response.result.sexes.map((option) => option.value)
    expect(sexValues).toEqual(expect.arrayContaining(['FEMALE', 'MALE', 'MIXED']))
  })

  test('returns empty species-specific lookups for a species with no seeded breeds (SHEEP)', async () => {
    const response = await server.inject({ method: 'GET', url: '/GetAnimalDetails?speciesId=SHEEP' })

    expect(response.statusCode).toBe(200)
    expect(response.result.speciesId).toBe('SHEEP')

    // No sheep-specific breed or purpose seeded; fallbacks also empty for sheep
    expect(response.result.breeds).toEqual([])
    expect(response.result.purposes).toEqual([])

    // Sheep is non-avian, so still gets the shared non-avian lookups
    expect(response.result.keepingTypes.map((o) => o.value)).toEqual(expect.arrayContaining(['HOUSED', 'OUTDOOR']))
    expect(response.result.ageCategories.map((o) => o.value)).toEqual(expect.arrayContaining(['ADULT', 'CALF']))
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
