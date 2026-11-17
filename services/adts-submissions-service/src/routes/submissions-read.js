import Joi from 'joi'
import { forwardJsonRequest, sendResult } from './reference-data.js'

const filterQuery = Joi.object({
  pvsId: Joi.string().trim().required(),
  filter: Joi.string().trim()
}).unknown(false)

const searchQuery = Joi.object({
  pvsId: Joi.string().trim().required(),
  filter: Joi.string().trim(),
  clientId: Joi.string().trim(),
  status: Joi.string().trim(),
  clinician: Joi.string().trim(),
  submittedDateBegin: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  submittedDateEnd: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
}).unknown(false)

const dateQuery = Joi.object({
  pvsId: Joi.string().trim().required()
}).unknown(false)

export const registerSubmissionReadRoutes = (server, limsClient) => {
  server.route([
    {
      method: 'GET',
      path: '/v1/submission-identifiers',
      options: { validate: { query: filterQuery } },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'submissions/getSubmissionIdList',
          { pvsid: request.query.pvsId, filter: request.query.filter },
          'submission identifier search'
        )
        return sendResult(h, result)
      }
    },
    {
      method: 'GET',
      path: '/v1/submissions',
      options: { validate: { query: searchQuery } },
      handler: async (request, h) => {
        const { pvsId, ...filters } = request.query
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'submissions/getSubmissions',
          { pvsid: pvsId, ...filters },
          'submission search'
        )
        return sendResult(h, result)
      }
    },
    {
      method: 'GET',
      path: '/v1/drafts/{draftId}',
      options: {
        validate: {
          params: Joi.object({ draftId: Joi.string().trim().required() }),
          query: dateQuery
        }
      },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'submissions/getSubmission',
          { submissionId: request.params.draftId, pvsId: request.query.pvsId },
          'draft retrieval'
        )
        return sendResult(h, result)
      }
    },
    {
      method: 'GET',
      path: '/v1/submissions/{submissionId}',
      options: {
        validate: {
          params: Joi.object({ submissionId: Joi.string().trim().required() }),
          query: Joi.object({
            pvsId: Joi.string().trim().required(),
            isDraft: Joi.boolean().default(false)
          }).unknown(false)
        }
      },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'submissions/viewSubmission',
          {
            submissionId: request.params.submissionId,
            pvsId: request.query.pvsId,
            isDraft: request.query.isDraft
          },
          'submission retrieval'
        )
        return sendResult(h, result)
      }
    },
    {
      method: 'GET',
      path: '/v1/drafts/{draftId}/delivery-addresses',
      options: {
        validate: {
          params: Joi.object({ draftId: Joi.string().trim().required() }),
          query: dateQuery
        }
      },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'submissions/getDeliveryAddresses',
          {
            pvsId: request.query.pvsId,
            draftSubmissionId: request.params.draftId
          },
          'draft address retrieval'
        )
        return sendResult(h, result)
      }
    }
  ])
}
