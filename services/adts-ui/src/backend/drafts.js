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
    throw new Error('Saving draft returned an invalid response')
  }

  return draft
}
