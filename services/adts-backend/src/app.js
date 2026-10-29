import path from 'path'
import { fileURLToPath } from 'url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Joi from 'joi'
import { constants } from 'http2'
import { createDocumentClient } from './data/dynamo.js'
import { getSpecies } from './data/species.js'
import { getSubmissions } from './data/submissions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const createServer = async ({ docClient } = {}) => {
  let dynamoClient = docClient
  const server = Hapi.server({
    port: process.env.PORT
  })

  await server.register([Inert])
  server.route({
    method: 'GET',
    path: '/assets/js/{param*}',
    handler: {
      directory: {
        path: path.join(__dirname, 'public/js')
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/',
    handler: async (request, h) => {
      return { message: 'You have hit the backend page' }
    }
  })

  server.route({
    method: 'GET',
    path: '/health',
    handler: (_request, h) => {
      return h.response({ status: 'UP' })
    }
  })

  // E.g. localhost:9181/connection_health?protocol=http&host=<host DN>&port=9180
  server.route({
    method: 'GET',
    path: '/connection_health',
    options: {
      validate: {
        query: Joi.object({
          protocol: Joi.string()
            .trim()
            .required(),
          host: Joi.string()
            .trim()
            .required(),
          port: Joi.string()
            .trim()
            .required()
        }).required()
      }
    },
    handler: async (request, h) => {
      const { protocol, host, port } = request.query
      const pr = encodeURIComponent(protocol)
      const hs = encodeURIComponent(host)
      const pt = encodeURIComponent(port)
      const connectionUrl = `${pr}://${hs}:${pt}/health`

      try {
        const response = await fetch(connectionUrl)

        if (!response.ok) {
          throw new Error(`${host} responded with status: ${response.status}`)
        }

        const payload = await response.json()
        return h.response(payload)
      } catch (error) {
        console.error('Error contacting %s  server: %s', host, error.message)

        return h.response({ message: `Unable to reach ${host}  at this time.` })
      }
    }
  })

  const proxyGet = (path) => async (request, h) => {
    const queryParams = new URLSearchParams(request.query).toString()
    const url = `${process.env.SUBMISSIONS_SERVICE_URL}/${path}${queryParams ? `?${queryParams}` : ''}`

    try {
      const response = await fetch(url)
      const payload = await response.json()
      return h.response(payload).code(response.status)
    } catch (error) {
      console.error('Error contacting submissions service:', error.message)
      return h.response({ error: 'Unable to reach submissions service' })
        .code(constants.HTTP_STATUS_BAD_GATEWAY)
    }
  }

  server.route([
    {
      method: 'GET',
      path: '/GetClients',
      handler: proxyGet('GetClients')
    },
    {
      method: 'GET',
      path: '/GetCounties',
      handler: proxyGet('GetCounties')
    },
    {
      method: 'GET',
      path: '/submissions',
      handler: async (request, h) => {
        if (request.query.status?.toLowerCase() !== 'draft') {
          return proxyGet('submissions')(request, h)
        }

        try {
          dynamoClient ??= createDocumentClient()
          return h.response(await getSubmissions(dynamoClient, request.query))
        } catch (error) {
          console.error('Error retrieving submissions:', error.message)
          return h.response({ error: 'Unable to retrieve submissions' })
            .code(constants.HTTP_STATUS_BAD_GATEWAY)
        }
      }
    }
  ])

  server.route({
    method: 'GET',
    path: '/GetSpecies',
    handler: async (_request, h) => {
      try {
        dynamoClient ??= createDocumentClient()
        return h.response(await getSpecies(dynamoClient))
      } catch (error) {
        console.error('Error retrieving species:', error.message)
        return h.response({ error: 'Unable to retrieve species' })
          .code(constants.HTTP_STATUS_BAD_GATEWAY)
      }
    }
  })

  return server
}

export default createServer
