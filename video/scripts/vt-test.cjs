const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ args: ['--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout', '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging', '--force-color-profile=srgb'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, storageState: '/tmp/claude-0/state5174.json' })
  const p = await ctx.newPage()
  await p.addInitScript(() => { try { sessionStorage.setItem('friction:booted', '1') } catch (e) {} })
  await p.goto('http://localhost:5174/focus'); await p.waitForTimeout(2500)
  const cdp = await ctx.newCDPSession(p)
  const probe = () => p.evaluate(() => ({ now: Math.round(performance.now()), raf: window.__raf || 0, anim: (document.getAnimations()[0] || {}).currentTime }))
  await p.evaluate(() => { window.__raf = 0; const f = () => { window.__raf++; requestAnimationFrame(f) }; requestAnimationFrame(f) })
  const t0 = Date.now()
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' })
  const out = []
  for (let i = 0; i < 12; i++) {
    const done = new Promise((r) => cdp.once('Emulation.virtualTimeBudgetExpired', r))
    await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: 33.333 })
    await done
    const s = await probe()
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 })
    out.push(`${i}: now=${s.now} raf=${s.raf} anim=${s.anim} png=${shot.data.length}`)
  }
  console.log(out.join('\n')); console.log('wall ms', Date.now() - t0)
  await b.close()
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1) })
