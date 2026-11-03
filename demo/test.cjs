// Walks the built demo (demo/dist) in a real browser: data integrity, the guided path, free poking, a phone and a landscape phone.
//   node test.cjs            (serves demo/dist itself on :5188)
const { chromium } = require('playwright')
const http = require('http'), fs = require('fs'), path = require('path')
const DIST = path.join(__dirname, 'dist'), PORT = 5188
const OUT = '/tmp/claude-0/demo/test'; fs.mkdirSync(OUT, { recursive: true })
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.css': 'text/css' }
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + (/html|javascript/.test(MIME[path.extname(f)] || '') ? '; charset=utf-8' : '') }); r.end(b) } }) }).listen(PORT)
let bad = 0
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m) } else console.log('ok  ', m) }

;(async () => {
  // 1. data integrity
  const data = JSON.parse(fs.readFileSync(path.join(DIST, 'data.js'), 'utf8').replace(/^window\.DEMO=/, '').replace(/;$/, ''))
  let missingImg = 0, deadTo = 0, n = 0
  for (const th of data.themes) {
    const S = data.s[th.id]
    for (const [id, hot] of Object.entries(S)) {
      n++
      if (!fs.existsSync(path.join(DIST, 'shots', th.id, id.replace('@', '_') + '.webp'))) { missingImg++; console.log('  no image', th.id, id) }
      for (const h of hot) if (h.to) {
        const t = h.to
        const okT = S[t] || S[t + '@post'] || /^focus$/.test(t) || (t.startsWith('focus-')) || S[t.replace('@post', '')]
        if (!okT) { deadTo++; if (deadTo < 12) console.log('  dead target', th.id, id, '->', t) }
      }
    }
  }
  ok(missingImg === 0, `every state has an image (${n} states, ${data.themes.length} themes)`)
  ok(deadTo === 0, 'every hotspot target exists')
  for (const th of data.themes) {
    const need = ['landing', 'focus', 'locked', 'drift', 'done', 'focus@post', 'deck', 'w-notes', 'arcade@post', 'game-snake', 'insights@post', 'settings', 'settings-look']
    const miss = need.filter((i) => !data.s[th.id][i])
    ok(miss.length === 0, `${th.id}: the guided path states exist ${miss.join(',')}`)
  }

  const b = await chromium.launch()
  const run = async (name, vp, fn) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 900 })
    await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && u.protocol.startsWith('http'), (r) => r.abort())
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text().slice(0, 200)) })
    await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(900)
    await fn(p)
    ok(errs.length === 0, `${name}: no script errors ${errs.join(' | ')}`)
    await ctx.close()
  }
  const st = (p) => p.evaluate(() => window.__demo.st())
  const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` })

  await run('desktop guided path', { width: 1440, height: 810 }, async (p) => {
    let s = await st(p); ok(s.state === 'landing' && s.step === 0, 'starts on the landing at step 0')
    await shot(p, 'd-00-landing')
    const seq = []
    for (let i = 0; i < 16; i++) {
      await p.keyboard.press('n'); await p.waitForTimeout(650)
      s = await st(p); seq.push(`${s.step}:${s.state}`)
      if (i === 0 || i === 2 || i === 4 || i === 6 || i === 9 || i === 12 || i === 13) await shot(p, `d-${String(i + 1).padStart(2, '0')}-${s.state}`)
      if (s.finished) break
    }
    console.log('  path:', seq.join('  '))
    s = await st(p); ok(s.finished, 'the guided path finishes with N alone')
    await shot(p, 'd-99-finale')
    await p.click('text=Keep poking'); await p.waitForTimeout(300)
    s = await st(p); ok(s.freeRoam, 'keep poking leaves free roam')
  })

  await run('desktop free poking', { width: 1440, height: 810 }, async (p) => {
    const box = async (label) => p.evaluate((l) => { const e = [...document.querySelectorAll('.hs')].find((x) => x.getAttribute('aria-label') === l); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }, label)
    await p.keyboard.press('n'); await p.waitForTimeout(500)
    let s = await st(p); ok(s.state === 'focus', 'landing click goes to focus')
    // the ruler: click near the right end → 90
    const rb = await box('Session length'); ok(!!rb, 'ruler hotspot exists')
    await p.mouse.click(rb.x + rb.w * 0.98, rb.y + rb.h / 2); await p.waitForTimeout(400)
    s = await st(p); ok(s.len === 90 && s.state === 'focus-90', `ruler to 90 (${s.state})`)
    await p.mouse.click(rb.x + rb.w * 0.4, rb.y + rb.h / 2); await p.waitForTimeout(400)
    s = await st(p); ok(s.len === 50, `ruler to 50 (${s.len})`)
    // theme button cycles
    const tb = await box('Theme'); await p.mouse.click(tb.x + tb.w / 2, tb.y + tb.h / 2); await p.waitForTimeout(400)
    s = await st(p); ok(s.theme === 'paper', `theme cycles to paper (${s.theme})`)
    await shot(p, 'f-paper')
    await p.keyboard.press('t'); await p.waitForTimeout(300); s = await st(p); ok(s.theme === 'phosphor', 'T cycles the look')
    // nav: an off-line tab shows the tip with a link
    const lb = await box('Radio'); await p.mouse.click(lb.x + lb.w / 2, lb.y + lb.h / 2); await p.waitForTimeout(300)
    ok(await p.locator('.plate.tip a').count() === 1, 'a network screen explains itself and links out')
    await shot(p, 'f-tip')
    // lock in snaps back to 25 with a toast
    const li = await box('Lock in'); await p.mouse.click(li.x + li.w / 2, li.y + li.h / 2); await p.waitForTimeout(500)
    s = await st(p); ok(s.state === 'locked' && s.len === 25, 'lock in from 50 runs the 25 minute session')
    ok(await p.locator('.toast').count() === 1, 'and says so')
    // dials via the ruler in a theme that is not Station switches to Station
    await p.evaluate(() => window.__demo.go('settings-look', 'nav'))
    await p.waitForTimeout(500)
    const rr = await box('Retro dial'); ok(!!rr, 'retro dial exists')
    await p.mouse.click(rr.x + rr.w * 0.05, rr.y + rr.h / 2); await p.waitForTimeout(500)
    s = await st(p); ok(s.theme === 'station' && s.dials.r === 5, `a dial turn moves to Station (${s.theme}, r=${s.dials.r})`)
    await shot(p, 'f-dial-fullretro')
    const ab = await box('ASCII: World'); await p.mouse.click(ab.x + ab.w / 2, ab.y + ab.h / 2); await p.waitForTimeout(500)
    s = await st(p); ok(s.dials.a === 5 && s.state === 'look-r5-a5', `ascii world (${s.state})`)
    // show clickable
    await p.keyboard.press('h'); await p.waitForTimeout(200); await shot(p, 'f-showall')
  })

  await run('phone portrait', { width: 390, height: 844 }, async (p) => {
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
    ok(w[0] <= w[1], `no sideways scroll (${w})`)
    await shot(p, 'm-00')
    for (let i = 0; i < 3; i++) { await p.keyboard.press('n'); await p.waitForTimeout(700) }
    await shot(p, 'm-03')
    const w2 = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
    ok(w2[0] <= w2[1], 'still no sideways scroll')
  })
  await run('phone landscape', { width: 844, height: 390 }, async (p) => {
    await shot(p, 'l-00')
    for (let i = 0; i < 5; i++) { await p.keyboard.press('n'); await p.waitForTimeout(700) }
    await shot(p, 'l-05')
  })
  await run('laptop 1280x720', { width: 1280, height: 720 }, async (p) => { await p.keyboard.press('n'); await p.waitForTimeout(600); await shot(p, 'n-01') })

  await b.close(); srv.close()
  console.log(bad ? `\n${bad} FAILED` : '\nall passed')
  process.exit(bad ? 1 : 0)
})()
