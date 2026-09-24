import createServer from './app.js'

const server = await createServer()

// Ensure the port is released on a crash or restart so nodemon can start the next process cleanly.
const shutdown = async (exitCode) => {
  await server.stop()
  process.exit(exitCode)
}

process.on('SIGTERM', () => shutdown(0))
process.on('SIGINT', () => shutdown(0))
process.on('uncaughtException', (error) => {
  console.error(error)
  shutdown(1)
})
process.on('unhandledRejection', (error) => {
  console.error(error)
  shutdown(1)
})

await server.start()

console.log(`ADTS UI listening on ${server.info.uri}`)
