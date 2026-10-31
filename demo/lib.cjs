// Shared set-up for the demo capture scripts: the real app, seeded with the sample history,
// at a 16:9 window, with every request that is not local refused (so fonts and analytics never hang a shot).
const { chromium } = require('playwright')
const fs = require('fs')
const APP = process.env.APP || 'http://localhost:5174'
const W = 1440, H = 810
const SEED = process.env.SEED || '/tmp/claude-0/state5174.json'

function seed(theme, extra) {
  const d = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  const o = d.origins[0]
  const it = o.localStorage.find((i) => i.name === 'anti-scroll:v1')
  const s = JSON.parse(it.value)
  s.state.settings = { ...s.state.settings, theme, ...(extra || {}) }
  it.value = JSON.stringify(s)
  const p = `/tmp/claude-0/demo/seed-${theme}.json`
  fs.writeFileSync(p, JSON.stringify(d))
  return p
}

async function open(theme, extra) {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.3333, storageState: seed(theme, extra) })
  await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && u.protocol.startsWith('http'), (r) => r.abort())
  const page = await ctx.newPage()
  await page.addInitScript(() => { try { sessionStorage.setItem('friction:booted', '1') } catch (e) {} })
  return { b, ctx, page }
}

/** a rect for a selector, as fractions of the window */
async function rect(page, sel, nth = 0) {
  return page.evaluate(([sel, nth, W, H]) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 })
    const e = els[nth]
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { x: r.x / W, y: r.y / H, w: r.width / W, h: r.height / H }
  }, [sel, nth, W, H])
}
module.exports = { chromium, fs, APP, W, H, open, rect }
