import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const testDatabaseScript = resolve(repositoryRoot, 'local/dynamodb/test-db.sh')

export default async function globalSetup() {
  const seedData = process.env.SEED_DATA ?? 'true'
  if (seedData !== 'true' && seedData !== 'false') {
    throw new Error(`SEED_DATA must be true or false (received: ${seedData})`)
  }

  process.env.TEST_RUN_ID ??= `${Date.now()}-${randomUUID()}`
  process.env.SEED_DATA = seedData
  const env = { ...process.env, SEED_DATA: seedData, TEST_RUN_ID: process.env.TEST_RUN_ID }

  execFileSync('sh', [testDatabaseScript, 'up'], {
    cwd: repositoryRoot,
    env,
    stdio: 'inherit'
  })
  execFileSync('sh', [testDatabaseScript, 'reset'], {
    cwd: repositoryRoot,
    env,
    stdio: 'inherit'
  })
}
