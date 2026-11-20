import { fetchFromBackend } from './auth.js'

export const getDraft = async (draftId, request) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const headers = request.server.app.authMode === 'mock' && process.env.LOCAL_DRAFT_OWNER_ID
    ? { 'x-local-draft-owner-id': process.env.LOCAL_DRAFT_OWNER_ID }
    : {}
  const response = await fetchFromBackend(
    `${backendBaseUrl}/drafts/${encodeURIComponent(draftId)}`,
    request,
    headers
  )

  if (!response.ok) {
    const error = new Error(`Draft retrieval failed with status ${response.status}`)
    error.statusCode = response.status
    throw error
  }

  return response.json()
}
