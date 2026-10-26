/**
 * Lesson demos, written on the fly. The lesson's topic goes in, one small interactive demo comes out (a fragment of HTML with a
 * script) which the browser runs inside a sandboxed iframe with no network, no storage and no way to reach the page.
 *
 * Why this is on the server: the Gemini key must not live in the browser. Only the topic title is sent (public Wikipedia
 * titles, nothing about the person). A GET with a long shared cache means each topic is written once a month for everyone.
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional, a comma separated list tried in order).
 */
/** models to try, as `model` or `model:thinking` (thinking level minimal, low, medium or high; leave it off for models that do not think) */
const CANDIDATES = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3-flash-preview:low,gemini-3.5-flash:minimal,gemini-3.7-flash:low,gemini-3.8-flash:low').split(',').map((m) => m.trim()).filter(Boolean).map((m) => { const [model, think] = m.split(':'); return { model, think } })
/** a second model is started if the first has not answered by then, and a third after the same wait again; the first good answer wins */
const HEDGE_MS = Number(process.env.GEMINI_HEDGE_MS) || 9000
const BUDGET_MS = 50e3
const MAX_HTML = 16000
const MIN_HTML = 400

const json = (body: unknown, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })

const hits = new Map<string, { n: number; at: number }>()
function limited(id: string, max: number, windowMs: number) {
  const now = Date.now()
  const h = hits.get(id)
  if (!h || now - h.at > windowMs) { hits.set(id, { n: 1, at: now }); if (hits.size > 8000) hits.clear(); return false }
  return ++h.n > max
}

const SYSTEM = `You write one small interactive teaching demo for a calm focus-and-learning web app. A learner is partway through a short lesson on a topic and gets one minute to play with an idea from it. The demo runs inside a sandboxed iframe: no network, no storage, no access to the page around it.

Reply with exactly these four sections, each starting with its marker on its own line, and nothing else (no commentary, no code fences):

<<<TITLE>>>
Two to five words naming the demo (for example: Orbit launcher).
<<<TASK>>>
One plain sentence of at most 22 words telling the learner what to try. Start with a verb.
<<<NOTE>>>
One plain sentence of at most 28 words on what the demo shows and what it simplifies. Be honest about simplifications. Never present invented numbers as real data.
<<<HTML>>>
The demo itself: markup, optionally one <style>, and exactly one <script>. No <html>, <head>, <body> or doctype.

WHAT TO MAKE
- Pick the single most instructive thing a learner can DO with this topic: tune a parameter and watch a model respond, sort or classify things, build something from parts, scrub through a process, compare two cases with a toggle. It must respond to touch within a second. It is not a quiz and not a slideshow.
- Be factually careful. Only model what you are confident is correct, and keep the model simple. If a number must appear, derive it from the model on screen.
- Stay on this one topic. No text about yourself, no instructions to leave the lesson.

THE FRAME YOUR FRAGMENT IS PLACED IN
- Your fragment goes inside <main id="app">, a flex column that fills the frame: between 280 and 900 px wide and 200 to 600 px tall. It must fit without scrolling at any size in that range. Give one child the class "grow" (a stage, canvas or svg that takes the leftover height, with min-height:0) and keep the controls compact in ".row" blocks under or beside it. The stage is the star: it must get at least half of the frame's height, so keep readouts to one small line (put the number and its label side by side in one .row, use .big only for a single figure) and use at most two or three controls. On wide frames (over 600px) you may put the controls in a column beside the stage.
- Canvas: size it from its container with a ResizeObserver (width and height times devicePixelRatio) and redraw on resize. SVG: use a viewBox and let it scale.
- Provided CSS variables (use these and never hard-coded colours): --ink (text), --ink2, --ink3 (quieter text), --ground (background), --signal (the one accent), --on-signal (text on the accent), --rule (hairlines), plus --ice (a second accent) and the status colours --good, --bad, --warn. Use --good and --bad for right and wrong or safe and danger, never your own reds and greens. In canvas code read them with getComputedStyle(document.body).getPropertyValue('--signal').
- Provided styles: button, input[type=range], select, input[type=text], label are already styled and 44px high. Classes: .row (flex, wrapping, gap), .col (flex column), .grow, .hud (small uppercase label), .big (large numeric readout), .card (ruled box), .muted, .stage (ruled box for a canvas or svg). A button with aria-pressed="true" shows as selected. Font is the system font.

RULES THAT MATTER
- Vanilla JavaScript only. No libraries, imports, fetch, XMLHttpRequest, WebSocket, eval, new Function, document.write, alert, confirm, prompt, window.open, localStorage, sessionStorage, cookies, parent or top. No external URLs, fonts or images.
- No infinite or very long synchronous loops. Animate with requestAnimationFrame or setInterval and only after the learner presses something. If matchMedia('(prefers-reduced-motion: reduce)').matches, jump straight to the end state instead of animating.
- Every control has a visible label or an aria-label. Controls work with keyboard and touch. Show results as text as well as graphics (an element with aria-live="polite"). Never rely on colour alone.
- All text is at least 12px. Keep the whole HTML section under about 6000 characters and the script under about 100 lines. Simple, robust code beats clever code. Initialise to a sensible state so the first view is already meaningful.

Skeleton of the HTML section (shape only, write your own content):
<div class="row"><span class="hud">Label</span><span class="big" id="out">0</span></div>
<div class="stage grow" id="stage"><canvas id="c"></canvas></div>
<div class="row"><label>Name <input type="range" id="a" min="0" max="100" value="50"></label><button id="go">Run</button></div>
<script>/* wire it up */</script>`

const FORBID: [RegExp, string][] = [
  [/<\s*(iframe|object|embed|link|meta|base|form)\b/i, 'blocked element'],
  [/<\s*script[^>]*\bsrc\s*=/i, 'external script'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon)\b/, 'network'],
  [/\b(eval|Function)\s*\(/, 'eval'],
  [/\bimport\s*\(|(?:^|[;\n])\s*import\s+(?:[\w*{}\s,]+\s+from\s+)?["']/m, 'import'],
  [/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/, 'storage'],
  [/\b(window|self|globalThis)\s*\.\s*(top|parent|open|frames)\b|(?<![\w.$])(parent|top)\s*\.\s*(postMessage|document|location|frames|window)\b|document\.write|\blocation\s*(=(?!=)|\.(href|assign|replace))/, 'escape'],
  [/\b(alert|confirm|prompt)\s*\(/, 'dialog'],
  [/while\s*\(\s*(true|1)\s*\)|for\s*\(\s*;\s*;\s*\)/, 'endless loop'],
  [/(?:https?:)?\/\/(?!www\.w3\.org\/)[a-z0-9.-]+\.[a-z]{2,}/i, 'external url'],
]

/** pull the four sections out of the model's reply and check the code before it ever reaches a browser */
export function parse(raw: string): { title: string; task: string; note: string; html: string } | { error: string } {
  const text = raw.replace(/```(?:html|javascript|js)?/gi, '')
  const part = (name: string, next: string) => {
    const m = text.match(new RegExp(`<<<${name}>>>\\s*([\\s\\S]*?)\\s*(?:<<<${next}>>>|$)`))
    return m ? m[1].trim() : ''
  }
  const title = part('TITLE', 'TASK').replace(/\s+/g, ' ').slice(0, 60)
  const task = part('TASK', 'NOTE').replace(/\s+/g, ' ').slice(0, 320)
  const note = part('NOTE', 'HTML').replace(/\s+/g, ' ').slice(0, 360)
  let html = part('HTML', 'END')
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (body) html = body[1].trim()
  html = html.replace(/<!doctype[^>]*>|<\/?(html|head|body)[^>]*>/gi, '').replace(/\s*<<<[A-Z]*>{0,3}\s*$/, '').trim()
  if (!title || !task || !note) return { error: 'missing text sections' }
  if (html.length < MIN_HTML || html.length > MAX_HTML) return { error: 'html size' }
  if (!/<script\b/i.test(html)) return { error: 'no script' }
  if (!/addEventListener|\boninput\b|\bonclick\b|\bonchange\b|\bonpointer/i.test(html)) return { error: 'nothing interactive' }
  for (const [re, why] of FORBID) if (re.test(html)) return { error: `forbidden: ${why}` }
  return { title, task, note, html }
}

async function summary(title: string): Promise<string> {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`, { headers: { accept: 'application/json', 'user-agent': 'friction-lessons/1.0 (focus app; lesson demos)' }, signal: AbortSignal.timeout(3500) })
    if (!r.ok) return ''
    const d = (await r.json()) as { extract?: string; description?: string }
    return `${d.description ? `(${d.description}) ` : ''}${(d.extract ?? '').slice(0, 1400)}`.trim()
  } catch { return '' }
}

type Won = Exclude<ReturnType<typeof parse>, { error: string }> & { model: string }

/** a model that said it is out of quota (or busy) is left alone for a while, so the next visitor does not wait for it */
const resting = new Map<string, number>()

async function attempt(c: { model: string; think?: string }, title: string, about: string, key: string, signal: AbortSignal): Promise<{ ok: true; value: Won } | { ok: false; why: string }> {
  if ((resting.get(c.model) ?? 0) > Date.now()) return { ok: false, why: `${c.model} resting` }
  try {
    let think = c.think
    let r = await go(think)
    if (r.status === 400 && think) { think = undefined; r = await go(think) } // some models refuse a thinking level: ask again without one
    if (r.status === 429) resting.set(c.model, Date.now() + 30 * 60e3)
    else if (r.status === 503) resting.set(c.model, Date.now() + 60e3)
    return await read(r)
  } catch (e) { return { ok: false, why: `${c.model} ${(e as Error).name}` } }

  function go(level?: string) {
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `Lesson topic: ${title}\n${about ? `What Wikipedia says: ${about}\n` : ''}\nWrite the demo.` }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 12000, ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}) },
      }),
      signal,
    })
  }
  async function read(r: Response): Promise<{ ok: true; value: Won } | { ok: false; why: string }> {
    if (!r.ok) return { ok: false, why: `${c.model} ${r.status}` }
    const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const text = d.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? ''
    const out = parse(text)
    if ('error' in out) return { ok: false, why: `${c.model} ${out.error}` }
    return { ok: true, value: { ...out, model: c.model } }
  }
}

/** Asks the models in turn, but does not wait for a slow one: a backup starts if the first is quiet, and the first good answer wins. */
function write(title: string, about: string, key: string): Promise<{ ok: true; value: Won } | { ok: false; why: string }> {
  return new Promise((resolve) => {
    const stop = new AbortController()
    const why: string[] = []
    const timers: ReturnType<typeof setTimeout>[] = []
    let started = 0, live = 0, done = false
    const finish = (r: { ok: true; value: Won } | { ok: false; why: string }) => { if (done) return; done = true; timers.forEach(clearTimeout); stop.abort(); resolve(r) }
    const launch = () => {
      if (done || started >= CANDIDATES.length) return
      const c = CANDIDATES[started++]
      live++
      void attempt(c, title, about, key, stop.signal).then((r) => {
        live--
        if (r.ok) return finish(r)
        why.push(r.why)
        if (started < CANDIDATES.length) launch() // that one failed: do not wait to start the next
        else if (live === 0) finish({ ok: false, why: why.join('; ') })
      })
      if (started < CANDIDATES.length) timers.push(setTimeout(launch, HEDGE_MS))
    }
    timers.push(setTimeout(() => finish({ ok: false, why: `${why.join('; ')} out of time`.trim() }), BUDGET_MS))
    launch()
  })
}

export default {
  async fetch(request: Request) {
    const key = process.env.GEMINI_API_KEY
    if (!key) return json({ error: 'off' }, 503)
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'not here' }, 403)
    const title = (new URL(request.url).searchParams.get('t') ?? '').replace(/[\u0000-\u001f<>{}\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (title.length < 2) return json({ error: 'topic' }, 400)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    if (limited(`ip:${ip}`, 10, 3600e3)) return json({ error: 'slow down' }, 429)
    const res = await write(title, await summary(title), key)
    if (!res.ok) return json({ error: 'busy', why: res.why }, 502)
    // good answers are kept for a month for everyone, so a popular topic is written once
    return json(res.value, 200, 'public, s-maxage=2592000, stale-while-revalidate=604800')
  },
}
