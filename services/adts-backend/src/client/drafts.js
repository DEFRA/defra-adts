import { randomUUID } from 'node:crypto'
import {
  GetCommand,
  PutCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb'
import { submissionsTable } from '../data/dynamo.js'

export const draftPageKeys = Object.freeze([
  'clientDetails',
  'animalDetails',
  'clinicalHistory',
  'chooseTests',
  'basket',
  'deliveryAddress',
  'reviewSubmit',
  'printDocuments'
])

export class DraftValidationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'DraftValidationError'
  }
}

export class DraftNotFoundError extends Error {
  constructor () {
    super('Draft not found')
    this.name = 'DraftNotFoundError'
  }
}

export class DraftConflictError extends Error {
  constructor () {
    super('Draft has changed or can no longer be updated')
    this.name = 'DraftConflictError'
  }
}

const validateOwnerId = (ownerId) => {
  if (typeof ownerId !== 'string' || !ownerId.trim()) {
    throw new DraftValidationError('A trusted owner ID is required')
  }
}

const validateDraftId = (draftId) => {
  if (typeof draftId !== 'string' || !draftId.trim()) {
    throw new DraftValidationError('A draft ID is required')
  }
}

const validateSnapshot = ({ lastSavedPage, formData }) => {
  if (!draftPageKeys.includes(lastSavedPage)) {
    throw new DraftValidationError('The saved page is not allowed')
  }
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
    throw new DraftValidationError('Draft form data must be an object')
  }
}

const validateRevision = (revision) => {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new DraftValidationError('A positive draft revision is required')
  }
}

const timestamp = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new DraftValidationError('A valid timestamp is required')
  }
  return date.toISOString()
}

const toDraft = (item) => ({
  draftId: item.draftId,
  ownerId: item.ownerId,
  lastSavedPage: item.lastSavedPage,
  formData: item.formData,
  status: item.status,
  revision: item.revision,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
})

export const createDraft = async (docClient, {
  ownerId,
  lastSavedPage,
  formData,
  now = new Date()
}) => {
  validateOwnerId(ownerId)
  validateSnapshot({ lastSavedPage, formData })

  const draftId = randomUUID()
  const createdAt = timestamp(now)
  const item = {
    PK: `DRAFT#${draftId}`,
    draftId,
    ownerId,
    lastSavedPage,
    formData,
    status: 'draft',
    revision: 1,
    createdAt,
    updatedAt: createdAt
  }

  await docClient.send(new PutCommand({
    TableName: submissionsTable(),
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)'
  }))

  return toDraft(item)
}

export const getDraft = async (docClient, { draftId, ownerId }) => {
  validateDraftId(draftId)
  validateOwnerId(ownerId)

  const result = await docClient.send(new GetCommand({
    TableName: submissionsTable(),
    Key: { PK: `DRAFT#${draftId}` },
    ConsistentRead: true
  }))
  const item = result.Item

  if (!item || item.ownerId !== ownerId) {
    throw new DraftNotFoundError()
  }

  return toDraft(item)
}

export const updateDraft = async (docClient, {
  draftId,
  ownerId,
  lastSavedPage,
  formData,
  revision,
  now = new Date()
}) => {
  validateDraftId(draftId)
  validateOwnerId(ownerId)
  validateSnapshot({ lastSavedPage, formData })
  validateRevision(revision)

  const existing = await getDraft(docClient, { draftId, ownerId })
  if (existing.status !== 'draft') {
    throw new DraftConflictError()
  }

  const updatedAt = timestamp(now)
  let result
  try {
    result = await docClient.send(new UpdateCommand({
      TableName: submissionsTable(),
      Key: { PK: `DRAFT#${draftId}` },
      UpdateExpression: 'SET #lastSavedPage = :lastSavedPage, #formData = :formData, #updatedAt = :updatedAt, #revision = #revision + :one',
      ConditionExpression: 'ownerId = :ownerId AND #revision = :expectedRevision AND #status = :draft',
      ExpressionAttributeNames: {
        '#lastSavedPage': 'lastSavedPage',
        '#formData': 'formData',
        '#updatedAt': 'updatedAt',
        '#revision': 'revision',
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':lastSavedPage': lastSavedPage,
        ':formData': formData,
        ':updatedAt': updatedAt,
        ':ownerId': ownerId,
        ':expectedRevision': revision,
        ':one': 1,
        ':draft': 'draft'
      },
      ReturnValues: 'ALL_NEW'
    }))
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new DraftConflictError()
    }
    throw error
  }

  if (!result.Attributes) {
    throw new Error('DynamoDB did not return the updated draft')
  }

  return toDraft(result.Attributes)
}

export const createUpdateDraft = async (docClient, values) => {
  if (values.draftId) {
    return updateDraft(docClient, values)
  }
  return createDraft(docClient, values)
}
