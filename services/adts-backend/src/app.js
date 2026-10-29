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

const createDynamoClientGetter = (docClient) => {
  let dynamoClient = docClient

  return () => {
    dynamoClient ??= createDocumentClient()
    return dynamoClient
  }
}

const createProxyGet = (routePath) => async (request, h) => {
  const queryParams = new URLSearchParams(request.query).toString()
  const baseUrl = `${process.env.SUBMISSIONS_SERVICE_URL}/${routePath}`
  const url = queryParams ? `${baseUrl}?${queryParams}` : baseUrl

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

const registerStaticRoutes = (server) => {
  server.route({
    method: 'GET',
    path: '/assets/js/{param*}',
    handler: {
      directory: {
        path: path.join(__dirname, 'public/js')
      }
    }
  })

  server.route([
    {
      method: 'GET',
      path: '/',
      handler: async () => ({ message: 'You have hit the backend page' })
    },
    {
      method: 'GET',
      path: '/health',
      handler: (_request, h) => h.response({ status: 'UP' })
    }
  ])
}

const registerConnectionHealthRoute = (server) => {
  server.route({
    method: 'GET',
    path: '/connection_health',
    options: {
      validate: {
        query: Joi.object({
          protocol: Joi.string().trim().required(),
          host: Joi.string().trim().required(),
          port: Joi.string().trim().required()
        }).required()
      }
    },
    handler: async (request, h) => {
      const { protocol, host, port } = request.query
      const connectionUrl = `${encodeURIComponent(protocol)}://${encodeURIComponent(host)}:${encodeURIComponent(port)}/health`

      try {
        const response = await fetch(connectionUrl)

        if (!response.ok) {
          throw new Error(`${host} responded with status: ${response.status}`)
        }

        return h.response(await response.json())
      } catch (error) {
        console.error('Error contacting %s  server: %s', host, error.message)
        return h.response({ message: `Unable to reach ${host}  at this time.` })
      }
    }
  })
}

const createSubmissionsHandler = (getDynamoClient) => {
  const proxySubmissions = createProxyGet('submissions')

  return async (request, h) => {
    if (request.query.status?.toLowerCase() !== 'draft') {
      return proxySubmissions(request, h)
    }

    try {
      return h.response(await getSubmissions(getDynamoClient(), request.query))
    } catch (error) {
      console.error('Error retrieving submissions:', error.message)
      return h.response({ error: 'Unable to retrieve submissions' })
        .code(constants.HTTP_STATUS_BAD_GATEWAY)
    }
  }
}

const registerSubmissionsRoutes = (server, getDynamoClient) => {
  server.route([
    {
      method: 'GET',
      path: '/GetClients',
      handler: createProxyGet('GetClients')
    },
    {
      method: 'GET',
      path: '/GetCounties',
      handler: createProxyGet('GetCounties')
    },
    {
      method: 'GET',
      path: '/submissions',
      handler: createSubmissionsHandler(getDynamoClient)
    }
  ])
}

const registerSpeciesRoute = (server, getDynamoClient) => {
  server.route({
    method: 'GET',
    path: '/GetSpecies',
    handler: async (_request, h) => {
      try {
        return h.response(await getSpecies(getDynamoClient()))
      } catch (error) {
        console.error('Error retrieving species:', error.message)
        return h.response({ error: 'Unable to retrieve species' })
          .code(constants.HTTP_STATUS_BAD_GATEWAY)
      }
    }
  })
}

const createServer = async ({ docClient } = {}) => {
  const server = Hapi.server({
    port: process.env.PORT
  })
  const getDynamoClient = createDynamoClientGetter(docClient)

  await server.register([Inert])
  registerStaticRoutes(server)
  registerConnectionHealthRoute(server)
  registerSubmissionsRoutes(server, getDynamoClient)
  registerSpeciesRoute(server, getDynamoClient)

  return server
}

export default createServer
