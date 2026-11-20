import { getDraft } from '../backend/drafts.js'
import { safeLoad } from './submissionViewHelpers.js'

const resumePaths = {
  clientDetails: '/submission-01-client-details',
  species: '/submission-02-species',
  animalDetails: '/submission-02-animal-details',
  clinicalHistory: '/submission-03-clinical-history'
}

const NOT_FOUND = 404
const UNPROCESSABLE = 422
const BAD_GATEWAY = 502
const UNAVAILABLE_MESSAGE =
  'This draft cannot be continued because its saved progress is unavailable.'

const draftError = (h, statusCode, message) =>
  h.view('draft-error.njk', { message }).code(statusCode)

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isContinuableDraft = (draft, draftId) =>
  isPlainObject(draft) &&
  draft.draftId === draftId &&
  typeof draft.status === 'string' &&
  draft.status.toLowerCase() === 'draft'

const hasResumableState = (draft) => {
  if (!resumePaths[draft.lastSavedPage]) {
    return false
  }
  if (
    draft.lastSavedPage === 'animalDetails' &&
    !draft.formData?.animalDetails?.speciesId
  ) {
    return false
  }
  return Number.isInteger(draft.revision) && isPlainObject(draft.formData)
}

const drafts = (server, submissionFormStateKey) => {
  server.route({
    method: 'GET',
    path: '/drafts/{draftId}/continue',
    handler: async (request, h) => {
      const result = await safeLoad(() => getDraft(request.params.draftId))
      if (result.error) {
        const statusCode = result.error.statusCode === NOT_FOUND ? NOT_FOUND : BAD_GATEWAY
        return draftError(h, statusCode, 'We could not load this draft. Try again later.')
      }

      const draft = result.data
      if (!isContinuableDraft(draft, request.params.draftId) || !hasResumableState(draft)) {
        return draftError(h, UNPROCESSABLE, UNAVAILABLE_MESSAGE)
      }
      const resumePath = resumePaths[draft.lastSavedPage]

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
