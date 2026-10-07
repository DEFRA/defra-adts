import createServer from './app.js'

const server = await createServer({
  sessionSecret: process.env.SESSION_SECRET,
  port: process.env.PORT,
  limsAdapterUrl: process.env.LIMS_ADAPTER_URL
})
await server.start()
console.log(`ADTS UI listening on ${server.info.uri}`)
