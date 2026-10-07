import createServer from './app.js'

const server = await createServer({ port: process.env.PORT })
await server.start()
console.log(`ADTS Submissions Service listening on ${server.info.uri}`)
