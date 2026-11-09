import createServer from './app.js'

// Entry point: builds the Hapi server and starts listening on the configured port.
const server = await createServer()
await server.start()
console.log(`ADTS UI listening on ${server.info.uri}`)
