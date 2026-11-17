import Joi from 'joi'
import { createServiceError } from '../errors.js'
import { forwardJsonRequest, sendResult } from './reference-data.js'

const routeParameters = Joi.object({ submissionId: Joi.string().trim().required() })
const routeQuery = Joi.object({ pvsId: Joi.string().trim().required() }).unknown(false)

export const registerReportRoutes = (server, limsClient) => {
  server.route([
    {
      method: 'GET',
      path: '/v1/submissions/{submissionId}/release-summary',
      options: { validate: { params: routeParameters, query: routeQuery } },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'submissions/getLatestReleasedResults',
          {
            pvsId: request.query.pvsId,
            submissionId: request.params.submissionId
          },
          'release summary retrieval'
        )
        return sendResult(h, result)
      }
    },
    {
      method: 'GET',
      path: '/v1/submissions/{submissionId}/report',
      options: { validate: { params: routeParameters, query: routeQuery } },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'submissions/getReleaseSummaryAndReport',
          {
            pvsId: request.query.pvsId,
            submissionId: request.params.submissionId
          },
          'report retrieval'
        )

        if (result.statusCode !== 200) {
          return sendResult(h, result)
        }

        const encodedPdf = result.body?.LastReportString
        if (typeof encodedPdf !== 'string' || encodedPdf.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedPdf)) {
          return sendResult(h, createServiceError({
            category: 'upstream_http_error',
            message: 'LIMS returned an invalid or unavailable report.',
            correlationId: request.info.id
          }))
        }

        return h.response(Buffer.from(encodedPdf, 'base64')).type('application/pdf').code(200)
      }
    }
  ])
}
