import { createUpdateDraft } from '../backend/drafts.js'

export const DRAFT_SAVE_ERROR = 'We could not save your draft. Try again. Your changes have not been saved.'

export const persistSubmissionDraft = async (
  request,
  submissionFormStateKey,
  lastSavedPage,
  formData
) => {
  const submissionFormState = request.yar.get(submissionFormStateKey) || {}

  try {
    const draft = await createUpdateDraft({
      ...(submissionFormState.draftId && {
        draftId: submissionFormState.draftId,
        revision: submissionFormState.draftRevision
      }),
      lastSavedPage,
      formData
    })

    request.yar.set(submissionFormStateKey, {
      ...submissionFormState,
      draftId: draft.draftId,
      draftRevision: draft.revision,
      formData
    })
    request.yar.touch()
    return true
  } catch (error) {
    console.error('Error saving submission draft:', error.message)
    return false
  }
}
