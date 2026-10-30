import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { verdict } from './_blocklist.js'
import { createClient, type Client } from '@libsql/client'
import { clean, internal, json, readable, THIN, UA } from './_page.js'

/**
 * JavaScript for the Browser window, done on our side, for pages a device cannot run itself: the cloud browser measures how long a page holds
 * up its own single thread (long tasks) and, when that is too much, the window asks for this instead (go.html, Browser.tsx). A page's scripts are never run in the person's browser (a script could send the
 * frame to a blocked site, or fetch around the blocklist), so for a page that needs them this endpoint opens it in a headless browser
 * on the server, lets its scripts run, and sends back the finished page with the scripts removed, the same shape `api/browse.ts?u=`
 * sends. What comes back is what the page drew; links and searches still go through the window, so the blocklist always applies.
 *
 * What it will not do: every request the page makes (and every redirect and script-made navigation) is checked against the blocklist
 * and against private networks and is dropped if it fails; images, fonts, media and frames are not loaded (nothing is shown from them
 * here); no cookies or sign-ins exist; and it does not try to get past a bot check. A site that answers 401/403/451, or that shows a
 * "checking your browser" page, is reported as `walled` and left alone. Google's and YouTube's own pages are answered by the window
 * itself and refused here. Each request starts its own browser and closes it, at most two at a time.
 *
 * It is metered, because it costs money: it is asked for when a cloud page proves too heavy for the device, each address gets `PER_IP` seconds
 * of it a day (10 minutes), and everyone together get `ALL` (env `RENDER_DAILY_CAP_MIN`, default 60 minutes, which api/relay.ts takes off the cloud browser's share of the $20), kept in Turso as hashed addresses by UTC day.
 * `?usage=1` says how much is left. With no Turso configured it refuses, so it can never run unmetered.
 */
const OWN = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$|^(www\.)?google\.[a-z.]{2,6}$/i
const CHALLENGE = /just a moment|attention required|access denied|verify(ing)? (you are|that you|your browser)|are you a (robot|human)|captcha|checking (your|the) browser/i
const SKIP = new Set(['image', 'media', 'font', 'texttrack', 'websocket', 'eventsource', 'manifest', 'ping', 'prefetch', 'cspviolationreport'])
const BUDGET_MS = 40_000
let active = 0

const PER_IP = 10 * 60
const ALL = (Number(process.env.RENDER_DAILY_CAP_MIN) || 60) * 60
let db: Client | undefined
let ready: Promise<unknown> | undefined
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
const init = () => (ready ??= client().execute('CREATE TABLE IF NOT EXISTS cloud_use (id TEXT NOT NULL, day TEXT NOT NULL, secs REAL NOT NULL DEFAULT 0, PRIMARY KEY (id, day))'))
const today = () => new Date().toISOString().slice(0, 10)
async function who(ip: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cloud:${ip}`))
  return Array.from(new Uint8Array(h)).slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function used(id: string) {
  await init()
  const r = await client().execute({ sql: 'SELECT id, secs FROM cloud_use WHERE day = ? AND id IN (?, ?)', args: [today(), id, 'ALL'] })
  const get = (k: string) => Number(r.rows.find((x) => x.id === k)?.secs ?? 0)
  return { ip: get(id), all: get('ALL') }
}
async function charge(id: string, secs: number) {
  const c = client()
  const sql = 'INSERT INTO cloud_use (id, day, secs) VALUES (?, ?, ?) ON CONFLICT (id, day) DO UPDATE SET secs = secs + excluded.secs'
  await c.batch([{ sql, args: [id, today(), secs] }, { sql, args: ['ALL', today(), secs] }, { sql: 'DELETE FROM cloud_use WHERE day < ?', args: [new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)] }])
}

/**
 * Pages built from web components keep their content inside shadow roots, which a page's markup does not include. This copies the page
 * with each open shadow root written out in place of its host (slots filled with what was put in them, scoped styles made ordinary
 * rules for the host's tag), and returns that as the page. Closed roots cannot be read and stay empty.
 */
const FLATTEN = `(() => {
  const css = (sheets) => Array.from(sheets || []).map((sh) => { try { return Array.from(sh.cssRules).map((r) => r.cssText).join('\\n') } catch (e) { return '' } }).join('\\n')
  const scope = (text, tag) => text.replace(/:host\\(([^)]*)\\)/g, tag + '$1').replace(/:host\\b/g, tag)
  const copy = (n) => {
    if (n.nodeType !== 1) return n.cloneNode(true)
    if (n.localName === 'slot') {
      const frag = document.createDocumentFragment()
      const got = n.assignedNodes({ flatten: true })
      for (const k of (got.length ? got : Array.from(n.childNodes))) frag.appendChild(copy(k))
      return frag
    }
    const c = n.cloneNode(false)
    if (n.shadowRoot) {
      const own = scope(css(n.shadowRoot.adoptedStyleSheets), n.localName)
      if (own.trim()) { const st = document.createElement('style'); st.textContent = own; c.appendChild(st) }
      for (const k of Array.from(n.shadowRoot.childNodes)) {
        if (k.nodeType === 1 && k.localName === 'style') { const st = document.createElement('style'); st.textContent = scope(k.textContent || css([k.sheet]), n.localName); c.appendChild(st) } else c.appendChild(copy(k))
      }
      return c
    }
    if (n.localName === 'style' && !(n.textContent || '').trim() && n.sheet) { c.textContent = css([n.sheet]); return c }
    for (const k of Array.from(n.childNodes)) c.appendChild(copy(k))
    return c
  }
  const root = copy(document.documentElement)
  try {
    const sheets = css(document.adoptedStyleSheets)
    if (sheets.trim()) { const st = document.createElement('style'); st.textContent = sheets; (root.querySelector('head') || root).appendChild(st) }
  } catch (e) {}
  return '<!doctype html>' + root.outerHTML
})()`
/** pages that fill in as they are scrolled get a look at the first few screens */
const SCROLL = `(async () => { for (let y = 0; y < 3600; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) } window.scrollTo(0, 0) })()`

/** why a request was refused, for whichever shape of answer `verdict` gave (a check that works however strictly this file is compiled) */
const whyNot = (v: ReturnType<typeof verdict>) => ('why' in v ? v.why : 'not a web page')

type Done = { url: string; html: string } | { error: string; why?: string; walled?: true }

async function render(start: string, width: number): Promise<Done> {
  const v0 = verdict(start)
  if (!v0.ok) return { error: 'blocked', why: whyNot(v0) }
  if (internal(v0.url.hostname)) return { error: 'blocked', why: 'not a web page' }
  if (OWN.test(v0.url.hostname)) return { error: 'The window answers that one itself' }

  chromium.setGraphicsMode = false
  const browser = await puppeteer.launch({
    args: chromium.args.filter((a) => !/disable-web-security|allow-running-insecure-content/.test(a)),
    executablePath: await chromium.executablePath(),
    headless: 'shell',
    defaultViewport: { width, height: 900, deviceScaleFactor: 1 },
  })
  try {
    const page = await browser.newPage()
    await page.setUserAgent(UA)
    page.setDefaultNavigationTimeout(20_000)
    // request interception cannot see a WebSocket or a service worker's own requests, so a page gets neither
    await page.setBypassServiceWorker(true)
    await page.evaluateOnNewDocument('window.WebSocket = undefined; window.EventSource = undefined; if (navigator.serviceWorker) { try { Object.defineProperty(navigator, "serviceWorker", { value: undefined }) } catch (e) {} }')
    let blocked = ''
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (req.isInterceptResolutionHandled()) return
      const u = req.url()
      if (u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return void req.continue()
      const main = req.frame() === page.mainFrame()
      if (SKIP.has(req.resourceType()) || (req.isNavigationRequest() && !main)) return void req.abort()
      let ok = false
      try {
        const v = verdict(u)
        ok = v.ok && /^https?:$/.test(v.url.protocol) && !internal(v.url.hostname)
        if (!ok && req.isNavigationRequest() && main) blocked = whyNot(v)
      } catch { /* an address that does not parse is not fetched */ }
      if (ok) void req.continue(); else void req.abort()
    })
    page.on('dialog', (d) => void d.dismiss().catch(() => {}))
    page.on('popup', (p) => void p?.close().catch(() => {}))

    let resp
    try { resp = await page.goto(v0.url.toString(), { waitUntil: 'domcontentloaded' }) } catch (e) {
      if (blocked) return { error: 'blocked', why: blocked }
      return { error: (e as Error).message.includes('timeout') ? 'The page took too long to load' : 'The page could not be reached' }
    }
    if (blocked) return { error: 'blocked', why: blocked }
    const status = resp?.status() ?? 0
    if (status === 401 || status === 403 || status === 451) return { error: `${v0.url.hostname.replace(/^www\./, '')} does not let other programs read its pages`, walled: true }
    if (status === 429 || status === 503) return { error: 'The site is busy right now. Try again in a moment' }
    if (status >= 400) return { error: `The site answered ${status}` }
    if (resp && !/html|xml/i.test(resp.headers()['content-type'] ?? '')) return { error: 'This is a file, not a page', why: 'not a web page' }

    // let its scripts finish their first round, look down the page, and let what that loads settle
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 7000 }).catch(() => {})
    await page.evaluate(SCROLL).catch(() => {})
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 3000 }).catch(() => {})

    const final = page.url()
    const vf = verdict(final)
    if (!vf.ok) return { error: 'blocked', why: whyNot(vf) }
    if (CHALLENGE.test(await page.title().catch(() => ''))) return { error: `${vf.url.hostname.replace(/^www\./, '')} asks to check that you are a person, which the Browser cannot do`, walled: true }
    const body = await page.evaluate(`document.body ? document.body.innerText.slice(0, 400) : ''`).catch(() => '') as string
    if (CHALLENGE.test(body) && body.length < 400) return { error: `${vf.url.hostname.replace(/^www\./, '')} asks to check that you are a person, which the Browser cannot do`, walled: true }
    // the flattened copy; if the page will not allow that, its plain markup
    const flat = await page.evaluate(FLATTEN).catch(() => null) as string | null
    return { url: final, html: flat && flat.length > 200 ? flat : await page.content() }
  } finally {
    // one browser per request: closed even if it is slow to say goodbye
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]).catch(() => {})
    browser.process()?.kill('SIGKILL')
  }
}

export default {
  async fetch(request: Request) {
    // only the Browser window may ask (a script on another site, or a program that does not say where it is from, may not)
    const site = request.headers.get('sec-fetch-site')
    let here = site === 'same-origin'
    if (!site) { try { here = new URL(request.headers.get('referer') ?? '').host === request.headers.get('host') } catch { here = false } }
    if (!here) return json({ error: 'not here' }, 403)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'The cloud browser is not set up' }, 503)
    const p = new URL(request.url).searchParams
    let id: string, before: { ip: number; all: number }
    try { id = await who(ip); before = await used(id) } catch { return json({ error: 'The cloud browser could not check its limit' }, 503) }
    const left = Math.max(0, PER_IP - before.ip)
    if (p.get('usage') === '1') return json({ left, perDay: PER_IP })
    if (left <= 0) return json({ error: 'limit', left: 0 }, 429)
    if (before.all >= ALL) return json({ error: 'full', left }, 429)
    const u = p.get('u') ?? ''
    if (!u) return json({ error: 'bad' }, 400)
    // a few widths, so the same page is cached once for each and not once for every pixel
    const w = Number(p.get('w')) || 1024
    const width = w <= 480 ? 390 : w <= 900 ? 768 : 1100
    if (active >= 2) return json({ error: 'busy' }, 429)
    active++
    const t0 = Date.now()
    try {
      const got = await Promise.race([render(u, width), new Promise<Done>((r) => setTimeout(() => r({ error: 'The page took too long to run' }), BUDGET_MS))])
      if ('error' in got) return json(got, got.error === 'blocked' ? 403 : 502)
      const html = clean(got.html, got.url, false, true)
      return json({ url: got.url, html, thin: readable(html) < THIN, left: Math.max(0, left - Math.ceil((Date.now() - t0) / 1000)) })
    } catch { return json({ error: 'Running the page did not work' }, 502) } finally {
      active--
      // only real browsing time is charged, not a refusal that took no time
      const spent = Date.now() - t0
      if (spent > 1500) await charge(id, Math.ceil(spent / 1000)).catch(() => {})
    }
  },
}
