import createServer from './app.js'

const server = await createServer({ port: process.env.PORT, limsBaseUrl: process.env.LIMS_BASE_URL})
await server.start()
console.log(`ADTS Submissions Service listening on ${server.info.uri}`)
