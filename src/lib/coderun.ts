import RT from './rt.json'

/**
 * The Code window runs everything in the person's own browser. A sealed frame (`sandbox="allow-scripts"`, an empty origin, so it cannot
 * read Friction's storage or page) holds a runner; each language runs in a Worker inside it, so a loop that never ends can be stopped.
 * Nothing is sent to a server of ours. The engines are fetched once and kept by the browser's cache: Python (Pyodide), SQL (sql.js),
 * Ruby (ruby.wasm), Lua (wasmoon) and PHP (php-wasm) from jsDelivr, and bash (just-bash), the C/C++ interpreter (JSCPP) and the
 * TypeScript stripper (sucrase) from this site's own /rt/ folder (`scripts/runtimes.mjs` builds them). The frame's policy lets code reach
 * those two places and nothing else. HTML runs in a frame of its own with no network at all.
 */
const CDN = 'https://cdn.jsdelivr.net'
export const PYODIDE = `${CDN}/pyodide/v0.26.4/full/`
const SQLJS = `${CDN}/npm/sql.js@1.10.3/dist/`
const RUBY_GLUE = `${CDN}/npm/@ruby/wasm-wasi@2.10.1/dist/browser/+esm`
const RUBY_WASM = `${CDN}/npm/@ruby/3.4-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm`
const LUA_GLUE = `${CDN}/npm/wasmoon@1.16.0/+esm`
const LUA_WASM = `${CDN}/npm/wasmoon@1.16.0/dist/glue.wasm`
const PHP_GLUE = `${CDN}/npm/php-wasm@0.2.0/PhpWeb.mjs`

/** shared by every worker: the run's id, its input as lines, and a way to say things */
const COMMON = String.raw`
let cur = 0, lines = []
const out = (s, k) => postMessage({ t: 'out', s: s, k: k || 0, id: cur }) // k: 0 output, 1 error, 2 a line of input, echoed as a terminal would
const status = (s) => postMessage({ t: 'status', s: s, id: cur })
const done = () => postMessage({ t: 'done', id: cur })
const begin = (d) => { cur = d.id; lines = String(d.input || '').split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop() }
const next = () => (lines.length ? lines.shift() : null)
const take = () => { const l = next(); if (l !== null) out(l + '\n', 2); return l }
const msg = (e) => String((e && e.message) || e)
`

const PY = String.raw`
let py = null
const tidy = (m) => { const a = m.split('\n'); const i = a.findIndex((l) => l.indexOf('File "<exec>"') >= 0); return (i > 0 ? ['Traceback (most recent call last):'].concat(a.slice(i)) : a).join('\n').trim() + '\n' }
const PLOTS = "import sys as _s\nif 'matplotlib.pyplot' in _s.modules:\n    import io as _io, base64 as _b\n    _p = _s.modules['matplotlib.pyplot']\n    for _n in _p.get_fignums():\n        _q = _io.BytesIO()\n        _p.figure(_n).savefig(_q, format='png', dpi=96, bbox_inches='tight')\n        _friction_img(_b.b64encode(_q.getvalue()).decode())\n    _p.close('all')\n"
onmessage = async (e) => {
  const d = e.data
  begin(d)
  try {
    if (!py) {
      status('Loading Python (about 6 MB the first time)')
      importScripts('__PYODIDE__pyodide.js')
      py = await loadPyodide({ indexURL: '__PYODIDE__' })
      const d1 = new TextDecoder(), d2 = new TextDecoder()
      py.setStdout({ write: (b) => { out(d1.decode(b, { stream: true })); return b.length }, isatty: true })
      py.setStderr({ write: (b) => { out(d2.decode(b, { stream: true }), 1); return b.length }, isatty: true })
      py.setStdin({ stdin: () => { const l = take(); return l === null ? undefined : l + '\n' } })
      py.globals.set('_friction_img', (b) => postMessage({ t: 'img', src: 'data:image/png;base64,' + b, id: cur }))
      py.runPython("import os, warnings\nos.environ['MPLBACKEND'] = 'Agg'\nwarnings.filterwarnings('ignore', message='.*non-interactive.*')\nwarnings.filterwarnings('ignore', message='.*non-GUI backend.*')\nwarnings.filterwarnings('ignore', message='.*font cache.*')")
    }
    await py.loadPackagesFromImports(d.code, { messageCallback: (m) => status(m), errorCallback: (m) => status(m) })
    status('Running')
    const r = await py.runPythonAsync(d.code)
    if (r !== undefined && r !== null) { out(String(r) + '\n'); if (r.destroy) r.destroy() }
    await py.runPythonAsync(PLOTS)
  } catch (err) { out(tidy(msg(err)), 1) }
  done()
}
`

const JS = String.raw`
const fmt = (v) => { if (typeof v === 'string') return v; try { return typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v) } catch (_) { return String(v) } }
onmessage = async (e) => {
  const d = e.data
  begin(d)
  const say = (err) => (...a) => out(a.map(fmt).join(' ') + '\n', err)
  self.console = { log: say(), info: say(), debug: say(), table: say(), warn: say(1), error: say(1) }
  self.prompt = (q) => { if (q !== undefined && q !== null) out(String(q)); return take() }
  self.readline = () => take()
  try {
    let code = d.code
    if (d.lang === 'ts') {
      if (!self.Sucrase) { status('Loading TypeScript'); importScripts(d.base + '/rt/__TS__') }
      code = self.Sucrase.transform(code, { transforms: ['typescript'] }).code
    }
    status('Running')
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const r = await new AsyncFunction(code)()
    if (r !== undefined) say()(r)
  } catch (err) {
    // the code runs as the body of a function, two lines below the top of what the engine sees
    const at = /<anonymous>:(\d+):\d+/.exec(String((err && err.stack) || ''))
    say(1)((err && err.name ? err.name + ': ' + err.message : String(err)) + (at && Number(at[1]) > 2 ? ' (line ' + (Number(at[1]) - 2) + ')' : ''))
  }
  done()
}
`

const SQL = String.raw`
let db = null
const table = (r) => { const w = r.columns.map((c, i) => Math.max(c.length, ...r.values.map((v) => String(v[i] === null ? 'NULL' : v[i]).length))); const row = (a) => a.map((x, i) => String(x === null ? 'NULL' : x).padEnd(w[i])).join('  '); return [row(r.columns), w.map((n) => '-'.repeat(n)).join('  ')].concat(r.values.map(row)).join('\n') + '\n' }
onmessage = async (e) => {
  const d = e.data
  begin(d)
  try {
    if (!db) {
      status('Loading SQLite')
      importScripts('__SQLJS__sql-wasm.js')
      const SQL = await initSqlJs({ locateFile: (f) => '__SQLJS__' + f })
      db = new SQL.Database()
    }
    status('Running')
    const res = db.exec(d.code)
    out(res.length ? res.map(table).join('\n') : 'Done. ' + db.getRowsModified() + ' rows changed.\n')
  } catch (err) { out(msg(err) + '\n', 1) }
  done()
}
`

const BASH = String.raw`
let sh = null
onmessage = async (e) => {
  const d = e.data
  begin(d)
  try {
    if (!sh) {
      status('Loading bash')
      importScripts(d.base + '/rt/__BASH__')
      sh = new JustBash.Bash({ cwd: '/home/you', env: { HOME: '/home/you', USER: 'you' }, files: { '/home/you/notes.txt': 'Files you make here last until you press Stop or close the window.\n' } })
    }
    status('Running')
    const r = await sh.exec(d.code, { stdin: d.input || '', rawScript: true })
    if (r.stdout) out(r.stdout)
    if (r.stderr) out(r.stderr, 1)
    if (r.exitCode) out('(exit code ' + r.exitCode + ')\n', 1)
  } catch (err) { out(msg(err) + '\n', 1) }
  done()
}
`

const CPP = String.raw`
// JSCPP's preprocessor loses spaces inside a string passed to a function ("a, b" printed "a,b"); spelled as escapes they survive
const keep = (src) => src.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m[0] === '"' ? m.replace(/ /g, '\\x20') : m))
onmessage = (e) => {
  const d = e.data
  begin(d)
  try {
    if (!self.JSCPP) { status('Loading C/C++'); importScripts(d.base + '/rt/__CPP__') }
    const J = self.JSCPP.run ? self.JSCPP : self.JSCPP.default
    status('Running')
    const code = J.run(keep(d.code), d.input || '', { stdio: { write: (s) => out(String(s)) } })
    if (code) out('\n(exit code ' + code + ')\n', 1)
  } catch (err) { out(msg(err).replace(/^Error: /, '') + '\n', 1) }
  done()
}
`

const RUBY = String.raw`
let vm = null
const lit = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
// ruby.wasm hands over each write as it is, newlines included
console.log = (...a) => out(a.join(' '))
console.warn = (...a) => out(a.join(' '), 1)
console.error = console.warn
onmessage = async (e) => {
  const d = e.data
  begin(d)
  try {
    if (!vm) {
      status('Loading Ruby (about 8 MB the first time)')
      const { DefaultRubyVM } = await import('__RUBY_GLUE__')
      const mod = await WebAssembly.compileStreaming(fetch('__RUBY_WASM__'))
      vm = (await DefaultRubyVM(mod)).vm
    }
    status('Running')
    vm.eval('require "stringio"; $stdin = StringIO.new(' + lit(d.input || '') + ')')
    try { vm.eval(d.code) } finally { vm.eval('$stdout.flush; $stderr.flush') }
  } catch (err) { out(msg(err) + '\n', 1) }
  done()
}
`

const LUA = String.raw`
let F = null
const PRELUDE = 'print = function(...) local t = {} for i = 1, select("#", ...) do t[i] = tostring((select(i, ...))) end __w(table.concat(t, "\\t") .. "\\n") end\n' +
  'io.write = function(...) for i = 1, select("#", ...) do __w(tostring((select(i, ...)))) end end\n' +
  'io.read = function() return __r() end'
onmessage = async (e) => {
  const d = e.data
  begin(d)
  let lua = null
  try {
    if (!F) { status('Loading Lua'); const { LuaFactory } = await import('__LUA_GLUE__'); F = new LuaFactory('__LUA_WASM__') }
    lua = await F.createEngine()
    lua.global.set('__w', (s) => out(String(s)))
    lua.global.set('__r', () => take())
    await lua.doString(PRELUDE)
    status('Running')
    await lua.doString(d.code)
  } catch (err) { out(msg(err) + '\n', 1) }
  finally { try { lua && lua.global.close() } catch (_) {} }
  done()
}
`

const PHP = String.raw`
let php = null
// PHP's web build expects a page: a worker gets a stand-in
self.window = self
self.document = { getElementById: () => null, querySelector: () => null, addEventListener() {}, removeEventListener() {}, body: null, documentElement: { style: {} }, visibilityState: 'visible', hidden: false }
try { Object.defineProperty(self.navigator, 'locks', { value: undefined }) } catch (_) {} // an empty origin may not use Web Locks
onmessage = async (e) => {
  const d = e.data
  begin(d)
  try {
    if (!php) {
      status('Loading PHP (about 3 MB the first time)')
      const { PhpWeb } = await import('__PHP_GLUE__')
      php = new PhpWeb({ version: '8.4' })
      php.addEventListener('output', (ev) => out([].concat(ev.detail).join('')))
      php.addEventListener('error', (ev) => out([].concat(ev.detail).join(''), 1))
      await php.binary
    }
    status('Running')
    // STDIN is a CLI constant this build lacks; it is defined on the first line so error line numbers stay right
    php.buffers.stdin.length = 0
    php.inputString(d.input || '')
    const pre = "if (!defined('STDIN')) define('STDIN', fopen('php://stdin', 'r')); "
    await php.run(/^\s*<\?php/.test(d.code) ? d.code.replace(/<\?php\s/, (m) => m + pre) : '<?php ' + pre + '?>' + d.code)
  } catch (err) { out(msg(err) + '\n', 1) }
  done()
}
`

const fill = (s: string) => (COMMON + s)
  .replaceAll('__PYODIDE__', PYODIDE).replaceAll('__SQLJS__', SQLJS)
  .replaceAll('__RUBY_GLUE__', RUBY_GLUE).replaceAll('__RUBY_WASM__', RUBY_WASM).replaceAll('__LUA_GLUE__', LUA_GLUE).replaceAll('__LUA_WASM__', LUA_WASM)
  .replaceAll('__PHP_GLUE__', PHP_GLUE).replaceAll('__BASH__', RT.bash).replaceAll('__CPP__', RT.cpp).replaceAll('__TS__', RT.ts)

/** each runner and whether it keeps its state (variables, tables, files) between runs until Stop */
export type Engine = 'py' | 'js' | 'sql' | 'bash' | 'cpp' | 'ruby' | 'lua' | 'php'
const SOURCES: Record<Engine, string> = { py: fill(PY), js: fill(JS), sql: fill(SQL), bash: fill(BASH), cpp: fill(CPP), ruby: fill(RUBY), lua: fill(LUA), php: fill(PHP) }
const FRESH: Engine[] = ['js'] // a fresh worker for every run

/** the runner page: it only passes messages between the window and the workers. `origin` is this site, for its own /rt/ engines. */
export function runnerDoc(origin: string): string {
  const csp = `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' ${CDN} ${origin} blob:; worker-src blob:; connect-src ${CDN}; style-src 'unsafe-inline'`
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script>
const SRC = ${JSON.stringify(SOURCES)}
const FRESH = ${JSON.stringify(FRESH)}
const W = {}
let cur = 0
const post = (m) => parent.postMessage(m, '*')
const mk = (s) => new Worker(URL.createObjectURL(new Blob([s], { type: 'text/javascript' })))
function worker(e) {
  if (FRESH.includes(e) && W[e]) { W[e].terminate(); delete W[e] }
  if (W[e]) return W[e]
  const w = mk(SRC[e])
  w.onmessage = (m) => post(m.data)
  w.onerror = (m) => { m.preventDefault && m.preventDefault(); post({ t: 'out', s: String(m.message || 'The code could not start') + '\\n', k: 1, id: cur }); post({ t: 'done', id: cur }) }
  return (W[e] = w)
}
onmessage = (m) => {
  if (m.source !== parent) return
  const d = m.data
  if (d.t === 'run') { cur = d.id; try { worker(d.engine).postMessage(Object.assign({}, d, { base: ${JSON.stringify(origin)} })) } catch (x) { post({ t: 'out', s: 'This browser would not start a worker here.\\n', k: 1, id: d.id }); post({ t: 'done', id: d.id }) } }
  if (d.t === 'stop') for (const k in W) { W[k].terminate(); delete W[k] }
}
post({ t: 'ready' })
</script>`
}

/** a page the HTML tab shows: no network at all, only its own scripts and styles */
export const htmlDoc = (body: string) => `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:">${body}`
