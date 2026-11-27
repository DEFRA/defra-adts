import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const existingDraft = {
  PK: 'DRAFT#123e4567-e89b-12d3-a456-426614174000',
  draftId: '123e4567-e89b-12d3-a456-426614174000',
  ownerId: 'local-test-owner',
  lastSavedPage: 'clientDetails',
  formData: { clientDetails: { name: 'Acme Farm' } },
  status: 'draft',
  revision: 1,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
  GSI1PK: 'USER#local-test-owner',
  GSI1SK: '2026-11-18T10:00:00.000Z#DRAFT#123e4567-e89b-12d3-a456-426614174000'
}

describe('Draft save route', () => {
  let server
  const docClient = { send: jest.fn() }
  const originalOwner = process.env.LOCAL_DRAFT_OWNER_ID
  const originalNodeEnv = process.env.NODE_ENV

  const mockMappingThen = (...responses) => {
    const remaining = [...responses]
    docClient.send.mockImplementation(({ input }) => {
      if (input.TableName === 'adts-ci-lims-mapping') {
        return Promise.resolve({ Item: { PK: 'local-test-owner', limsId: 'PVS001' } })
      }
      const response = remaining.shift()
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response || {})
    })
  }

  beforeAll(async () => {
    process.env.PORT = '3200'
    process.env.LOCAL_DRAFT_OWNER_ID = 'local-test-owner'
    process.env.NODE_ENV = 'development'
    server = await createServer({ docClient })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    docClient.send.mockReset()
    process.env.LOCAL_DRAFT_OWNER_ID = 'local-test-owner'
    process.env.NODE_ENV = 'development'
  })

  afterAll(async () => {
    await server.stop()
    if (originalOwner === undefined) {
      delete process.env.LOCAL_DRAFT_OWNER_ID
    } else {
      process.env.LOCAL_DRAFT_OWNER_ID = originalOwner
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  const post = (payload) => server.inject({ method: 'POST', url: '/drafts', payload })

  test('creates a DynamoDB draft using the local development owner', async () => {
    mockMappingThen({})

    const response = await post({
      lastSavedPage: 'clientDetails',
      formData: { clientDetails: { name: 'Acme Farm' } }
    })

    expect(response.statusCode).toBe(201)
    expect(response.result).toMatchObject({
      revision: 1,
      lastSavedPage: 'clientDetails'
    })
    expect(response.result.draftId).toMatch(/^[\da-f-]{36}$/i)
    expect(docClient.send.mock.calls[1][0].input.Item).toMatchObject({
      ownerId: 'local-test-owner',
      lastSavedPage: 'clientDetails',
      formData: { clientDetails: { name: 'Acme Farm' } }
    })
  })

  test('updates an existing draft with its expected revision', async () => {
    mockMappingThen(
      { Item: existingDraft },
      {
        Attributes: {
          ...existingDraft,
          lastSavedPage: 'clinicalHistory',
          formData: { clinicalHistory: { sampleTakenDate: '2026-11-18' } },
          revision: 2,
          updatedAt: '2026-11-18T11:00:00.000Z'
        }
      }
    )

    const response = await post({
      draftId: existingDraft.draftId,
      revision: 1,
      lastSavedPage: 'clinicalHistory',
      formData: { clinicalHistory: { sampleTakenDate: '2026-11-18' } }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      draftId: existingDraft.draftId,
      revision: 2,
      lastSavedPage: 'clinicalHistory'
    })
    expect(docClient.send).toHaveBeenCalledTimes(3)
  })

  test('rejects invalid snapshots and client-supplied owner IDs', async () => {
    const invalidPage = await post({
      lastSavedPage: 'arbitrary-page',
      formData: {}
    })
    const suppliedOwner = await post({
      ownerId: 'another-owner',
      lastSavedPage: 'clientDetails',
      formData: {}
    })

    expect(invalidPage.statusCode).toBe(400)
    expect(suppliedOwner.statusCode).toBe(400)
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('does not use the local owner fallback in production', async () => {
    process.env.NODE_ENV = 'production'

    const response = await post({
      lastSavedPage: 'clientDetails',
      formData: {}
    })

    expect(response.statusCode).toBe(401)
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('returns a gateway error when DynamoDB cannot save the draft', async () => {
    mockMappingThen(new Error('DynamoDB unavailable'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await post({
      lastSavedPage: 'clientDetails',
      formData: {}
    })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual({ error: 'Unable to save draft' })
    expect(console.error).toHaveBeenCalledWith('Error saving draft:', 'DynamoDB unavailable')
  })

  test('denies draft creation when the CI user has no LIMS mapping', async () => {
    docClient.send.mockResolvedValue({})

    const response = await post({
      lastSavedPage: 'clientDetails',
      formData: { clientDetails: { name: 'Acme Farm' } }
    })

    expect(response.statusCode).toBe(403)
    expect(response.result).toEqual({
      error: 'No LIMS practice is associated with this account'
    })
    expect(docClient.send).toHaveBeenCalledTimes(1)
  })
})
