/**
 * The Code window runs everything in the person's own browser. A sealed frame (`sandbox="allow-scripts"`, an empty origin, so it cannot
 * read Friction's storage or page) holds a runner; each language runs in a Worker inside it, so a loop that never ends can be stopped.
 * Nothing is sent to a server of ours. Python (Pyodide) and SQL (sql.js) are fetched once from jsDelivr, the only address the frame's
 * policy lets code reach, and kept by the browser's cache. HTML runs in its own sealed frame with no network at all.
 */
export const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
export const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/'

const PY = String.raw`
let py = null, cur = 0
const out = (s, err) => postMessage({ t: 'out', s, err, id: cur })
onmessage = async (e) => {
  const { code, id } = e.data
  cur = id
  try {
    if (!py) {
      postMessage({ t: 'status', s: 'Loading Python, about 10 MB the first time', id })
      importScripts('${PYODIDE}pyodide.js')
      py = await loadPyodide({ indexURL: '${PYODIDE}' })
      py.setStdout({ batched: (s) => out(s + '\n') })
      py.setStderr({ batched: (s) => out(s + '\n', 1) })
    }
    postMessage({ t: 'status', s: 'Running', id })
    await py.loadPackagesFromImports(code)
    const r = await py.runPythonAsync(code)
    if (r !== undefined && r !== null) out(String(r) + '\n')
  } catch (err) { out(String((err && err.message) || err) + '\n', 1) }
  postMessage({ t: 'done', id })
}
`
const JS = String.raw`
const fmt = (v) => { if (typeof v === 'string') return v; try { return typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v) } catch (_) { return String(v) } }
onmessage = async (e) => {
  const { code, id } = e.data
  const say = (err) => (...a) => postMessage({ t: 'out', s: a.map(fmt).join(' ') + '\n', err, id })
  self.console = { log: say(), info: say(), debug: say(), warn: say(), error: say(1) }
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const r = await new AsyncFunction(code)()
    if (r !== undefined) say()(r)
  } catch (err) { say(1)(String((err && err.stack) || err).split('\n').slice(0, 4).join('\n')) }
  postMessage({ t: 'done', id })
}
`
const SQL = String.raw`
let db = null
const table = (r) => { const w = r.columns.map((c, i) => Math.max(c.length, ...r.values.map((v) => String(v[i] === null ? 'NULL' : v[i]).length))); const row = (a) => a.map((x, i) => String(x === null ? 'NULL' : x).padEnd(w[i])).join('  '); return [row(r.columns), w.map((n) => '-'.repeat(n)).join('  '), ...r.values.map(row)].join('\n') + '\n' }
onmessage = async (e) => {
  const { code, id } = e.data
  try {
    if (!db) {
      postMessage({ t: 'status', s: 'Loading SQL', id })
      importScripts('${SQLJS}sql-wasm.js')
      const SQL = await initSqlJs({ locateFile: (f) => '${SQLJS}' + f })
      db = new SQL.Database()
    }
    postMessage({ t: 'status', s: 'Running', id })
    const res = db.exec(code)
    postMessage({ t: 'out', s: res.length ? res.map(table).join('\n') : 'Done. ' + db.getRowsModified() + ' rows changed.\n', id })
  } catch (err) { postMessage({ t: 'out', s: String((err && err.message) || err) + '\n', err: 1, id }) }
  postMessage({ t: 'done', id })
}
`

/** the runner page: it only passes messages between the window and the workers */
export const RUNNER = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net blob:; worker-src blob:; connect-src https://cdn.jsdelivr.net; style-src 'unsafe-inline'"><script>
const SRC = ${JSON.stringify({ py: PY, js: JS, sql: SQL })}
const W = {}
let cur = 0
const post = (m) => parent.postMessage(m, '*')
const mk = (s) => new Worker(URL.createObjectURL(new Blob([s], { type: 'text/javascript' })))
function worker(lang) {
  if (lang === 'js' && W.js) { W.js.terminate(); delete W.js }
  if (W[lang]) return W[lang]
  const w = mk(SRC[lang])
  w.onmessage = (e) => post(e.data)
  w.onerror = (e) => { post({ t: 'out', s: String(e.message || 'The code could not start') + '\\n', err: 1, id: cur }); post({ t: 'done', id: cur }) }
  return (W[lang] = w)
}
onmessage = (e) => {
  if (e.source !== parent) return
  const d = e.data
  if (d.t === 'run') { cur = d.id; try { worker(d.lang).postMessage(d) } catch (x) { post({ t: 'out', s: 'This browser would not start a worker here.\\n', err: 1, id: d.id }); post({ t: 'done', id: d.id }) } }
  if (d.t === 'stop') for (const k in W) { W[k].terminate(); delete W[k] }
}
post({ t: 'ready' })
</script>`

/** a page the HTML tab shows: no network at all, only its own scripts and styles */
export const htmlDoc = (body: string) => `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:">${body}`

export type Lang = 'python' | 'javascript' | 'html' | 'sql'
export const LANGS: { id: Lang; label: string; run: 'py' | 'js' | 'sql' | null }[] = [
  { id: 'python', label: 'Python', run: 'py' },
  { id: 'javascript', label: 'JavaScript', run: 'js' },
  { id: 'html', label: 'HTML', run: null },
  { id: 'sql', label: 'SQL', run: 'sql' },
]
export const STARTERS: Record<Lang, string> = {
  python: '# Python runs in this browser. Try numpy, pandas or math.\nfor n in range(1, 6):\n    print(n, n * n)\n',
  javascript: '// JavaScript runs in this browser. console.log shows below.\nconst squares = [1, 2, 3, 4, 5].map((n) => n * n)\nconsole.log(squares)\n',
  html: '<h1>Hello</h1>\n<p id="p">Edit me, then press Run.</p>\n<style>h1 { color: #c0392b }</style>\n<script>document.getElementById("p").textContent += " It works."</script>\n',
  sql: 'create table pets (name text, age int);\ninsert into pets values ("Mo", 3), ("Bea", 7);\nselect name, age from pets order by age desc;\n',
}
