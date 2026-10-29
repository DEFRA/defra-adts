import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const testDatabaseScript = resolve(repositoryRoot, 'local/dynamodb/test-db.sh')

export default async function globalSetup() {
  execFileSync('sh', [testDatabaseScript, 'up'], {
    cwd: repositoryRoot,
    env: { ...process.env, SEED_DATA: 'true' },
    stdio: 'inherit'
  })
  execFileSync('sh', [testDatabaseScript, 'reset'], {
    cwd: repositoryRoot,
    env: { ...process.env, SEED_DATA: 'true' },
    stdio: 'inherit'
  })
}
