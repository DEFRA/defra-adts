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

// Ensure the port is released on a crash or restart so nodemon can start the next process cleanly.
const shutdown = async (exitCode) => {
  await server.stop()
  process.exit(exitCode)
}

// @ts-ignore coverage ignore next
process.on('SIGTERM', () => shutdown(0).catch(console.error))
// @ts-ignore coverage ignore next
process.on('SIGINT', () => shutdown(0).catch(console.error))
// @ts-ignore coverage ignore next
process.on('uncaughtException', (error) => {
  console.error(error)
  shutdown(1).catch((shutdownError) => {
    console.error(shutdownError)
    process.exit(1)
  })
})
// @ts-ignore coverage ignore next
process.on('unhandledRejection', (error) => {
  console.error(error)
  shutdown(1).catch((shutdownError) => {
    console.error(shutdownError)
    process.exit(1)
  })
})

await server.start()

console.log(`ADTS UI listening on ${server.info.uri}`)
