import { getDraft } from '../backend/drafts.js'
import { safeLoad } from './submissionViewHelpers.js'

const resumePaths = {
  'submission-01-client-details': '/submission-01-client-details',
  'submission-02-species': '/submission-02-species',
  'submission-02-animal-details': '/submission-02-animal-details',
  'submission-03-clinical-history': '/submission-03-clinical-history'
}

const draftError = (h, statusCode, message) =>
  h.view('draft-error.njk', { message }).code(statusCode)

const drafts = (server, submissionFormStateKey) => {
  server.route({
    method: 'GET',
    path: '/drafts/{draftId}/continue',
    handler: async (request, h) => {
      const result = await safeLoad(() => getDraft(request.params.draftId))
      if (result.error) {
        const statusCode = result.error.statusCode === 404 ? 404 : 502
        return draftError(h, statusCode, 'We could not load this draft. Try again later.')
      }

      const draft = result.data
      if (
        !draft ||
        typeof draft !== 'object' ||
        Array.isArray(draft) ||
        typeof draft.draftId !== 'string' ||
        draft.draftId !== request.params.draftId ||
        typeof draft.status !== 'string' ||
        draft.status.toLowerCase() !== 'draft'
      ) {
        return draftError(h, 422, 'This draft cannot be continued because its saved progress is unavailable.')
      }

      const resumePath = resumePaths[draft.lastSavedPage]
      const savedSpeciesId = draft.formData?.animalDetails?.speciesId
      if (
        !resumePath ||
        (draft.lastSavedPage === 'submission-02-animal-details' && !savedSpeciesId) ||
        !Number.isInteger(draft.revision) ||
        !draft.formData ||
        typeof draft.formData !== 'object' ||
        Array.isArray(draft.formData)
      ) {
        return draftError(h, 422, 'This draft cannot be continued because its saved progress is unavailable.')
      }

      request.yar.set(submissionFormStateKey, {
        draftId: draft.draftId,
        revision: draft.revision,
        lastSavedPage: draft.lastSavedPage,
        formData: draft.formData
      })
      request.yar.touch()

      return h.redirect(resumePath)
    }
  })
}

export default drafts
