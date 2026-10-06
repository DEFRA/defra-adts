import createServer from './app.js'
import process from 'node:process'

try {
  process.loadEnvFile()
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error
  }
}
const server = await createServer()
await server.start()
console.log(`ADTS UI listening on ${server.info.uri}`)
