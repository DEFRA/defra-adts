import createServer from './app.js'

const server = await createServer()
await server.start()
console.log(`ADTS UI listening on ${server.info.uri}`)
