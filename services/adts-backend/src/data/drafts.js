import { GetCommand } from '@aws-sdk/lib-dynamodb'

const tableName = () => process.env.SUBMISSIONS_TABLE || 'adts-submissions'

export const getDraft = async (docClient, draftId, ownerId) => {
  const result = await docClient.send(new GetCommand({
    TableName: tableName(),
    Key: { PK: `DRAFT#${draftId}` }
  }))
  const item = result.Item

  if (
    !item ||
    item.submissionId !== draftId ||
    typeof item.status !== 'string' ||
    item.status.toLowerCase() !== 'draft' ||
    (item.ownerId ?? item.userId) !== ownerId
  ) {
    return undefined
  }

  return {
    draftId: item.submissionId,
    status: item.status,
    revision: item.revision,
    lastSavedPage: item.lastSavedPage,
    formData: item.formData
  }
}
