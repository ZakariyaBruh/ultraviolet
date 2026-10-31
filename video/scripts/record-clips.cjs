const { chromium } = require('playwright')
const fs = require('fs')
const BASE = 'http://localhost:4173'
const W = 1280, H = 640
const CURSOR = `(() => {
  const mk = () => {
    const c = document.createElement('div'); c.id = 'fx-cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;width:36px;height:36px;pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px);will-change:transform'
    c.innerHTML = '<svg width="36" height="36" viewBox="0 0 34 34"><path d="M4 2 L4 26 L10 20 L15 31 L19 29 L14 18 L23 18 Z" fill="#fff" stroke="#05070c" stroke-width="2" stroke-linejoin="round"/></svg>'
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
async function prepare() {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: W, height: H } })
  const p = await ctx.newPage()
  await p.addInitScript((seed) => { try { sessionStorage.setItem('friction:booted', '1'); if (!localStorage.getItem('anti-scroll:v1')) localStorage.setItem('anti-scroll:v1', JSON.stringify(seed)) } catch (e) {} }, SEED)
  await p.goto(BASE + '/settings'); await p.waitForTimeout(1500)
  await p.getByText('Help', { exact: true }).first().click(); await p.waitForTimeout(500)
  await p.getByRole('button', { name: /Load demo data/ }).click(); await p.waitForTimeout(1200)
  await ctx.storageState({ path: '/tmp/claude-0/state.json' })
  await b.close()
}
async function clip(name, opts, fn) {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5, storageState: '/tmp/claude-0/state.json' })
  const p = await ctx.newPage()
  await p.addInitScript(CURSOR)
  if (!opts.boot) await p.addInitScript(() => { try { sessionStorage.setItem('friction:booted', '1') } catch (e) {} })
  cur = { x: 640, y: 470 }; marks = []
  // the page's own screencast at device resolution: Playwright's recordVideo would put a 1280 x 640 picture in the corner of a bigger canvas
  const dir = '/tmp/claude-0/sc_' + name; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const cdp = await ctx.newCDPSession(p)
  const frames = []
  cdp.on('Page.screencastFrame', async (ev) => {
    const file = dir + '/' + String(frames.length).padStart(6, '0') + '.jpg'
    fs.writeFileSync(file, Buffer.from(ev.data, 'base64'))
    frames.push({ ts: ev.metadata.timestamp, file })
    try { await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }) } catch (e) {}
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 960, everyNthFrame: 1 })
  try { await fn(p) } catch (e) { console.log(name, 'ERR', e.message.slice(0, 160)) }
  await cdp.send('Page.stopScreencast').catch(() => {})
  await ctx.close(); await b.close()
  let list = ''
  frames.forEach((f, i) => { const d = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].ts - f.ts) : 0.2; list += "file '" + f.file + "'\nduration " + d.toFixed(4) + '\n' })
  list += "file '" + frames[frames.length - 1].file + "'\n"
  fs.writeFileSync(dir + '/list.txt', list)
  require('child_process').execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${dir}/list.txt -vf "fps=30,scale=1920:960" -c:v libx264 -pix_fmt yuv420p -crf 16 -preset medium -an /home/user/ultraviolet/video/public/v3/${name}.mp4`)
  console.log('done', name, frames.length, 'frames', marks.map(([n, t]) => n + '=' + (t - frames[0].ts).toFixed(1)).join(' '))
}
const want = (n) => !process.argv[2] || process.argv.slice(2).includes(n)
;(async () => {
  if (want('prep')) await prepare()
  if (want('landing')) await clip('landing', { boot: true }, async (p) => {
    mk('boot'); await p.goto(BASE + '/'); await p.waitForTimeout(5200); mk('landing')
    const btn = p.getByText(/HOLD TO TUNE IN/i).first(); const c = await center(btn)
    await glide(p, c.x, c.y, 900); mk('hold'); await p.mouse.down(); await p.waitForTimeout(2800); await p.mouse.up(); await p.waitForTimeout(2600)
  })
  if (want('focus')) await clip('focus', {}, async (p) => {
    await p.goto(BASE + '/focus'); await p.waitForTimeout(1800)
    const sl = await p.locator('[role="slider"]').first().boundingBox()
    const at = (v) => sl.x + 6 + (sl.width - 12) * ((v - 10) / 80)
    await glide(p, at(25), sl.y + 24, 900); mk('sliderStart'); await p.mouse.down(); await p.waitForTimeout(150)
    await glide(p, at(60), sl.y + 24, 1100); await p.waitForTimeout(250); await glide(p, at(45), sl.y + 24, 600); await p.mouse.up(); mk('sliderEnd'); await p.waitForTimeout(500)
    mk('lockMove'); await clickOn(p, p.getByRole('button', { name: /^Lock in/i }), 800); mk('locked')
    await p.waitForTimeout(6500); mk('end')
  })
  if (want('tune')) await clip('tune', {}, async (p) => {
    await p.goto(BASE + '/radio'); await p.waitForTimeout(3500)
    const inp = p.locator('input[placeholder="Search every station"]'); mk('searchMove'); await clickOn(p, inp, 800)
    mk('typeStart'); await p.keyboard.type('jazz', { delay: 160 }); mk('typeEnd'); await p.waitForTimeout(2200)
    await glide(p, 700, 420, 700); await p.waitForTimeout(700)
    for (const tab of ['tv', 'podcasts', 'music']) { mk(tab + 'Move'); await clickOn(p, p.locator(`[data-tab="${tab}"]`), 800); mk(tab + 'Click'); await p.waitForTimeout(2600) }
    mk('end')
  })
  if (want('widgets')) await clip('widgets', {}, async (p) => {
    await p.goto(BASE + '/focus'); await p.waitForTimeout(2000)
    const deck = async () => { const c = await center(p.locator('[data-tour="widgets"] button')); await glide(p, c.x, c.y, 750); await p.waitForTimeout(1300) }
    mk('deckMove'); await deck(); mk('dealt')
    mk('notepadMove'); await clickOn(p, p.getByRole('button', { name: /^Notepad/ }), 650); mk('notepadOpen'); await p.waitForTimeout(900)
    await clickOn(p, p.locator('textarea[aria-label="Notes"]'), 600); await p.waitForTimeout(200)
    mk('typeStart'); await p.keyboard.type('Chapter 4: friction counts', { delay: 70 }); mk('typeEnd'); await p.waitForTimeout(500)
    await deck(); mk('timerMove'); await clickOn(p, p.getByRole('button', { name: /^Timer/ }), 650); mk('timerOpen'); await p.waitForTimeout(900)
    await deck(); mk('calcMove'); await clickOn(p, p.getByRole('button', { name: /^Calculator/ }), 650); mk('calcOpen'); await p.waitForTimeout(1600); mk('end')
  })
  if (want('themes')) await clip('themes', {}, async (p) => {
    await p.goto(BASE + '/settings'); await p.waitForTimeout(1500)
    mk('lookMove'); await clickOn(p, p.getByText('Look', { exact: true }).first(), 700); await p.waitForTimeout(700); mk('look')
    for (const t of ['Paper', 'Phosphor', 'Blueprint', 'Sunset', 'Station']) {
      await clickOn(p, p.getByRole('radio', { name: new RegExp('^' + t, 'i') }).first(), 650); mk(t); await p.waitForTimeout(900)
    }
    mk('end')
  })
  if (want('report')) await clip('report', {}, async (p) => {
    mk('debrief'); await p.goto(BASE + '/debrief'); await p.waitForTimeout(4200)
    mk('arcadeMove'); await clickOn(p, p.locator('[data-tab="arcade"]'), 700); mk('arcade'); await p.waitForTimeout(3000)
    mk('learnMove'); await clickOn(p, p.locator('[data-tab="learn"]'), 700); mk('learn'); await p.waitForTimeout(2400); mk('end')
  })
})()
