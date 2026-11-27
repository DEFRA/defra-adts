import Joi from 'joi'
import { constants } from 'node:http2'
import {
  createUpdateDraft,
  DraftConflictError,
  DraftNotFoundError,
  DraftValidationError,
  draftPageKeys
} from '../client/drafts.js'
import { getLimsIdForCiId } from '../data/ciLimsMapping.js'

const saveDraftSchema = Joi.object({
  draftId: Joi.string().uuid(),
  revision: Joi.number().integer().min(1),
  lastSavedPage: Joi.string().valid(...draftPageKeys).required(),
  formData: Joi.object().unknown(true).required()
}).and('draftId', 'revision')

const getOwnerId = (request) => {
  const principalId = request.auth?.credentials?.sub
  if (typeof principalId === 'string' && principalId.trim()) {
    return principalId.trim()
  }

  const localOwnerId = process.env.NODE_ENV === 'development'
    ? process.env.LOCAL_DRAFT_OWNER_ID?.trim()
    : undefined
  return localOwnerId || undefined
}

const registerDraftRoutes = (server, getDynamoClient) => {
  server.route({
    method: 'POST',
    path: '/drafts',
    options: {
      validate: { payload: saveDraftSchema }
    },
    handler: async (request, h) => {
      const ownerId = getOwnerId(request)
      if (!ownerId) {
        return h.response({ error: 'An authenticated user is required to save drafts' })
          .code(constants.HTTP_STATUS_UNAUTHORIZED)
      }

      let pvsId
      try {
        pvsId = await getLimsIdForCiId(getDynamoClient(), request.auth.credentials.subject)
      } catch (error) {
        console.error('Error retrieving CI-to-LIMS mapping:', error.message)
        return h.response({ error: 'Unable to retrieve LIMS ID mapping' })
          .code(constants.HTTP_STATUS_BAD_GATEWAY)
      }

      if (!pvsId) {
        return h.response({ error: 'No LIMS practice is associated with this account' })
          .code(constants.HTTP_STATUS_FORBIDDEN)
      }

      try {
        const draft = await createUpdateDraft(getDynamoClient(), {
          ...request.payload,
          ownerId
        })

        return h.response({
          draftId: draft.draftId,
          revision: draft.revision,
          lastSavedPage: draft.lastSavedPage,
          updatedAt: draft.updatedAt
        }).code(request.payload.draftId
          ? constants.HTTP_STATUS_OK
          : constants.HTTP_STATUS_CREATED)
      } catch (error) {
        if (error instanceof DraftValidationError) {
          return h.response({ error: error.message }).code(constants.HTTP_STATUS_BAD_REQUEST)
        }
        if (error instanceof DraftNotFoundError) {
          return h.response({ error: error.message }).code(constants.HTTP_STATUS_NOT_FOUND)
        }
        if (error instanceof DraftConflictError) {
          return h.response({ error: error.message }).code(constants.HTTP_STATUS_CONFLICT)
        }

        console.error('Error saving draft:', error.message)
        return h.response({ error: 'Unable to save draft' })
          .code(constants.HTTP_STATUS_BAD_GATEWAY)
      }
    }
  })
}

export default registerDraftRoutes
