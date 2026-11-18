import Joi from 'joi'
import { constants } from 'node:http2'
import { createServiceError, normalizeLimsBusinessError, normalizeUpstreamStatus } from '../errors.js'

const sendError = (h, result) => h.response(result.body).code(result.statusCode)

const unknownOutcome = (request, operation) => createServiceError({
  category: 'outcome_unknown',
  message: `The LIMS ${operation} outcome is unknown. Reconcile the record with LIMS before retrying.`,
  correlationId: request.info.id
})

const readJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const confirmDraft = async (request, h, limsClient) => {
  let response
  try {
    response = await limsClient.request('submissions/confirmDraftSubmission', {
      method: 'POST',
      body: {
        draftSubmissionId: request.params.draftId,
        pvsId: request.payload.pvsId
      }
    })
  } catch {
    return sendError(h, unknownOutcome(request, 'confirmation'))
  }

  const payload = await readJson(response)
  const businessError = normalizeLimsBusinessError(payload, request.info.id)
  if (businessError) {
    return sendError(h, businessError)
  }

  if (!response.ok) {
    return sendError(h, normalizeUpstreamStatus(
      response.status,
      request.info.id,
      'LIMS could not confirm the draft.'
    ))
  }

  if (typeof payload?.submissionId !== 'string' || payload.submissionId.length === 0) {
    return sendError(h, unknownOutcome(request, 'confirmation'))
  }

  return h.response({ submissionId: payload.submissionId }).code(constants.HTTP_STATUS_OK)
}

const cancelSubmission = async (request, h, limsClient) => {
  const submissionDraftId = request.payload.draftId ?? request.payload.submissionId
  let response
  try {
    response = await limsClient.request('submissions/cancelSubmission', {
      method: 'POST',
      body: {
        pvsId: request.payload.pvsId,
        submissionDraftId,
        clinician: request.payload.clinician
      }
    })
  } catch {
    return sendError(h, unknownOutcome(request, 'cancellation'))
  }

  const payload = await readJson(response)
  const businessError = normalizeLimsBusinessError(payload, request.info.id)
  if (businessError) {
    return sendError(h, businessError)
  }

  if (!response.ok) {
    return sendError(h, normalizeUpstreamStatus(
      response.status,
      request.info.id,
      'LIMS could not process the cancellation request.'
    ))
  }

  if (typeof payload?.hasErrors !== 'boolean' || !Array.isArray(payload.errorMessages)) {
    return sendError(h, unknownOutcome(request, 'cancellation'))
  }

  return h.response({
    hasErrors: payload.hasErrors,
    errorMessages: payload.errorMessages
  }).code(constants.HTTP_STATUS_OK)
}

export const registerSubmissionActionRoutes = (server, limsClient) => {
  server.route([
    {
      method: 'POST',
      path: '/v1/drafts/{draftId}/confirmation',
      options: {
        validate: {
          params: Joi.object({ draftId: Joi.string().trim().required() }),
          payload: Joi.object({ pvsId: Joi.string().trim().required() }).unknown(false)
        }
      },
      handler: (request, h) => confirmDraft(request, h, limsClient)
    },
    {
      method: 'POST',
      path: '/v1/cancellation-requests',
      options: {
        validate: {
          payload: Joi.object({
            pvsId: Joi.string().trim().required(),
            draftId: Joi.string().trim().min(1),
            submissionId: Joi.string().trim().min(1),
            clinician: Joi.string().required()
          }).xor('draftId', 'submissionId').unknown(false)
        }
      },
      handler: (request, h) => cancelSubmission(request, h, limsClient)
    }
  ])
}
