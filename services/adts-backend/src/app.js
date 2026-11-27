import path from 'path'
import { fileURLToPath } from 'url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Joi from 'joi'
import { constants } from 'node:http2'
import { createDocumentClient } from './data/dynamo.js'
import { getAnimalDetails } from './data/animalDetails.js'
import { getCounties } from './data/counties.js'
import { getSpecies } from './data/species.js'
import { getDraft } from './data/drafts.js'
import { getSubmissions } from './data/submissions.js'
import { getLimsSubmissionReferences, getLimsSubmissions } from './data/limsSubmissions.js'
import { createClientsHandler } from './handlers/clients.js'
import { createPvsIdHandler } from './handlers/pvs-id.js'
import { registerAuthentication } from './auth.js'
import registerDraftRoutes from './routes/drafts.js'
import { getLimsIdForCiId } from './data/ciLimsMapping.js'

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
    options: { auth: false },
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
      options: { auth: false },
      handler: async () => ({ message: 'You have hit the backend page' })
    },
    {
      method: 'GET',
      path: '/health',
      options: { auth: false },
      handler: (_request, h) => h.response({ status: 'UP' })
    }
  ])
}

const registerConnectionHealthRoute = (server) => {
  server.route({
    method: 'GET',
    path: '/connection_health',
    options: {
      auth: false,
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

const createSubmissionsHandler = (getDynamoClient) => async (request, h) => {
  const status = request.query.status?.toLowerCase()
  const ownerId = request.auth.credentials.ownerId
  const shouldGetLims = status !== 'draft'
  const shouldGetLocalDrafts = !status || status === 'show_all' || status === 'draft'

  if (status === 'draft' && !ownerId) {
    return h.response({ error: 'Local draft owner is not configured' })
      .code(constants.HTTP_STATUS_SERVICE_UNAVAILABLE)
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
    const [limsResults, localDrafts] = await Promise.all([
      shouldGetLims ? getLimsSubmissions(pvsId, request.query) : Promise.resolve([]),
      shouldGetLocalDrafts && ownerId
        ? getSubmissions(getDynamoClient(), ownerId, request.query)
        : { results: [] }
    ])
    const results = [...localDrafts.results, ...limsResults]

    return h.response({ results, totalCount: results.length })
  } catch (error) {
    console.error('Error retrieving submissions:', error.message)
    return h.response({ error: 'Unable to retrieve submissions' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
  }
}

const createSubmissionReferencesHandler = (getDynamoClient) => async (request, h) => {
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
    return h.response(await getLimsSubmissionReferences(pvsId, request.query))
  } catch (error) {
    console.error('Error retrieving submission references:', error.message)
    return h.response({ error: 'Unable to retrieve submission references' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
  }
}

const createDraftHandler = (getDynamoClient) => async (request, h) => {
  const ownerId = request.auth.credentials.ownerId
  if (!ownerId) {
    return h.response({ error: 'Local draft owner is not configured' })
      .code(constants.HTTP_STATUS_SERVICE_UNAVAILABLE)
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
    const draft = await getDraft(getDynamoClient(), request.params.draftId, ownerId)
    if (!draft) {
      return h.response({ error: 'Draft not found' }).code(constants.HTTP_STATUS_NOT_FOUND)
    }

    return h.response(draft)
  } catch (error) {
    console.error('Error retrieving draft:', error.message)
    return h.response({ error: 'Unable to retrieve draft' })
      .code(constants.HTTP_STATUS_BAD_GATEWAY)
  }
}

const registerSubmissionsRoutes = (server, getDynamoClient) => {
  server.route([
    {
      method: 'GET',
      path: '/v1/products',
      handler: createProxyGet('v1/products')
    },
    {
      method: 'GET',
      path: '/GetClients',
      handler: createClientsHandler(getDynamoClient)
    },
    {
      method: 'GET',
      path: '/GetPvsId',
      handler: createPvsIdHandler(getDynamoClient)
    },
    {
      method: 'GET',
      path: '/submissions',
      handler: createSubmissionsHandler(getDynamoClient)
    },
    {
      method: 'GET',
      path: '/submission-references',
      options: {
        validate: {
          query: Joi.object({
            clientId: Joi.string().trim().min(1),
            clientName: Joi.string().trim().min(1),
            clientFarm: Joi.string().trim().min(1)
          }).or('clientId', 'clientName', 'clientFarm').unknown(false)
        }
      },
      handler: createSubmissionReferencesHandler(getDynamoClient)
    },
    {
      method: 'GET',
      path: '/drafts/{draftId}',
      handler: createDraftHandler(getDynamoClient)
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

const registerCountiesRoute = (server, getDynamoClient) => {
  server.route({
    method: 'GET',
    path: '/GetCounties',
    handler: async (_request, h) => {
      try {
        return h.response(await getCounties(getDynamoClient()))
      } catch (error) {
        console.error('Error retrieving counties:', error.message)
        return h.response({ error: 'Unable to retrieve counties' })
          .code(constants.HTTP_STATUS_BAD_GATEWAY)
      }
    }
  })
}

const registerAnimalDetailsRoute = (server, getDynamoClient) => {
  server.route({
    method: 'GET',
    path: '/GetAnimalDetails',
    options: {
      validate: {
        query: Joi.object({
          speciesId: Joi.string().trim().required()
        }).required()
      }
    },
    handler: async (request, h) => {
      try {
        const animalDetails = await getAnimalDetails(getDynamoClient(), request.query.speciesId)
        if (!animalDetails) {
          return h.response({ error: 'Species not found' }).code(constants.HTTP_STATUS_NOT_FOUND)
        }

        return h.response(animalDetails)
      } catch (error) {
        console.error('Error retrieving animal details:', error.message)
        return h.response({ error: 'Unable to retrieve animal details' })
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
  await registerAuthentication(server)
  registerStaticRoutes(server)
  registerConnectionHealthRoute(server)
  registerSubmissionsRoutes(server, getDynamoClient)
  registerDraftRoutes(server, getDynamoClient)
  registerSpeciesRoute(server, getDynamoClient)
  registerCountiesRoute(server, getDynamoClient)
  registerAnimalDetailsRoute(server, getDynamoClient)

  return server
}

export default createServer
