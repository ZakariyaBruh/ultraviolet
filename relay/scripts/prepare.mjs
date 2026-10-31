// Copies Scramjet 2, its controller and the libcurl transport out of node_modules into public/ before every build.
// Versions are pinned exactly in package.json: the controller refuses to start if its Scramjet is a different build.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
const nm = 'node_modules/@mercuryworkshop'
for (const d of ['scram', 'controller', 'libcurl', 'baremux']) rmSync(`public/${d}`, { recursive: true, force: true })
for (const d of ['scram', 'controller', 'libcurl']) mkdirSync(`public/${d}`, { recursive: true })
const put = (from, to) => cpSync(`${nm}/${from}`, `public/${to}`)
put('scramjet/dist/scramjet.js', 'scram/scramjet.js')
put('scramjet/dist/scramjet.wasm', 'scram/scramjet.wasm')
put('scramjet-utils/dist/scramjet-utils.js', 'scram/scramjet-utils.js')
for (const f of ['controller.api.js', 'controller.inject.js', 'controller.sw.js']) put(`scramjet-controller/dist/${f}`, `controller/${f}`)
// libcurl.js and its wasm are inside this one file, so nothing else has to be fetched or patched
put('libcurl-transport/dist/index.js', 'libcurl/index.js')
console.log('relay assets copied')
