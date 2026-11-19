import { describe, expect, jest, test } from '@jest/globals'
import { getDraft } from '../../src/data/drafts.js'

describe('getDraft', () => {
  test('loads the complete draft state for its owner', async () => {
    const item = {
      submissionId: 'draft-001',
      status: 'Draft',
      userId: 'owner-1',
      revision: 3,
      lastSavedPage: 'submission-02-species',
      formData: { animalDetails: { species: 'Sheep' } }
    }
    const docClient = { send: jest.fn().mockResolvedValue({ Item: item }) }

    await expect(getDraft(docClient, 'draft-001', 'owner-1')).resolves.toEqual({
      draftId: 'draft-001',
      status: 'Draft',
      revision: 3,
      lastSavedPage: 'submission-02-species',
      formData: item.formData
    })
    expect(docClient.send.mock.calls[0][0].input).toEqual({
      TableName: 'adts-submissions',
      Key: { PK: 'DRAFT#draft-001' }
    })
  })

  test('accepts the contract lowercase draft status', async () => {
    const docClient = {
      send: jest.fn().mockResolvedValue({
        Item: {
          submissionId: 'draft-001',
          status: 'draft',
          ownerId: 'owner-1',
          revision: 1,
          lastSavedPage: 'submission-01-client-details',
          formData: {}
        }
      })
    }

    await expect(getDraft(docClient, 'draft-001', 'owner-1'))
      .resolves.toMatchObject({ status: 'draft' })
  })

  test.each([
    [undefined, 'draft-001', 'owner-1'],
    [{ submissionId: 'draft-001', status: 'Submitted', userId: 'owner-1' }, 'draft-001', 'owner-1'],
    [{ submissionId: 'draft-001', status: 'Draft', userId: 'owner-2' }, 'draft-001', 'owner-1']
  ])('does not return an inaccessible or non-draft record', async (item, draftId, ownerId) => {
    const docClient = { send: jest.fn().mockResolvedValue({ Item: item }) }

    await expect(getDraft(docClient, draftId, ownerId)).resolves.toBeUndefined()
  })
})
