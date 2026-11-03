const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ args: ['--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout', '--disable-threaded-animation', '--disable-checker-imaging'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, storageState: '/tmp/claude-0/state5174.json' })
  const p = await ctx.newPage()
  await p.addInitScript(() => { try { sessionStorage.setItem('friction:booted', '1') } catch (e) {} })
  await p.goto('http://localhost:5174/focus'); await p.waitForTimeout(3000)
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' })
  const adv = async (ms) => { const d = new Promise((r) => cdp.once('Emulation.virtualTimeBudgetExpired', r)); await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: ms }); await Promise.race([d, sleep(5000)]) }
  await adv(200)
  await p.evaluate(async () => { const f = await import('/src/lib/fx.ts'); f.useFx.getState().say({ title: 'You wandered off', description: '8s away', variant: 'warning' }); const u = await import('/src/lib/ui.ts'); u.useUI.getState().set({ celebrate: { title: 'Session complete', detail: 'x' } }) })
  for (const ms of [100, 300, 600, 1200]) {
    await adv(ms)
    console.log(ms, await p.evaluate(() => ({ wandered: document.body.innerText.includes('wandered'), complete: document.body.innerText.includes('Session complete'), vis: document.visibilityState, focus: document.hasFocus() })))
  }
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }); require('fs').writeFileSync('/tmp/claude-0/ref/vt_debug.png', Buffer.from(shot.data, 'base64'))
  console.log(await p.evaluate(() => { const els = [...document.querySelectorAll('*')].filter((e) => /wandered|Session complete/.test(e.textContent || '') && e.children.length === 0).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); let o = 1; for (let n = e; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return { t: e.textContent.slice(0, 24), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), op: o.toFixed(2), vis: cs.visibility } }); return els }))
  await b.close()
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1) })
