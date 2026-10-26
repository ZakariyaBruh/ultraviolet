// 1) the app itself, from the repo root, into dist/client  2) the Worker around it, packed into dist/whop-build.zip
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const vite = join(root, 'node_modules', '.bin', 'vite')
const run = (args, cwd) => execFileSync(vite, args, { cwd, stdio: 'inherit', env: process.env })

run(['build', '--outDir', 'whop/dist/client', '--emptyOutDir'], root)
run(['build'], here)
