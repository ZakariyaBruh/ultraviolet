// Frame-stepped capture of the real app. Chromium's virtual time is advanced exactly one frame at a time, so every timer, rAF and CSS animation in the app
// moves by 1/30 s between screenshots: the footage is smooth, whatever the machine's speed. The pointer is a spring that keeps its velocity when retargeted.
//   node capture6.cjs take | landing
const { chromium } = require('playwright')
const fs = require('fs')
const BASE = 'http://localhost:5174'
const FPS = 30, W = 1280, H = 720
const STATE = '/tmp/claude-0/state5174.json'
const which = process.argv[2] || 'take'
const OUT = `/tmp/claude-0/cap6/${which}`
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })

const CURSOR = `(() => {
  const mk = () => {
    const c = document.createElement('div'); c.id = 'fx-cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px);transform-origin:5px 3px'
    c.innerHTML = '<svg width="44" height="44" viewBox="0 0 34 34"><path d="M4 2 L4 26 L10 20 L15 31 L19 29 L14 18 L23 18 Z" fill="#fff" stroke="#05070c" stroke-width="2" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(c)
    const r = document.createElement('div'); r.id = 'fx-ripple'
    r.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;background:#ffd23f;border-radius:50%;pointer-events:none;z-index:2147483646;opacity:0'
    document.documentElement.appendChild(r)
    window.__fx = (x, y, s, rx, ry, rs, ro) => {
      c.style.transform = 'translate(' + (x - 5) + 'px,' + (y - 3) + 'px) scale(' + s + ')'
      r.style.transform = 'translate(' + rx + 'px,' + ry + 'px) scale(' + rs + ')'; r.style.opacity = ro
    }
  }
  if (document.documentElement) mk(); else addEventListener('DOMContentLoaded', mk)
})()`

const SYNC = `(() => {
  // the app's animation library uses the browser's compositor animations when it can; those do not follow stepped time. Without the method it runs the same springs on the page clock, which we step.
  try { delete Element.prototype.animate } catch (e) {}
  // Playwright waits for document.fonts.ready before a screenshot; with the clock paused a late font never settles it, so the wait is answered at once
  try { Object.defineProperty(document.fonts, 'ready', { get: () => Promise.resolve(document.fonts), configurable: true }) } catch (e) {}
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()))
  window.__sync = () => {
    const now = performance.now()
    for (const a of document.getAnimations()) {
      if (a.__t0 === undefined) a.__t0 = now - (Number(a.currentTime) || 0)
      try { if (a.playState === 'running') a.pause(); a.currentTime = now - a.__t0 } catch (e) {}
    }
  }
})()`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const FLAGS = process.env.NOFLAGS ? [] : ['--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout', '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging', '--force-color-profile=srgb']
  const b = await chromium.launch({ args: FLAGS })
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DSF || 3), storageState: STATE })
  // anything that is not the local app (fonts, analytics) is refused at once: a request that never answers keeps document.fonts from settling and Playwright waits on that before a screenshot
  await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && u.protocol.startsWith('http'), (r) => r.abort())
  const p = await ctx.newPage()
  if (!process.env.NOCUR) await p.addInitScript(CURSOR); if (!process.env.NOSYNC) await p.addInitScript(SYNC)
  await p.addInitScript(() => { try { sessionStorage.setItem('friction:booted', '1') } catch (e) {} })
  await p.goto(BASE + (which === 'landing' ? '/' : '/focus')); await p.waitForTimeout(3000)
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' })

  let frame = 0
  const advance = async (ms) => {
    const done = new Promise((r) => cdp.once('Emulation.virtualTimeBudgetExpired', r))
    await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: ms })
    await Promise.race([done, sleep(6000)])
  }
  // the pointer: a spring (response 0.22 s, damping ratio 0.82) that carries its velocity from one target to the next
  const cur = { x: 1180, y: 640, vx: 0, vy: 0, tx: 1180, ty: 640, s: 1, vs: 0, ts: 1 }
  const ripple = { x: 0, y: 0, t0: -9 }
  const w = (2 * Math.PI) / 0.22, z = 0.82
  const stepCursor = (dt) => {
    const n = 8, h = dt / n
    for (let i = 0; i < n; i++) {
      for (const [k, v, t] of [['x', 'vx', 'tx'], ['y', 'vy', 'ty']]) { const a = w * w * (cur[t] - cur[k]) - 2 * z * w * cur[v]; cur[v] += a * h; cur[k] += cur[v] * h }
      const a = (w * 1.6) ** 2 * (cur.ts - cur.s) - 2 * 0.7 * (w * 1.6) * cur.vs; cur.vs += a * h; cur.s += cur.vs * h
    }
  }
  const paint = async () => {
    const age = (frame - ripple.t0) / FPS
    // a small filled pulse under the pointer tip (not a ring): it says 'pressed' and is gone in a quarter of a second
    const ro = age >= 0 && age < 0.25 ? 0.5 * (1 - age / 0.25) ** 1.3 : 0
    const rs = 0.3 + 0.9 * (1 - Math.exp(-age * 16))
    await p.evaluate(([x, y, s, rx, ry, rs, ro]) => window.__fx && window.__fx(x, y, s, rx, ry, rs, ro), [cur.x, cur.y, cur.s, ripple.x, ripple.y, rs, ro])
  }
  const shoot = async () => {
    // device pixels (3840 x 2160 for the 1280 x 720 page), so a camera zoom of 2x is still one-to-one
    const buf = await p.screenshot({ type: 'jpeg', quality: 92, scale: 'device', animations: 'allow', caret: 'initial' })
    fs.writeFileSync(`${OUT}/f${String(frame).padStart(5, '0')}.jpg`, buf)
    frame++
  }
  const wait = async (sec) => { const n = Math.round(sec * FPS); for (let i = 0; i < n; i++) { stepCursor(1 / FPS); await paint(); await advance(1000 / FPS); await p.evaluate(() => window.__sync && window.__sync()); await shoot() } }
  const moveTo = async (x, y) => { cur.tx = x; cur.ty = y }
  const mouse = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra })
  const down = async () => { cur.ts = 0.86; ripple.x = cur.x; ripple.y = cur.y; ripple.t0 = frame; await mouse('mousePressed', cur.x, cur.y) }
  const up = async () => { cur.ts = 1; await mouse('mouseReleased', cur.x, cur.y) }
  // keep the page's own hover and drag in step with the drawn pointer
  const follow = async (sec) => { const n = Math.round(sec * FPS); for (let i = 0; i < n; i++) { stepCursor(1 / FPS); await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cur.x, y: cur.y, button: cur.ts < 1 ? 'left' : 'none', buttons: cur.ts < 1 ? 1 : 0 }); await paint(); await advance(1000 / FPS); await p.evaluate(() => window.__sync && window.__sync()); await shoot() } }
  const box = async (sel) => { const bb = await p.locator(sel).first().boundingBox(); return { ...bb, x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 } }
  const KEYS = { Escape: { code: 'Escape', vk: 27 }, t: { code: 'KeyT', vk: 84, text: 't' } }
  const key = async (k) => { const d = KEYS[k]; await cdp.send('Input.dispatchKeyEvent', { type: d.text ? 'keyDown' : 'rawKeyDown', key: k, code: d.code, windowsVirtualKeyCode: d.vk, ...(d.text ? { text: d.text } : {}) }); await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: d.code, windowsVirtualKeyCode: d.vk }) }
  const hide = (on) => p.evaluate((on) => { Object.defineProperty(document, 'visibilityState', { get: () => (on ? 'hidden' : 'visible'), configurable: true }); Object.defineProperty(document, 'hidden', { get: () => on, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }, on)
  const marks = {}
  const mk = (n) => { marks[n] = +(frame / FPS).toFixed(2) }

  await advance(300)
  if (which === 'landing') {
    mk('start'); await follow(7.5); mk('end')
  } else {
    mk('start'); await follow(0.5)
    const sl = await p.locator('[role="slider"]').first().boundingBox()
    const at = (v) => sl.x + 6 + (sl.width - 12) * ((v - 10) / 80)
    const sy = sl.y + sl.height / 2 + 6
    moveTo(at(25), sy); await follow(0.45); mk('slider')
    await down(); await follow(0.12)
    moveTo(at(62), sy); await follow(0.40)
    moveTo(at(25), sy); await follow(0.42)
    await up(); await follow(0.2); mk('sliderEnd')
    const lock = await box('button:has-text("Lock in")')
    moveTo(lock.x, lock.y); await follow(0.5)
    console.log('lock box', JSON.stringify({ x: lock.x, y: lock.y, w: lock.width, h: lock.height }), 'cursor', Math.round(cur.x), Math.round(cur.y), 'text', await p.locator('button:has-text("Lock in")').first().innerText())
    if (!process.env.NOLOCK) { await down(); await follow(0.10); await up() } mk('locked'); await follow(0.4)
    console.log('session after click:', await p.evaluate(async () => { const m = await import('/src/lib/store.ts'); const s = m.useStore.getState().session; return s ? { goal: s.goalMin, el: s.elapsedSec } : null }))
    if (process.env.DEBUG) {
      await p.evaluate(async () => { const f = await import('/src/lib/fx.ts'); f.useFx.getState().say({ title: 'You wandered off', description: '8s away', variant: 'warning' }) })
      await follow(0.2)
      const dbg = []
      for (let i = 0; i < 12; i++) { await follow(0.05); dbg.push(await p.evaluate(() => { const el = [...document.querySelectorAll('div')].find((e) => /pointer-events-auto relative o/.test(e.className.toString()) && /wandered/.test(e.textContent || '')); if (!el) return 'none'; const cs = getComputedStyle(el); return cs.opacity + '|' + (el.style.opacity || '-') + '|' + el.getAnimations().length + '|' + Math.round(performance.now()) + '|' + (el.getAttribute('style') || '').slice(0, 60) })) }
      console.log(dbg.join('\n'))
      console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => /wandered/.test(e.textContent || '') && e.children.length === 0).map((e) => { const r = e.getBoundingClientRect(); const chain = []; for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.opacity !== '1' || cs.visibility !== 'visible' || cs.display === 'none' || cs.transform !== 'none') chain.push(n.tagName + ':' + (n.className || '').toString().slice(0, 30) + ' op=' + cs.opacity + ' vis=' + cs.visibility + ' disp=' + cs.display + ' tf=' + cs.transform.slice(0, 40)) } return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), chain } }))))
      await b.close(); process.exit(0)
    }
    await follow(2.5)
    // coming back after eight seconds away: the same two calls the app makes when it notices (a drift on the counter and the toast)
    moveTo(cur.x + 60, cur.y + 90); await follow(0.3)
    mk('driftOut'); await p.evaluate(async () => { const m = await import('/src/lib/store.ts'); const f = await import('/src/lib/fx.ts'); m.useStore.getState().addLapse(); f.useFx.getState().say({ title: 'You wandered off', description: '8s away from your session. The timer waited for you.', variant: 'warning' }) }); mk('driftBack'); await follow(2.4)
    await p.evaluate(async () => { const m = await import('/src/lib/store.ts'); const s = m.useStore.getState().session; if (s) m.useStore.getState().tick(s.goalMin * 60 - s.elapsedSec - 1.4) })
    mk('ff'); await follow(3.4); mk('card')
    await key('Escape'); await follow(0.7)
    moveTo(640, 360); await follow(0.3)
    mk('looks'); for (let i = 0; i < 5; i++) { await key('t'); await follow(0.5) }
    mk('looksEnd')
    const ar = await box('[data-tab="arcade"]'); moveTo(ar.x, ar.y); await follow(0.5); mk('arcade'); await down(); await follow(0.08); await up(); await follow(1.42)
    // the front page, reached the way a person reaches it: the logo. Its station ident types out from nothing.
    const lg = await box('a[aria-label="Friction, front page"]'); moveTo(lg.x, lg.y); await follow(0.5); mk('logo'); await down(); await follow(0.08); await up(); mk('landing')
    moveTo(1180, 690); await follow(2.2)
    const hb = await box('button:has-text("HOLD TO TUNE IN"), a:has-text("HOLD TO TUNE IN"), [role="button"]:has-text("HOLD TO TUNE IN")').catch(() => null)
    if (hb) { moveTo(hb.x, hb.y); await follow(0.9) } else await follow(0.9)
    await follow(3.2)
    mk('end')
  }
  fs.writeFileSync(`${OUT}/marks.json`, JSON.stringify({ fps: FPS, frames: frame, marks }))
  console.log(which, 'frames', frame, JSON.stringify(marks))
  await b.close()
  require('child_process').execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${OUT}/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 12 -preset medium -g 30 /home/user/ultraviolet/video/public/v6/${which}.mp4`)
})().catch((e) => { console.log('ERR', e.message.slice(0, 400)); process.exit(1) })
