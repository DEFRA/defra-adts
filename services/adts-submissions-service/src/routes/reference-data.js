import Joi from 'joi'
import { constants } from 'node:http2'
import { createServiceError, normalizeLimsBusinessError, normalizeUpstreamStatus } from '../errors.js'

const mapTransportError = (error, correlationId) => {
  const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
  return createServiceError({
    category: timedOut ? 'upstream_timeout' : 'upstream_transport_error',
    message: timedOut ? 'The LIMS request timed out.' : 'The LIMS request could not be completed.',
    correlationId
  })
}

export const forwardJsonRequest = async (limsClient, request, path, query, operationLabel) => {
  let response
  try {
    response = await limsClient.request(path, { method: 'GET', query })
  } catch (error) {
    return mapTransportError(error, request.info.id)
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const businessError = normalizeLimsBusinessError(payload, request.info.id)
  if (businessError) {
    return businessError
  }

  if (!response.ok || payload === null) {
    return normalizeUpstreamStatus(
      response.status,
      request.info.id,
      `LIMS could not complete the ${operationLabel}.`
    )
  }

  return { statusCode: constants.HTTP_STATUS_OK, body: payload }
}

export const sendResult = (h, result) => h.response(result.body).code(result.statusCode)

export const registerReferenceDataRoutes = (server, limsClient) => {
  server.route([
    {
      method: 'GET',
      path: '/v1/products',
      options: {
        validate: {
          query: Joi.object({
            filter: Joi.string().trim().required(),
            species: Joi.string().trim()
          }).unknown(false)
        }
      },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'general/getProducts',
          { filter: request.query.filter, species: request.query.species },
          'product search'
        )
        return sendResult(h, result)
      }
    },
    {
      method: 'GET',
      path: '/v1/clients',
      options: {
        validate: {
          query: Joi.object({
            pvsId: Joi.string().trim().required(),
            filter: Joi.string().trim()
          }).unknown(false)
        }
      },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'general/getClients',
          { pvsId: request.query.pvsId, filter: request.query.filter },
          'client search'
        )
        return sendResult(h, result)
      }
    },
    {
      method: 'GET',
      path: '/v1/practices/{pvsId}',
      options: {
        validate: {
          params: Joi.object({ pvsId: Joi.string().trim().required() })
        }
      },
      handler: async (request, h) => {
        const result = await forwardJsonRequest(
          limsClient,
          request,
          'general/getPVS',
          { pvsId: request.params.pvsId },
          'practice lookup'
        )
        return sendResult(h, result)
      }
    }
  ])
}
