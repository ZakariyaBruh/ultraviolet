// Copies Scramjet, bare-mux and the libcurl transport out of node_modules into public/ before every build.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
const nm = 'node_modules/@mercuryworkshop'
for (const d of ['scram', 'libcurl', 'baremux']) { rmSync(`public/${d}`, { recursive: true, force: true }); mkdirSync(`public/${d}`, { recursive: true }) }
cpSync(`${nm}/scramjet/dist`, 'public/scram', { recursive: true, filter: (s) => !s.includes('types') && !s.endsWith('.map') })
cpSync(`${nm}/libcurl-transport/dist`, 'public/libcurl', { recursive: true, filter: (s) => !s.endsWith('.map') })
cpSync(`${nm}/bare-mux/dist`, 'public/baremux', { recursive: true, filter: (s) => !s.endsWith('.map') && !s.endsWith('.d.ts') })
// libcurl-transport 1.5.2 builds its HTTP session before libcurl's wasm has finished loading ("wasm not loaded yet"), and the newer
// versions that wait for it pass headers in a shape bare-mux 2.1.9 does not send. So the wait is added here, ahead of the session.
const f = 'public/libcurl/index.mjs'
const src = readFileSync(f, 'utf8')
const want = '    libcurl.set_websocket(this.wisp);\n    this.session = new libcurl.HTTPSession({'
if (!src.includes(want)) throw new Error('libcurl-transport changed: the wasm wait needs re-doing')
writeFileSync(f, src.replace(want, '    if (!libcurl.ready) await new Promise((resolve) => { libcurl.onload = () => resolve(null) })\n' + want))
console.log('relay assets copied')
