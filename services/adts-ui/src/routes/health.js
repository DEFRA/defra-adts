const health = (server) => {
  server.route({
    method: 'GET',
    path: '/health',
    handler: (_request, h) => {
      return h.response({ status: 'UP' })
    }
  })
}

export default health
