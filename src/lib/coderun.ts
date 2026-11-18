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

/**
 * Shared by every worker: the run's id, its input as lines, a way to say things, and a picture to draw on. Each run gets a fresh
 * 480 x 320 OffscreenCanvas as the global \`canvas\`; once something has asked it for a context, a copy goes to the window every
 * 150 ms while the program runs and once at the end, so an animation shows and a finished drawing stays.
 */
const COMMON = String.raw`
let cur = 0, lines = [], drew = false, tick = 0
self.canvas = null
const out = (s, k) => postMessage({ t: 'out', s: s, k: k || 0, id: cur }) // k: 0 output, 1 error, 2 a line of input, echoed as a terminal would
const status = (s) => postMessage({ t: 'status', s: s, id: cur })
const surface = (w, h) => {
  if (typeof OffscreenCanvas === 'undefined') return null
  const c = new OffscreenCanvas(w || 480, h || 320)
  const get = c.getContext.bind(c)
  c.getContext = function (t, o) { drew = true; return get(t, o) }
  drew = false
  self.canvas = c
  return c
}
const show = async () => {
  const c = self.canvas
  if (!drew || !c || !c.width || !c.height) return
  try { const b = await createImageBitmap(c); postMessage({ t: 'frame', bmp: b, w: c.width, h: c.height, id: cur }, [b]) } catch (_) {}
}
const done = () => { clearInterval(tick); const id = cur; show().then(() => postMessage({ t: 'done', id: id })) }
const begin = (d) => {
  cur = d.id; lines = String(d.input || '').split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop()
  surface(); clearInterval(tick); tick = setInterval(show, 150)
}
const next = () => (lines.length ? lines.shift() : null)
const take = () => { const l = next(); if (l !== null) out(l + '\n', 2); return l }
const msg = (e) => String((e && e.message) || e)
// a small drawing language for the runners that cannot hold the canvas themselves (Lua, Bash, C): a pen, a fill and a few shapes
const pen = { stroke: 'black', fill: 'black', width: 2, font: 14 }
const ctx2 = () => { const c = self.canvas; if (!c) throw new Error('This browser cannot draw in a worker'); const g = c.getContext('2d'); if (!g.__init) { g.fillStyle = 'white'; g.fillRect(0, 0, c.width, c.height); g.lineCap = 'round'; g.lineJoin = 'round'; g.__init = 1 } return g }
const n = (v) => Number(v) || 0
const draw = (op, a) => {
  const g = ctx2()
  g.strokeStyle = pen.stroke; g.fillStyle = pen.fill; g.lineWidth = pen.width
  switch (String(op).toLowerCase()) {
    case 'size': { const c = self.canvas; c.width = Math.max(16, Math.min(1600, n(a[0]))); c.height = Math.max(16, Math.min(1200, n(a[1]))); g.__init = 0; ctx2(); return }
    case 'clear': { const c = self.canvas; g.fillStyle = a[0] || 'white'; g.fillRect(0, 0, c.width, c.height); return }
    case 'color': case 'colour': case 'stroke': pen.stroke = String(a[0] || 'black'); if (op === 'color' || op === 'colour') pen.fill = pen.stroke; return
    case 'fill': pen.fill = String(a[0] || 'black'); return
    case 'width': pen.width = Math.max(0.5, n(a[0])); return
    case 'font': pen.font = Math.max(6, n(a[0])); return
    case 'pixel': g.fillStyle = pen.stroke; g.fillRect(n(a[0]), n(a[1]), 1, 1); return
    case 'line': g.beginPath(); g.moveTo(n(a[0]), n(a[1])); g.lineTo(n(a[2]), n(a[3])); g.stroke(); return
    case 'rect': g.strokeRect(n(a[0]), n(a[1]), n(a[2]), n(a[3])); return
    case 'fillrect': case 'box': g.fillRect(n(a[0]), n(a[1]), n(a[2]), n(a[3])); return
    case 'circle': g.beginPath(); g.arc(n(a[0]), n(a[1]), Math.abs(n(a[2])), 0, Math.PI * 2); g.stroke(); return
    case 'fillcircle': case 'disc': g.beginPath(); g.arc(n(a[0]), n(a[1]), Math.abs(n(a[2])), 0, Math.PI * 2); g.fill(); return
    case 'ellipse': g.beginPath(); g.ellipse(n(a[0]), n(a[1]), Math.abs(n(a[2])), Math.abs(n(a[3])), 0, 0, Math.PI * 2); g.stroke(); return
    case 'text': g.fillStyle = pen.stroke; g.font = pen.font + 'px sans-serif'; g.fillText(a.slice(2).join(' '), n(a[0]), n(a[1])); return
    default: throw new Error('draw: no such shape: ' + op + ' (size, clear, color, fill, width, font, pixel, line, rect, fillrect, circle, fillcircle, ellipse, text)')
  }
}
`

const PY = String.raw`
let py = null
const TURTLE = "\"\"\"Turtle graphics on Friction's canvas: the usual commands, drawn at once (there is no animation of the turtle itself).\"\"\"\nimport math, js\n_ctx = None\ndef _cv(): return js.canvas\ndef _c():\n    global _ctx\n    if _ctx is None:\n        _ctx = _cv().getContext(\"2d\")\n        _ctx.fillStyle = \"white\"; _ctx.fillRect(0, 0, _cv().width, _cv().height)\n        _ctx.lineCap = \"round\"; _ctx.lineJoin = \"round\"\n    return _ctx\ndef _colour(*c):\n    if len(c) == 1 and isinstance(c[0], str): return c[0]\n    if len(c) == 1: c = tuple(c[0])\n    r, g, b = c[:3]\n    if all(isinstance(v, float) and v <= 1 for v in (r, g, b)): r, g, b = r * 255, g * 255, b * 255\n    return \"rgb(%d,%d,%d)\" % (r, g, b)\nclass Turtle:\n    def __init__(self):\n        self.x = 0.0; self.y = 0.0; self.h = 0.0; self.down = True; self.col = \"black\"; self.fil = \"black\"; self.w = 2; self.poly = None\n        _c()\n    def _sx(self, x): return _cv().width / 2 + x\n    def _sy(self, y): return _cv().height / 2 - y\n    def _move(self, nx, ny):\n        if self.down:\n            c = _c(); c.strokeStyle = self.col; c.lineWidth = self.w\n            c.beginPath(); c.moveTo(self._sx(self.x), self._sy(self.y)); c.lineTo(self._sx(nx), self._sy(ny)); c.stroke()\n        if self.poly is not None: self.poly.append((nx, ny))\n        self.x, self.y = nx, ny\n    def forward(self, d): self._move(self.x + d * math.cos(math.radians(self.h)), self.y + d * math.sin(math.radians(self.h)))\n    fd = forward\n    def backward(self, d): self.forward(-d)\n    bk = back = backward\n    def left(self, a): self.h = (self.h + a) % 360\n    lt = left\n    def right(self, a): self.h = (self.h - a) % 360\n    rt = right\n    def setheading(self, a): self.h = a % 360\n    seth = setheading\n    def heading(self): return self.h\n    def goto(self, x, y=None):\n        if y is None: x, y = x\n        self._move(x, y)\n    setpos = setposition = goto\n    def setx(self, x): self._move(x, self.y)\n    def sety(self, y): self._move(self.x, y)\n    def home(self): self._move(0, 0); self.h = 0\n    def position(self): return (self.x, self.y)\n    pos = position\n    def xcor(self): return self.x\n    def ycor(self): return self.y\n    def distance(self, x, y=None):\n        if y is None: x, y = x\n        return math.hypot(x - self.x, y - self.y)\n    def towards(self, x, y=None):\n        if y is None: x, y = x\n        return math.degrees(math.atan2(y - self.y, x - self.x)) % 360\n    def penup(self): self.down = False\n    pu = up = penup\n    def pendown(self): self.down = True\n    pd = down = pendown\n    def isdown(self): return self.down\n    def pensize(self, w=None):\n        if w is None: return self.w\n        self.w = w\n    width = pensize\n    def pencolor(self, *c):\n        if c: self.col = _colour(*c)\n        return self.col\n    def fillcolor(self, *c):\n        if c: self.fil = _colour(*c)\n        return self.fil\n    def color(self, *c):\n        if len(c) == 2 and not all(isinstance(v, (int, float)) for v in c): self.col = _colour(c[0]); self.fil = _colour(c[1])\n        elif c: self.col = self.fil = _colour(*c)\n        return (self.col, self.fil)\n    def begin_fill(self): self.poly = [(self.x, self.y)]\n    def end_fill(self):\n        if self.poly and len(self.poly) > 2:\n            c = _c(); c.fillStyle = self.fil; c.beginPath(); c.moveTo(self._sx(self.poly[0][0]), self._sy(self.poly[0][1]))\n            for px, py in self.poly[1:]: c.lineTo(self._sx(px), self._sy(py))\n            c.closePath(); c.fill()\n            if self.down:\n                c.strokeStyle = self.col; c.lineWidth = self.w; c.stroke()\n        self.poly = None\n    def circle(self, radius, extent=360, steps=None):\n        n = steps or max(8, int(abs(extent) / 5))\n        turn = extent / n\n        side = 2 * abs(radius) * math.sin(math.radians(abs(turn) / 2))\n        sgn = 1 if radius >= 0 else -1\n        for _ in range(n):\n            self.left(sgn * turn / 2); self.forward(side); self.left(sgn * turn / 2)\n    def dot(self, size=None, *c):\n        cc = _c(); cc.fillStyle = _colour(*c) if c else self.col\n        cc.beginPath(); cc.arc(self._sx(self.x), self._sy(self.y), (size or max(self.w + 4, self.w * 2)) / 2, 0, 2 * math.pi); cc.fill()\n    def stamp(self): self.dot()\n    def write(self, text, move=False, align=\"left\", font=(\"sans-serif\", 14, \"normal\")):\n        cc = _c(); cc.fillStyle = self.col\n        style = font[2] if len(font) > 2 and font[2] != \"normal\" else \"\"\n        cc.font = (\"%s %dpx %s\" % (style, font[1], font[0])).strip(); cc.textAlign = align\n        cc.fillText(str(text), self._sx(self.x), self._sy(self.y))\n    def speed(self, *a): pass\n    def hideturtle(self): pass\n    ht = hideturtle\n    def showturtle(self): pass\n    st = showturtle\n    def shape(self, *a): pass\n    def clear(self): Screen().bgcolor(\"white\")\n    def reset(self): self.clear(); self.__init__()\nPen = RawTurtle = Turtle\nclass _Screen:\n    def bgcolor(self, *c):\n        cc = _c(); cc.fillStyle = _colour(*c); cc.fillRect(0, 0, _cv().width, _cv().height)\n    def setup(self, width=480, height=320, *a, **k):\n        global _ctx\n        _cv().width = int(width); _cv().height = int(height); _ctx = None; _c()\n    def screensize(self, *a): return (_cv().width, _cv().height)\n    def window_width(self): return _cv().width\n    def window_height(self): return _cv().height\n    def title(self, *a): pass\n    def tracer(self, *a, **k): pass\n    def update(self): pass\n    def colormode(self, *a): pass\n    def mainloop(self): pass\n    done = exitonclick = bye = mainloop\n_screen = _Screen()\ndef Screen(): return _screen\n_default = None\ndef getturtle():\n    global _default\n    if _default is None: _default = Turtle()\n    return _default\ngetpen = getturtle\ndef _bind(name): return lambda *a, **k: getattr(getturtle(), name)(*a, **k)\nfor _n in [\"forward\", \"fd\", \"backward\", \"bk\", \"back\", \"left\", \"lt\", \"right\", \"rt\", \"setheading\", \"seth\", \"heading\", \"goto\", \"setpos\", \"setposition\",\n           \"setx\", \"sety\", \"home\", \"position\", \"pos\", \"xcor\", \"ycor\", \"distance\", \"towards\", \"penup\", \"pu\", \"up\", \"pendown\", \"pd\", \"down\", \"isdown\", \"pensize\", \"width\",\n           \"pencolor\", \"fillcolor\", \"color\", \"begin_fill\", \"end_fill\", \"circle\", \"dot\", \"stamp\", \"write\", \"speed\", \"hideturtle\", \"ht\", \"showturtle\", \"st\", \"shape\", \"clear\", \"reset\"]:\n    globals()[_n] = _bind(_n)\ndef bgcolor(*c): _screen.bgcolor(*c)\ndef setup(*a, **k): _screen.setup(*a, **k)\ndef title(*a): pass\ndef tracer(*a, **k): pass\ndef update(): pass\ndef colormode(*a): pass\ndef done(): pass\nmainloop = exitonclick = bye = done\n"
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
      try { py.FS.writeFile('/home/pyodide/turtle.py', TURTLE) } catch (_) {}
      py.runPython("import sys\nif '/home/pyodide' not in sys.path: sys.path.insert(0, '/home/pyodide')")
      py.runPython("import os, warnings\nos.environ['MPLBACKEND'] = 'Agg'\nwarnings.filterwarnings('ignore', message='.*non-interactive.*')\nwarnings.filterwarnings('ignore', message='.*non-GUI backend.*')\nwarnings.filterwarnings('ignore', message='.*font cache.*')")
    }
    py.runPython("import sys\nsys.modules.pop('turtle', None)") // each run draws on its own canvas
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
// the last result drawn as bars: the first column names them, the last column measures them
const chart = (r) => {
  const vals = r.values.map((v) => v[v.length - 1]), names = r.values.map((v) => String(v[0] === null ? 'NULL' : v[0]))
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals), span = max - min || 1
  draw('size', [480, 260]); draw('clear', ['white'])
  const g = ctx2(), L = 40, B = 230, W = 480 - L - 10, H = 200, step = W / vals.length
  g.strokeStyle = 'rgb(160,160,160)'; g.beginPath(); g.moveTo(L, B - ((0 - min) / span) * H); g.lineTo(L + W, B - ((0 - min) / span) * H); g.stroke()
  g.font = '11px sans-serif'; g.fillStyle = 'rgb(60,60,60)'; g.textAlign = 'right'; g.fillText(String(max), L - 4, B - H + 4); g.fillText(String(min), L - 4, B + 4)
  vals.forEach((v, i) => {
    const y0 = B - ((0 - min) / span) * H, y1 = B - ((v - min) / span) * H
    g.fillStyle = 'rgb(214,170,30)'; g.fillRect(L + i * step + step * 0.15, Math.min(y0, y1), step * 0.7, Math.abs(y1 - y0))
    if (vals.length <= 16) { g.save(); g.fillStyle = 'rgb(60,60,60)'; g.textAlign = 'center'; g.fillText(names[i].slice(0, 10), L + i * step + step / 2, B + 16); g.restore() }
  })
  g.textAlign = 'left'; g.fillStyle = 'rgb(60,60,60)'; g.fillText(r.columns[r.columns.length - 1] + ' by ' + r.columns[0], L, 14)
}
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
    const last = res[res.length - 1]
    if (last && last.columns.length >= 2 && last.values.length >= 2 && last.values.length <= 60 && last.values.every((r) => typeof r[r.length - 1] === 'number')) chart(last)
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
      const drawCmd = JustBash.defineCommand('draw', async (args) => {
        try { draw(args[0] || '', args.slice(1)); return { stdout: '', stderr: '', exitCode: 0 } }
        catch (err) { return { stdout: '', stderr: msg(err) + '\n', exitCode: 1 } }
      })
      sh = new JustBash.Bash({ cwd: '/home/you', env: { HOME: '/home/you', USER: 'you' }, files: { '/home/you/notes.txt': 'Files you make here last until you press Stop or close the window.\n' }, customCommands: [drawCmd] })
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
// graphics.h, a little of Turbo C's BGI: initgraph, putpixel, line, rectangle, bar, circle, ellipse, outtextxy and the sixteen colours
const EGA = ['black', 'rgb(0,0,170)', 'rgb(0,170,0)', 'rgb(0,170,170)', 'rgb(170,0,0)', 'rgb(170,0,170)', 'rgb(170,85,0)', 'rgb(170,170,170)', 'rgb(85,85,85)', 'rgb(85,85,255)', 'rgb(85,255,85)', 'rgb(85,255,255)', 'rgb(255,85,85)', 'rgb(255,85,255)', 'rgb(255,255,85)', 'white']
const COLOURS = ['BLACK', 'BLUE', 'GREEN', 'CYAN', 'RED', 'MAGENTA', 'BROWN', 'LIGHTGRAY', 'DARKGRAY', 'LIGHTBLUE', 'LIGHTGREEN', 'LIGHTCYAN', 'LIGHTRED', 'LIGHTMAGENTA', 'YELLOW', 'WHITE']
const GRAPHICS = { load(rt) {
  const I = rt.intTypeLiteral, V = rt.voidTypeLiteral, S = rt.normalPointerType(rt.charTypeLiteral), IP = rt.normalPointerType(rt.intTypeLiteral)
  const g = 'global', c = (i) => EGA[((i.v % 16) + 16) % 16]
  let fg = 15, bg = 0, fillc = 15
  COLOURS.forEach((name, i) => { rt.scope[0].variables[name] = rt.val(I, i) })
  rt.scope[0].variables.DETECT = rt.val(I, 0); rt.scope[0].variables.VGA = rt.val(I, 9); rt.scope[0].variables.VGAHI = rt.val(I, 2); rt.scope[0].variables.SOLID_FILL = rt.val(I, 1)
  const reset = () => { draw('size', [640, 480]); draw('clear', [EGA[bg]]); pen.stroke = EGA[fg]; pen.fill = EGA[fillc]; pen.width = 1 }
  rt.regFunc((rt, _t, a, b, p) => { reset() }, g, 'initgraph', [IP, IP, S], V)
  rt.regFunc(() => {}, g, 'closegraph', [], V)
  rt.regFunc(() => { draw('clear', [EGA[bg]]) }, g, 'cleardevice', [], V)
  rt.regFunc((rt, _t, i) => { fg = ((i.v % 16) + 16) % 16; pen.stroke = EGA[fg] }, g, 'setcolor', [I], V)
  rt.regFunc((rt, _t, i) => { bg = ((i.v % 16) + 16) % 16 }, g, 'setbkcolor', [I], V)
  rt.regFunc((rt, _t, s, i) => { fillc = ((i.v % 16) + 16) % 16; pen.fill = EGA[fillc] }, g, 'setfillstyle', [I, I], V)
  rt.regFunc((rt, _t, x, y, i) => { const o = pen.stroke; pen.stroke = c(i); draw('pixel', [x.v, y.v]); pen.stroke = o }, g, 'putpixel', [I, I, I], V)
  rt.regFunc((rt, _t, a, b, x, y) => { draw('line', [a.v, b.v, x.v, y.v]) }, g, 'line', [I, I, I, I], V)
  rt.regFunc((rt, _t, l, t, r, b) => { draw('rect', [l.v, t.v, r.v - l.v, b.v - t.v]) }, g, 'rectangle', [I, I, I, I], V)
  rt.regFunc((rt, _t, l, t, r, b) => { draw('fillrect', [l.v, t.v, r.v - l.v, b.v - t.v]) }, g, 'bar', [I, I, I, I], V)
  rt.regFunc((rt, _t, x, y, r) => { draw('circle', [x.v, y.v, r.v]) }, g, 'circle', [I, I, I], V)
  rt.regFunc((rt, _t, x, y, rx, ry) => { draw('fillcircle', [x.v, y.v, Math.max(rx.v, ry.v)]) }, g, 'fillellipse', [I, I, I, I], V)
  rt.regFunc((rt, _t, x, y, s, e, rx, ry) => { draw('ellipse', [x.v, y.v, rx.v, ry.v]) }, g, 'ellipse', [I, I, I, I, I, I], V)
  rt.regFunc((rt, _t, x, y, s) => { draw('text', [x.v, y.v + 10, rt.getStringFromCharArray(s)]) }, g, 'outtextxy', [I, I, S], V)
  rt.regFunc(() => rt.val(I, 639), g, 'getmaxx', [], I)
  rt.regFunc(() => rt.val(I, 479), g, 'getmaxy', [], I)
  rt.regFunc(() => rt.val(I, 0), g, 'graphresult', [], I)
  rt.regFunc(() => {}, g, 'delay', [I], V)
} }
// JSCPP's preprocessor loses spaces inside a string passed to a function ("a, b" printed "a,b"); spelled as escapes they survive
const keep = (src) => src.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m[0] === '"' ? m.replace(/ /g, '\\x20') : m))
onmessage = (e) => {
  const d = e.data
  begin(d)
  try {
    if (!self.JSCPP) { status('Loading C/C++'); importScripts(d.base + '/rt/__CPP__') }
    const J = self.JSCPP.run ? self.JSCPP : self.JSCPP.default
    status('Running')
    const code = J.run(keep(d.code), d.input || '', { stdio: { write: (s) => out(String(s)) }, includes: { 'graphics.h': GRAPHICS } })
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
    try { vm.eval('require "js"') } catch (_) {} // JS.global[:canvas] is the picture
    try { vm.eval(d.code) } finally { vm.eval('$stdout.flush; $stderr.flush') }
  } catch (err) { out(msg(err) + '\n', 1) }
  done()
}
`

const LUA = String.raw`
let F = null
const PRELUDE = 'print = function(...) local t = {} for i = 1, select("#", ...) do t[i] = tostring((select(i, ...))) end __w(table.concat(t, "\\t") .. "\\n") end\n' +
  'io.write = function(...) for i = 1, select("#", ...) do __w(tostring((select(i, ...)))) end end\n' +
  'io.read = function() return __r() end\n' +
  'draw = setmetatable({}, { __index = function(_, op) return function(...) __draw(op, ...) end end })'
onmessage = async (e) => {
  const d = e.data
  begin(d)
  let lua = null
  try {
    if (!F) { status('Loading Lua'); const { LuaFactory } = await import('__LUA_GLUE__'); F = new LuaFactory('__LUA_WASM__') }
    lua = await F.createEngine()
    lua.global.set('__w', (s) => out(String(s)))
    lua.global.set('__r', () => take())
    lua.global.set('__draw', (op, ...a) => draw(op, a.filter((x) => x !== undefined && x !== null)))
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
  w.onmessage = (m) => parent.postMessage(m.data, '*', m.data && m.data.bmp ? [m.data.bmp] : [])
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
