// Builds the two code runtimes that no public CDN can serve as one browser file, into public/rt/ (part of `prebuild`):
// just-bash (a bash with an in-memory file system, written in TypeScript) and JSCPP (a small C++ interpreter).
// They run in the Code window's sealed frame like the others; the frame's policy allows this site's own /rt/ files.
import { build } from 'esbuild'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'rt')
mkdirSync(out, { recursive: true })
const ver = (p) => JSON.parse(readFileSync(path.join(root, 'node_modules', p, 'package.json'), 'utf8')).version

export const RUNTIMES = {
  bash: `bash-${ver('just-bash')}.b.js`, // .b: the bundle also exports defineCommand (for the draw command); a new name because /rt/ is cached for a year
  cpp: `jscpp-${ver('JSCPP')}.js`,
  ts: `sucrase-${ver('sucrase')}.js`,
  v86: `v86-${ver('v86').split('+')[0]}.wasm`,
}

async function one(file, contents, globalName, extra = {}) {
  const dest = path.join(out, file)
  if (existsSync(dest)) return
  await build({
    stdin: { contents, resolveDir: root, loader: 'js' },
    bundle: true, format: 'iife', globalName, platform: 'browser', target: 'es2020', minify: true, legalComments: 'none',
    outfile: dest, logLevel: 'warning', define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' }, ...extra,
  })
  console.log('runtime built:', file)
}

await one(RUNTIMES.bash, "export { Bash, defineCommand } from 'just-bash/browser'", 'JustBash', { alias: { 'node:zlib': path.join(root, 'scripts/shims/zlib.mjs') } })
await one(RUNTIMES.cpp, "module.exports = require('JSCPP')", 'JSCPP', { alias: { util: path.join(root, 'scripts/shims/util.mjs'), stream: path.join(root, 'scripts/shims/stream.mjs') } })
await one(RUNTIMES.ts, "export { transform } from 'sucrase'", 'Sucrase')
// the DOS window's PC emulator: its script is bundled by Vite, its wasm is served from here
if (!existsSync(path.join(out, RUNTIMES.v86))) { writeFileSync(path.join(out, RUNTIMES.v86), readFileSync(path.join(root, 'node_modules/v86/build/v86.wasm'))); console.log('runtime copied:', RUNTIMES.v86) }
// the file names the Code window asks for (they change with the versions above)
writeFileSync(path.join(root, 'src', 'lib', 'rt.json'), JSON.stringify(RUNTIMES, null, 1) + '\n')
