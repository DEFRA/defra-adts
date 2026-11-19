export const getDraft = async (draftId) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const headers = process.env.NODE_ENV === 'development' && process.env.LOCAL_DRAFT_OWNER_ID
    ? { 'x-local-draft-owner-id': process.env.LOCAL_DRAFT_OWNER_ID }
    : undefined
  const response = await fetch(
    `${backendBaseUrl}/drafts/${encodeURIComponent(draftId)}`,
    { headers }
  )

  if (!response.ok) {
    const error = new Error(`Draft retrieval failed with status ${response.status}`)
    error.statusCode = response.status
    throw error
  }

  return response.json()
}
