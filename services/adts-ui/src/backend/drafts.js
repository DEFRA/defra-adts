import { fetchFromBackend } from './auth.js'

export const createUpdateDraft = async ({
  draftId,
  revision,
  lastSavedPage,
  formData
}) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(draftId && { draftId }),
      ...(revision && { revision }),
      lastSavedPage,
      formData
    })
  })

  if (!response.ok) {
    throw new Error(`Saving draft failed with status ${response.status}`)
  }

  const draft = await response.json()
  if (typeof draft.draftId !== 'string' || !Number.isSafeInteger(draft.revision)) {
    throw new TypeError('Saving draft returned an invalid response')
  }

  return draft
}

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
