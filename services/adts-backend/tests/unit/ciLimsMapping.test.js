import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { getLimsIdForCiId } from '../../src/data/ciLimsMapping.js'

describe('CI-to-LIMS mapping', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('looks up the authenticated CI ID in the mapping table', async () => {
    const docClient = { send: jest.fn().mockResolvedValue({ Item: { limsId: 'PVS001' } }) }

    await expect(getLimsIdForCiId(docClient, 'ci-user-123')).resolves.toBe('PVS001')
    expect(docClient.send.mock.calls[0][0].input).toEqual({
      TableName: 'adts-ci-lims-mapping',
      Key: { PK: 'ci-user-123' }
    })
  })

  test('returns undefined when the authenticated CI ID has no mapping', async () => {
    const docClient = { send: jest.fn().mockResolvedValue({}) }

    await expect(getLimsIdForCiId(docClient, 'ci-user-unknown')).resolves.toBeUndefined()
  })

  test('rejects missing CI IDs instead of querying a shared mapping', async () => {
    const docClient = { send: jest.fn() }

    await expect(getLimsIdForCiId(docClient, '')).rejects.toThrow(
      'Authenticated CI ID is required to resolve the LIMS ID'
    )
    expect(docClient.send).not.toHaveBeenCalled()
  })
})
