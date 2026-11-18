import { describe, expect, jest, test } from '@jest/globals'
import {
  createDraft,
  createUpdateDraft,
  DraftConflictError,
  DraftNotFoundError,
  DraftValidationError,
  getDraft,
  updateDraft
} from '../../src/client/drafts.js'

const existingDraft = (overrides = {}) => ({
  PK: 'DRAFT#draft-123',
  draftId: 'draft-123',
  ownerId: 'user-123',
  lastSavedPage: 'clientDetails',
  formData: { clientDetails: { name: 'Acme Farm' } },
  status: 'draft',
  revision: 1,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
  ...overrides
})

const clientReturning = (...responses) => ({
  send: jest.fn().mockImplementation(async () => {
    const response = responses.shift()
    if (response instanceof Error) {
      throw response
    }
    return response
  })
})

const input = (overrides = {}) => ({
  ownerId: 'user-123',
  lastSavedPage: 'clientDetails',
  formData: { clientDetails: { name: 'Acme Farm' } },
  now: new Date('2026-11-18T10:00:00.000Z'),
  ...overrides
})

describe('draft persistence', () => {
  test('creates a backend-identified draft with initial lifecycle metadata', async () => {
    const docClient = clientReturning({})

    const draft = await createDraft(docClient, input())

    expect(draft).toMatchObject({
      ownerId: 'user-123',
      lastSavedPage: 'clientDetails',
      formData: { clientDetails: { name: 'Acme Farm' } },
      status: 'draft',
      revision: 1,
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z'
    })
    expect(draft.draftId).toMatch(/^[\da-f-]{36}$/i)

    const command = docClient.send.mock.calls[0][0].input
    expect(command.TableName).toBe('adts-submissions')
    expect(command.Item).toMatchObject({
      PK: `DRAFT#${draft.draftId}`,
      ...draft
    })
    expect(command.ConditionExpression).toBe('attribute_not_exists(PK)')
  })

  test('requires a valid owner, allowlisted page, and full form object before writing', async () => {
    const docClient = clientReturning({})

    await expect(createDraft(docClient, input({ ownerId: '' })))
      .rejects.toBeInstanceOf(DraftValidationError)
    await expect(createDraft(docClient, input({ ownerId: undefined })))
      .rejects.toBeInstanceOf(DraftValidationError)
    await expect(createDraft(docClient, input({ lastSavedPage: 'arbitrary-path' })))
      .rejects.toBeInstanceOf(DraftValidationError)
    await expect(createDraft(docClient, input({ formData: [] })))
      .rejects.toBeInstanceOf(DraftValidationError)
    await expect(createDraft(docClient, input({ formData: null })))
      .rejects.toBeInstanceOf(DraftValidationError)
    await expect(createDraft(docClient, input({ now: new Date('invalid') })))
      .rejects.toBeInstanceOf(DraftValidationError)
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('validates draft identifiers and update revisions before accessing storage', async () => {
    const docClient = clientReturning({})

    await expect(getDraft(docClient, { draftId: '', ownerId: 'user-123' }))
      .rejects.toBeInstanceOf(DraftValidationError)
    await expect(getDraft(docClient, { ownerId: 'user-123' }))
      .rejects.toBeInstanceOf(DraftValidationError)
    await expect(updateDraft(docClient, {
      ...input(),
      draftId: 'draft-123',
      revision: 0
    })).rejects.toBeInstanceOf(DraftValidationError)
    expect(docClient.send).not.toHaveBeenCalled()
  })

  test('loads a draft only for its owner and conceals missing or foreign drafts', async () => {
    const docClient = clientReturning({ Item: existingDraft() })

    await expect(getDraft(docClient, { draftId: 'draft-123', ownerId: 'user-999' }))
      .rejects.toBeInstanceOf(DraftNotFoundError)
    expect(docClient.send.mock.calls[0][0].input).toMatchObject({
      TableName: 'adts-submissions',
      Key: { PK: 'DRAFT#draft-123' },
      ConsistentRead: true
    })

    await expect(getDraft(clientReturning({}), { draftId: 'draft-404', ownerId: 'user-123' }))
      .rejects.toBeInstanceOf(DraftNotFoundError)
  })

  test('updates a complete snapshot with a conditional monotonic revision and preserves creation time', async () => {
    const updated = existingDraft({
      lastSavedPage: 'animalDetails',
      formData: { animalDetails: { species: 'Cattle' } },
      revision: 2,
      updatedAt: '2026-11-18T11:00:00.000Z'
    })
    const docClient = clientReturning({ Item: existingDraft() }, { Attributes: updated })

    const result = await updateDraft(docClient, {
      ...input({
        lastSavedPage: 'animalDetails',
        formData: { animalDetails: { species: 'Cattle' } },
        now: new Date('2026-11-18T11:00:00.000Z')
      }),
      draftId: 'draft-123',
      revision: 1
    })

    expect(result).toMatchObject({
      draftId: 'draft-123',
      revision: 2,
      createdAt: '2026-11-18T10:00:00.000Z',
      lastSavedPage: 'animalDetails',
      formData: { animalDetails: { species: 'Cattle' } }
    })
    const command = docClient.send.mock.calls[1][0].input
    expect(command.ConditionExpression).toContain('#revision = :expectedRevision')
    expect(command.ConditionExpression).toContain('ownerId = :ownerId')
    expect(command.ConditionExpression).toContain('#status = :draft')
    expect(command.UpdateExpression).toContain('#revision = #revision + :one')
    expect(command.UpdateExpression).not.toContain('createdAt')
  })

  test('reports stale concurrent writes as draft conflicts', async () => {
    const conditionalError = Object.assign(new Error('conditional check failed'), {
      name: 'ConditionalCheckFailedException'
    })
    const docClient = clientReturning({ Item: existingDraft() }, conditionalError)

    await expect(updateDraft(docClient, {
      ...input(),
      draftId: 'draft-123',
      revision: 1
    })).rejects.toBeInstanceOf(DraftConflictError)
  })

  test('propagates non-conflict update storage errors and rejects incomplete update responses', async () => {
    const storageError = new Error('DynamoDB unavailable')
    await expect(updateDraft(clientReturning({ Item: existingDraft() }, storageError), {
      ...input(),
      draftId: 'draft-123',
      revision: 1
    })).rejects.toBe(storageError)

    await expect(updateDraft(clientReturning({ Item: existingDraft() }, {}), {
      ...input(),
      draftId: 'draft-123',
      revision: 1
    })).rejects.toThrow('DynamoDB did not return the updated draft')
  })

  test('does not update a draft owned by another user or one no longer in Draft status', async () => {
    await expect(updateDraft(clientReturning({ Item: existingDraft({ ownerId: 'user-999' }) }), {
      ...input(),
      draftId: 'draft-123',
      revision: 1
    })).rejects.toBeInstanceOf(DraftNotFoundError)

    await expect(updateDraft(clientReturning({ Item: existingDraft({ status: 'submitted' }) }), {
      ...input(),
      draftId: 'draft-123',
      revision: 1
    })).rejects.toBeInstanceOf(DraftConflictError)
  })

  test('propagates DynamoDB failures instead of returning an empty draft result', async () => {
    const storageError = new Error('DynamoDB unavailable')

    await expect(getDraft(clientReturning(storageError), {
      draftId: 'draft-123',
      ownerId: 'user-123'
    })).rejects.toBe(storageError)
  })

  test('dispatches create and update according to whether the draft has an identifier', async () => {
    const createClient = clientReturning({})
    const created = await createUpdateDraft(createClient, input())
    expect(created.revision).toBe(1)

    const updateClient = clientReturning(
      { Item: existingDraft() },
      { Attributes: existingDraft({ revision: 2 }) }
    )
    const updated = await createUpdateDraft(updateClient, {
      ...input(),
      draftId: 'draft-123',
      revision: 1
    })
    expect(updated.revision).toBe(2)
  })
})
