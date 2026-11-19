import Joi from 'joi'
import { forwardJsonRequest, sendResult } from './reference-data.js'

export const registerResultsRoutes = (server, limsClient) => {
  server.route({
    method: 'GET',
    path: '/v1/submissions/{submissionId}/results/latest',
    options: {
      validate: {
        params: Joi.object({ submissionId: Joi.string().trim().required() }),
        query: Joi.object({ pvsId: Joi.string().trim().required() }).unknown(false)
      }
    },
    handler: async (request, h) => {
      const result = await forwardJsonRequest(
        limsClient,
        request,
        'submissions/getLatestReleasedResults',
        {
          pvsId: request.query.pvsId,
          submissionId: request.params.submissionId
        },
        'latest results retrieval'
      )
      return sendResult(h, result)
    }
  })
}
