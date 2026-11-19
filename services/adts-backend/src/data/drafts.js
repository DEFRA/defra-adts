import { GetCommand } from '@aws-sdk/lib-dynamodb'

const tableName = () => process.env.SUBMISSIONS_TABLE || 'adts-submissions'

export const getDraft = async (docClient, draftId, ownerId) => {
  const result = await docClient.send(new GetCommand({
    TableName: tableName(),
    Key: { PK: `DRAFT#${draftId}` }
  }))
  const item = result.Item
  const storedDraftId = item?.draftId ?? item?.submissionId

  if (
    !item ||
    storedDraftId !== draftId ||
    typeof item.status !== 'string' ||
    item.status.toLowerCase() !== 'draft' ||
    (item.ownerId ?? item.userId) !== ownerId
  ) {
    return undefined
  }

  return {
    draftId: storedDraftId,
    status: item.status,
    revision: item.revision,
    lastSavedPage: item.lastSavedPage,
    formData: item.formData
  }
}
