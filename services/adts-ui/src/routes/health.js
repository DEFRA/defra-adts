import Joi from 'joi'

const health = (server) => {
  server.route([
    {
      method: 'GET',
      path: '/health',
      handler: (_request, h) => {
        return h.response({ status: 'UP' })
      }
    },
    {
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
          console.error('Error contacting %s server: %s', host, error.message)
          return h.response({ message: `Unable to reach ${host} at this time.` })
        }
      }
    }
  ])
}

export default health
