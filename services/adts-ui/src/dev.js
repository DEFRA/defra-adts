import { execFileSync } from 'child_process'

execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
await import('./index.js')
