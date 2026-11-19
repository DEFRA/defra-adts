import { describe, expect, test } from '@jest/globals'
import { loadConfig } from '../../src/config.js'

const validEnvironment = {
  LIMS_BASE_URL: 'https://lims.example.test',
  LIMS_PREFIX: '/lims/api',
  LIMS_TIMEOUT_MS: '10000'
}

describe('service configuration', () => {
  test('loads and normalizes valid LIMS settings', () => {
    const config = loadConfig(validEnvironment)

    expect(config.lims).toEqual({
      baseUrl: 'https://lims.example.test',
      prefix: 'lims/api',
      timeoutMs: 10000,
      allowHttp: false
    })
  })

  test('requires the LIMS origin and does not require credentials', () => {
    expect(() => loadConfig({})).toThrow(/LIMS_BASE_URL/)
    const { lims } = loadConfig(validEnvironment)
    expect(lims).not.toHaveProperty('username')
    expect(lims).not.toHaveProperty('password')
  })

  test('rejects invalid URLs and non-positive or non-integer deadlines', () => {
    expect(() => loadConfig({ ...validEnvironment, LIMS_BASE_URL: 'ftp://lims.example.test' })).toThrow(/LIMS_BASE_URL/)
    expect(() => loadConfig({ ...validEnvironment, LIMS_TIMEOUT_MS: '0' })).toThrow(/LIMS_TIMEOUT_MS/)
    expect(() => loadConfig({ ...validEnvironment, LIMS_TIMEOUT_MS: '1.5' })).toThrow(/LIMS_TIMEOUT_MS/)
  })

  test('rejects credentials, queries, and fragments embedded in the base URL', () => {
    expect(() => loadConfig({ ...validEnvironment, LIMS_BASE_URL: 'https://user:password@lims.example.test' })).toThrow(/LIMS_BASE_URL/)
    expect(() => loadConfig({ ...validEnvironment, LIMS_BASE_URL: 'https://lims.example.test/?query=1' })).toThrow(/LIMS_BASE_URL/)
    expect(() => loadConfig({ ...validEnvironment, LIMS_BASE_URL: 'https://lims.example.test/#fragment' })).toThrow(/LIMS_BASE_URL/)
  })

  test('rejects unsafe prefixes and permits an empty prefix', () => {
    expect(() => loadConfig({ ...validEnvironment, LIMS_PREFIX: '../other' })).toThrow(/LIMS_PREFIX/)
    expect(() => loadConfig({ ...validEnvironment, LIMS_PREFIX: '%2e%2e/other' })).toThrow(/LIMS_PREFIX/)
    expect(() => loadConfig({ ...validEnvironment, LIMS_PREFIX: 'bad%2' })).toThrow(/LIMS_PREFIX/)
    expect(loadConfig({ ...validEnvironment, LIMS_PREFIX: '' }).lims.prefix).toBe('')
  })

  test('requires the explicit exception before accepting an HTTP LIMS origin', () => {
    const httpEnvironment = { ...validEnvironment, LIMS_BASE_URL: 'http://lims.example.test' }

    expect(() => loadConfig(httpEnvironment)).toThrow(/LIMS_ALLOW_HTTP/)
    expect(loadConfig({ ...httpEnvironment, LIMS_ALLOW_HTTP: 'true' }).lims.allowHttp).toBe(true)
  })

  test('does not expose configured credential values in validation errors', () => {
    const secret = 'do-not-leak-this-secret'

    expect(() => loadConfig({
      ...validEnvironment,
      LIMS_TIMEOUT_MS: 'invalid'
    })).toThrow(expect.not.stringContaining(secret))
  })
})
