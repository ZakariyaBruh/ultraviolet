// Copies the Ultraviolet files out of node_modules into public/ before every build.
import { cpSync, mkdirSync } from 'node:fs'
const nm = 'node_modules'
mkdirSync('public/uv', { recursive: true })
for (const f of ['uv.bundle.js', 'uv.client.js', 'uv.handler.js', 'uv.sw.js']) cpSync(`${nm}/@titaniumnetwork-dev/ultraviolet/dist/${f}`, `public/uv/${f}`)
console.log('relay assets copied')
