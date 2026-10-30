const { chromium } = require('playwright')
const fs = require('fs')
const BASE = 'http://localhost:5174'
const W = 1280, H = 720
const CURSOR = `(() => {
  const mk = () => {
    const c = document.createElement('div'); c.id = 'fx-cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px;pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px);will-change:transform'
    c.innerHTML = '<svg width="40" height="40" viewBox="0 0 34 34"><path d="M4 2 L4 26 L10 20 L15 31 L19 29 L14 18 L23 18 Z" fill="#fff" stroke="#05070c" stroke-width="2" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(c)
    addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 2) + 'px)' }, true)
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div')
      r.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:3px solid #ffd23f;border-radius:50%;width:12px;height:12px;left:' + (e.clientX - 6) + 'px;top:' + (e.clientY - 6) + 'px'
      document.documentElement.appendChild(r)
      r.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(5)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => r.remove()
    }, true)
  }
  if (document.documentElement) mk(); else addEventListener('DOMContentLoaded', mk)
})()`
let cur = { x: 960, y: 700 }
let marks = []
const mk = (n) => marks.push([n, Date.now() / 1000])
async function glide(p, x, y, ms = 700) {
  const s = cur, n = Math.max(10, Math.round(ms / 16))
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    await p.mouse.move(s.x + (x - s.x) * e, s.y + (y - s.y) * e)
    await p.waitForTimeout(ms / n)
  }
  cur = { x, y }
}
const center = async (loc) => { const b = await loc.first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b } }
async function clickOn(p, loc, ms = 650) { const c = await center(loc); await glide(p, c.x, c.y, ms); await p.waitForTimeout(120); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); await p.waitForTimeout(250) }


const SEED = { state: { settings: { toured: true, browserToured: true, songAge: 0 }, profile: { name: 'Zak' }, seenIntro: true }, version: 0 }
const STATE = '/tmp/claude-0/state5174.json'
const OUT = '/home/user/ultraviolet/video/public/v4/ui'
async function prepare() {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: W, height: H } })
  const p = await ctx.newPage()
  await p.addInitScript((seed) => { try { sessionStorage.setItem('friction:booted', '1'); if (!localStorage.getItem('anti-scroll:v1')) localStorage.setItem('anti-scroll:v1', JSON.stringify(seed)) } catch (e) {} }, SEED)
  await p.goto(BASE + '/settings'); await p.waitForTimeout(6000)
  await p.getByText('Help', { exact: true }).first().click(); await p.waitForTimeout(500)
  await p.getByRole('button', { name: /Load demo data/ }).click(); await p.waitForTimeout(1200)
  await ctx.storageState({ path: STATE })
  await b.close()
}
async function clip(name, opts, fn) {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, storageState: STATE, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 FrictionAdRecorder' })
  const p = await ctx.newPage()
  await p.addInitScript(CURSOR)
  if (!opts.boot) await p.addInitScript(() => { try { sessionStorage.setItem('friction:booted', '1') } catch (e) {} })
  cur = { x: 640, y: 520 }; marks = []
  const dir = '/tmp/claude-0/sc_' + name; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const cdp = await ctx.newCDPSession(p)
  const frames = []
  cdp.on('Page.screencastFrame', async (ev) => {
    const file = dir + '/' + String(frames.length).padStart(6, '0') + '.jpg'
    fs.writeFileSync(file, Buffer.from(ev.data, 'base64'))
    frames.push({ ts: ev.metadata.timestamp, file })
    try { await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }) } catch (e) {}
  })
  await p.goto(BASE + (opts.url || '/focus')); await p.waitForTimeout(opts.settle ?? 1500)
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 2560, maxHeight: 1440, everyNthFrame: 1 })
  mk('t0')
  try { await fn(p) } catch (e) { console.log(name, 'ERR', e.message.slice(0, 200)) }
  await cdp.send('Page.stopScreencast').catch(() => {})
  await ctx.close(); await b.close()
  let list = ''
  frames.forEach((f, i) => { const d = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].ts - f.ts) : 0.2; list += "file '" + f.file + "'\nduration " + d.toFixed(4) + '\n' })
  list += "file '" + frames[frames.length - 1].file + "'\n"
  fs.writeFileSync(dir + '/list.txt', list)
  fs.mkdirSync(OUT, { recursive: true })
  require('child_process').execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${dir}/list.txt -vf "fps=30,scale=2560:1440" -c:v libx264 -pix_fmt yuv420p -crf 17 -preset medium -an ${OUT}/${name}.mp4`)
  const span = frames[frames.length - 1].ts - frames[0].ts
  console.log('done', name, frames.length, 'frames', (frames.length / span).toFixed(1) + 'fps', span.toFixed(1) + 's', marks.map(([n, t]) => n + '=' + (t - frames[0].ts).toFixed(1)).join(' '))
}
const want = (n) => !process.argv[2] || process.argv.slice(2).includes(n)
const store = (p, fn, arg) => p.evaluate(async ([src, a]) => { const m = await import('/src/lib/store.ts'); return (new Function('m', 'a', src))(m, a) }, [fn, arg])
const hide = (p, on) => p.evaluate((on) => {
  Object.defineProperty(document, 'visibilityState', { get: () => (on ? 'hidden' : 'visible'), configurable: true })
  Object.defineProperty(document, 'hidden', { get: () => on, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}, on)
;(async () => {
  if (want('prep')) await prepare()
  if (want('session')) await clip('session', { url: '/focus' }, async (p) => {
    const sl = await p.locator('[role="slider"]').first().boundingBox()
    const at = (v) => sl.x + 6 + (sl.width - 12) * ((v - 10) / 80)
    await p.waitForTimeout(700)
    await glide(p, at(25), sl.y + 24, 900); mk('sliderStart'); await p.mouse.down(); await p.waitForTimeout(120)
    await glide(p, at(52), sl.y + 24, 1000); await p.waitForTimeout(150); await glide(p, at(25), sl.y + 24, 800); await p.mouse.up(); mk('sliderEnd'); await p.waitForTimeout(500)
    mk('lockMove'); await clickOn(p, p.getByRole('button', { name: /^Lock in/i }), 800); mk('locked')
    await p.waitForTimeout(4200)
    mk('driftOut'); await hide(p, true); await p.waitForTimeout(7600); await hide(p, false); mk('driftBack'); await p.waitForTimeout(3600)
    await p.evaluate(async () => { const m = await import('/src/lib/store.ts'); const s = m.useStore.getState().session; if (s) m.useStore.getState().tick(s.goalMin * 60 - s.elapsedSec - 2.2) })
    mk('ff'); await p.waitForTimeout(6500); mk('end')
  })
  if (want('tune')) await clip('tune', { url: '/radio', settle: 3000 }, async (p) => {
    const inp = p.locator('input[placeholder="Search every station"]'); mk('searchMove'); await clickOn(p, inp, 800)
    mk('typeStart'); await p.keyboard.type('jazz', { delay: 170 }); mk('typeEnd'); await p.waitForTimeout(2300)
    const row = p.locator('button').filter({ hasText: /MP3|AAC|OGG/ }).first()
    mk('stationMove'); await clickOn(p, row, 900); mk('station'); await p.waitForTimeout(2600); mk('end')
  })
  if (want('themes')) await clip('themes', { url: '/focus', settle: 2200 }, async (p) => {
    await glide(p, 640, 300, 500)
    for (const n of [1, 2, 3, 4, 5]) { await p.keyboard.press('t'); mk('look' + n); await p.waitForTimeout(1500) }
    mk('end')
  })
  if (want('widgets')) await clip('widgets', { url: '/focus', settle: 2200 }, async (p) => {
    const c = await center(p.locator('[data-tour="widgets"] button')); mk('deckMove'); await glide(p, c.x, c.y, 800); await p.waitForTimeout(1900); mk('dealt')
    await clickOn(p, p.getByRole('button', { name: /^Notepad/ }), 650); mk('notepadOpen'); await p.waitForTimeout(700)
    await clickOn(p, p.locator('textarea[aria-label="Notes"]'), 600)
    mk('typeStart'); await p.keyboard.type('Chapter 4: friction counts', { delay: 80 }); mk('typeEnd'); await p.waitForTimeout(900); mk('end')
  })
  if (want('arcade')) await clip('arcade', { url: '/arcade', settle: 2500 }, async (p) => {
    await p.evaluate(async () => { const m = await import('/src/lib/store.ts'); m.useStore.setState((s) => ({ credits: { ...s.credits, bal: 240, earned: 260 } })) })
    await p.waitForTimeout(900)
    mk('playMove'); await clickOn(p, p.locator('button', { hasText: /6 credits/ }).first(), 900); mk('play'); await p.waitForTimeout(900)
    mk('startMove'); await clickOn(p, p.locator('button', { hasText: /^Start/ }).first(), 700); mk('start'); await p.waitForTimeout(4200)
    for (let i = 0; i < 26; i++) { const k = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'][i % 4]; await p.keyboard.down(k); await p.waitForTimeout(340); await p.keyboard.up(k); if (i % 3 === 0) await p.keyboard.press('Space') }
    mk('end')
  })
  if (want('learn')) await clip('learn', { url: '/learn', settle: 2200 }, async (p) => {
    mk('pickMove'); await clickOn(p, p.getByText('Stoicism', { exact: true }).first(), 900); mk('pick')
    await p.waitForTimeout(5000); mk('lesson'); await p.screenshot({ path: '/tmp/claude-0/learn-test.png' })
    await p.waitForTimeout(2500); mk('end')
  })
  if (want('debrief')) await clip('debrief', { url: '/debrief', settle: 300 }, async (p) => { mk('count'); await glide(p, 900, 420, 900); await p.waitForTimeout(4200); mk('end') })
})()
