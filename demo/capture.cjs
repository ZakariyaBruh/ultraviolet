// Captures the real app, one theme at a time, into demo/shots/<theme>/<state>.png (+ states-<theme>.json with the click zones).
//   node capture.cjs station            every state for one theme
//   node capture.cjs station look       only the dial grid (6 x 6, Station only)
// Click zones come from the real DOM (getBoundingClientRect), so they sit exactly on the buttons in the picture.
const { open, APP, W, H, fs } = require('./lib.cjs')
const theme = process.argv[2] || 'station'
const only = process.argv[3] || ''
const OUT = `/tmp/claude-0/demo/cap/${theme}`
fs.mkdirSync(OUT, { recursive: true })

const R4 = (n) => Math.round(n * 10000) / 10000
const states = {}

const TABS = ['focus', 'radio', 'tv', 'podcasts', 'music', 'news', 'learn', 'together', 'leaders', 'books', 'arcade', 'insights', 'debrief', 'settings']
const LIVE = new Set(['radio', 'tv', 'podcasts', 'music', 'news', 'leaders', 'books'])
const TAB_NAME = { focus: 'Focus', radio: 'Radio', tv: 'TV', podcasts: 'Podcasts', music: 'Music', news: 'News', learn: 'Learn', together: 'Together', leaders: 'Leaders', books: 'Books', arcade: 'Arcade', insights: 'Insights', debrief: 'Debrief', settings: 'Settings' }

async function main() {
  const { b, page } = await open(theme)
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 160)))

  const box = async (loc, pad = 0) => {
    try {
      const l = loc.first()
      if (!(await l.count())) return null
      const bx = await l.boundingBox()
      if (!bx || bx.width < 2 || bx.height < 2) return null
      return [R4((bx.x - pad) / W), R4((bx.y - pad) / H), R4((bx.width + pad * 2) / W), R4((bx.height + pad * 2) / H)]
    } catch (e) { return null }
  }
  let hs = []
  const add = async (loc, props, pad = 0) => {
    const r = await box(loc, pad)
    if (!r) { console.log('  missing:', props.label || props.to) ; return }
    hs.push({ r, ...props })
  }
  /** the header, the nav and the player: the same on every screen */
  const chrome = async (here) => {
    await add(page.locator('a[aria-label="Friction, front page"]'), { to: 'landing', label: 'Front page' })
    await add(page.locator('button[aria-label^="Theme"]'), { kind: 'theme', label: 'Theme' })
    await add(page.locator('button[aria-label^="Search"]'), { kind: 'info', label: 'Search', tip: 'Search jumps to any screen, station, lesson or setting. Press ⌘K or Ctrl K in the real app.' })
    await add(page.locator('button[aria-label*="notifications"]'), { kind: 'info', label: 'The bell', tip: 'The bell collects your goals, streaks and messages. Nothing leaves this browser.' })
    await add(page.locator('button[aria-label="Profile"]'), { kind: 'info', label: 'Profile', tip: 'Your name stays on your device. Only a friends list ever sees it.' })
    for (const id of TABS) {
      if (id === here) continue
      if (LIVE.has(id)) await add(page.locator(`a[data-tab="${id}"]`), { kind: 'live', route: id, label: TAB_NAME[id] })
      else await add(page.locator(`a[data-tab="${id}"]`), { to: id, label: TAB_NAME[id] })
    }
    await add(page.locator('[data-movable="shell-player"] button').first(), { kind: 'live', route: 'radio', label: 'Player' })
  }
  const snap = async (id, wait = 0) => {
    if (wait) await page.waitForTimeout(wait)
    await page.screenshot({ path: `${OUT}/${id}.png`, scale: 'device' })
    states[id] = { hot: hs }
    console.log('  ✓', id, hs.length)
    hs = []
  }
  const go = async (route, wait = 1700) => { await page.goto(APP + route); await page.waitForTimeout(wait) }
  const st = (fn, arg) => page.evaluate(async ([src, arg]) => { const m = { store: await import('/src/lib/store.ts'), fx: await import('/src/lib/fx.ts'), ui: await import('/src/lib/ui.ts') }; return (new Function('m', 'arg', `return (async()=>{${src}})()`))(m, arg) }, [fn, arg])
  const store = (code, arg) => st(`const S=m.store.useStore.getState();${code}`, arg)
  const setSettings = (patch) => store('S.setSettings(arg)', patch)
  const clearWidgets = () => st('m.store.useStore.setState((s) => ({ widgets: { ...s.widgets, open: [] } }))')

  const SET_TABS = [['Settings', 'settings'], ['Look', 'settings-look'], ['Data', 'settings-data'], ['Help', 'settings-help']]
  const setTabs = async (here) => { for (const [t, id] of SET_TABS) if (id !== here) await add(page.locator(`[role=tab]:has-text("${t}"), button:has-text("${t}")`).first(), { to: id, label: t }) }
  const lookSpots = async () => {
    const group = (n) => page.locator(`[role=group][aria-label="${n}"] button`)
    for (let i = 0; i < 6; i++) { const rb = await box(group('Retro stops').nth(i)); const ab = await box(group('ASCII stops').nth(i)); if (rb) hs.push({ r: rb, kind: 'dial', dial: 'retro', stop: i, label: 'Retro: ' + ['Future', 'Afterglow', 'Broadcast', 'Arcade', 'Terminal', 'Full retro'][i] }); if (ab) hs.push({ r: ab, kind: 'dial', dial: 'ascii', stop: i, label: 'ASCII: ' + ['Off', 'Drift', 'A few', 'Floor', 'Stars', 'World'][i] }) }
    const rr = await box(page.locator('[role=slider][aria-label^="Retro"]')); const ar = await box(page.locator('[role=slider][aria-label^="ASCII"]'))
    if (rr) hs.push({ r: rr, kind: 'dial', dial: 'retro', ruler: true, label: 'Retro dial' }); if (ar) hs.push({ r: ar, kind: 'dial', dial: 'ascii', ruler: true, label: 'ASCII dial' })
    const radios = page.locator('[role=radio]'); const n = await radios.count()
    for (let i = 0; i < Math.min(n, 5); i++) { const r = await box(radios.nth(i)); if (r) hs.push({ r, kind: 'themepick', theme: ['station', 'paper', 'phosphor', 'blueprint', 'sunset'][i], label: ['Station', 'Paper', 'Phosphor', 'Blueprint', 'Sunset'][i] + ' theme' }) }
  }
  /* ------------------------------------------------------------------ dial grid (Station) */
  const lab = async () => {
    await go('/settings', 1500)
    await page.locator('[role=tab]:has-text("Look"), button:has-text("Look")').first().click(); await page.waitForTimeout(600)
    for (let r = 0; r < 6; r++) for (let a = 0; a < 6; a++) {
      await setSettings({ era: 100 - r * 20, ascii: a * 20 })
      await page.waitForTimeout(1300)
      await setTabs('settings-look'); await lookSpots()
      await chrome('settings')
      await snap(`look-r${r}-a${a}`)
    }
    await setSettings({ era: 80, ascii: 20 })
  }
  if (only === 'look') {
    await lab()
    fs.writeFileSync(`${OUT}/states-look.json`, JSON.stringify(states))
    await b.close(); return
  }

  /* ------------------------------------------------------------------ landing */
  await page.goto(APP + '/'); await page.waitForTimeout(6500)
  await add(page.locator('button:has-text("Hold"), [role=button]:has-text("Hold"), a:has-text("Tune in")'), { to: 'focus', label: 'Hold to tune in' })
  if (!hs.length) { const bx = [0.3, 0.55, 0.4, 0.2]; hs.push({ r: bx, to: 'focus', label: 'Hold to tune in' }); console.log('  landing: fallback rect') }
  await snap('landing')

  /* ------------------------------------------------------------------ focus, before any session */
  const focusSpots = async (here = 'focus') => {
    await add(page.locator('button:has-text("Lock in")'), { to: 'locked', label: 'Lock in', len: 25 })
    await add(page.locator('[role=slider][aria-label*="Session length"], [role=slider]:has-text("Session length")'), { kind: 'ruler', label: 'Session length', from: 10, to_: 90, stops: [10, 25, 50, 90] })
    await add(page.locator('button[aria-label^="Widgets"]'), { to: 'deck', label: 'Widgets' })
    await add(page.locator('button:has-text("Browse radio")'), { kind: 'live', route: 'radio', label: 'Browse radio' })
    await add(page.locator('button:has-text("Browse TV")'), { kind: 'live', route: 'tv', label: 'Browse TV' })
    for (const n of ['Lo-fi', 'Ambient', 'Classical', 'Documentaries', 'Science']) await add(page.locator(`button:has-text("${n}")`), { kind: 'live', route: /Documentaries|Science/.test(n) ? 'tv' : 'radio', label: n })
    await add(page.locator('[data-movable="timer"]'), { kind: 'info', label: 'The clock', tip: 'The clock only runs while this tab is in front and you are here. Leave it, and it waits.', back: true })
  }
  await go('/focus')
  await focusSpots(); await chrome('focus'); await snap('focus')

  // the session-length ruler: 10, 50 and 90 (the demo always runs a 25 minute session)
  for (const m of [10, 50, 90]) {
    await setSettings({ sessionMin: m }); await go('/focus', 1500)
    await focusSpots(); await chrome('focus'); await snap(`focus-${m}`)
  }
  await setSettings({ sessionMin: 25 })

  /* ------------------------------------------------------------------ widgets */
  await go('/focus', 900); await clearWidgets(); await go('/focus', 1400)
  await page.locator('button[aria-label^="Widgets"]').hover(); await page.waitForTimeout(1300)
  const cards = { Notepad: 'w-notes', Calculator: 'w-calc', 'To-do list': 'w-todo', Timer: 'w-timer', Converter: 'w-convert' }
  for (const n of ['Notepad', 'Calculator', 'To-do list', 'Timer', 'Converter', 'Scratch board', 'Browser', 'Ask AI']) {
    const loc = page.locator(`.wcard:has-text("${n}"), button[aria-pressed]:has-text("${n}")`)
    if (cards[n]) await add(loc, { to: cards[n], label: n })
    else await add(loc, { kind: 'live', route: 'focus', label: n, tip: n + ' needs the network, so it lives in the real app.' })
  }
  await add(page.locator('button:has-text("Put all away")'), { to: 'focus', label: 'Put all away' })
  await chrome('focus')
  await snap('deck')
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)

  const windowSpots = async (idx) => {
    await add(page.locator('[data-movable^="widget-"]').nth(idx), { kind: 'info', label: 'A window', tip: 'Every window is real: you can drag it, and it comes to the front when you touch it.', back: false })
    await add(page.locator('[data-movable^="widget-"] button[aria-label*="Close"], [data-movable^="widget-"] button[aria-label*="close"]').nth(idx), { to: 'focus', label: 'Close' })
  }
  const openWidget = async (name) => {
    await go('/focus', 900); await clearWidgets(); await go('/focus', 1200)
    await page.locator('button[aria-label^="Widgets"]').click(); await page.waitForTimeout(700)
    await page.locator(`.wcard:has-text("${name}"), button[aria-pressed]:has-text("${name}")`).first().click(); await page.waitForTimeout(900)
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(500); if (!(await page.locator('.wcard').first().isVisible().catch(() => false))) break; await page.keyboard.press('Escape') }
    await page.waitForTimeout(500)
  }
  // notepad with a short note typed in
  await openWidget('Notepad')
  await page.locator('[data-movable^="widget-"] textarea').first().fill('Ch. 4, what to remember:\n1. Friction is a feature. It makes you stop and choose.\n2. Hold the session. Look away and it counts.\n3. Credits come from real work only.')
  await page.waitForTimeout(500)
  await windowSpots(0); await add(page.locator('button:has-text("Lock in")'), { to: 'locked', label: 'Lock in' }); await chrome('focus'); await snap('w-notes')
  // to-do
  await openWidget('To-do list')
  const todo = page.locator('[data-movable^="widget-"] input[type=text], [data-movable^="widget-"] input:not([type])').first()
  for (const t of ['Read chapter 4', 'Summarise it in five lines', 'Do the practice set']) { await todo.fill(t); await page.keyboard.press('Enter'); await page.waitForTimeout(200) }
  await page.locator('[data-movable^="widget-"] [role=checkbox], [data-movable^="widget-"] input[type=checkbox]').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await windowSpots(0); await add(page.locator('button:has-text("Lock in")'), { to: 'locked', label: 'Lock in' }); await chrome('focus'); await snap('w-todo')
  // calculator 48 x 12
  await openWidget('Calculator')
  for (const k of ['4', '8', '*', '1', '2', 'Enter']) await page.keyboard.press(k)
  await page.waitForTimeout(500)
  await windowSpots(0); await add(page.locator('button:has-text("Lock in")'), { to: 'locked', label: 'Lock in' }); await chrome('focus'); await snap('w-calc')
  // timer
  await openWidget('Timer')
  await page.waitForTimeout(400)
  await windowSpots(0); await add(page.locator('button:has-text("Lock in")'), { to: 'locked', label: 'Lock in' }); await chrome('focus'); await snap('w-timer')
  // converter
  await openWidget('Converter')
  await page.waitForTimeout(400)
  await windowSpots(0); await add(page.locator('button:has-text("Lock in")'), { to: 'locked', label: 'Lock in' }); await chrome('focus'); await snap('w-convert')
  await clearWidgets()

  /* ------------------------------------------------------------------ the data screens, before any session (no credits yet) */
  const arcadeSpots = async () => {
    await add(page.locator('button:has-text("Games")').first(), { to: 'arcade', label: 'Games' })
    await add(page.locator('button:has-text("Shop")').first(), { to: 'shop', label: 'Shop' })
    await add(page.locator('button:has-text("Descent")').first(), { to: 'game-descent', label: 'Descent', cost: 6 })
    const games = { Rally: 'game-rally', Snake: 'game-snake', Invaders: 'game-invaders' }
    for (const n of ['Dodge', 'Rally', 'Breakout', 'Snake', 'Invaders', 'Asteroids', 'Stack', 'Crossing', 'Tunnel', 'Orbit', 'Flip', 'Slash', 'Turret', 'Chomp', 'Lander']) {
      const loc = page.locator(`button:has(span:text-is("${n}")), button:has-text("${n}")`).filter({ hasNotText: 'Descent' })
      await add(loc, games[n] ? { to: games[n], label: n, cost: 4 } : { kind: 'info', label: n, tip: n + ' is one of 16 games. Each round costs 4 credits, earned by real focus. This demo plays three of them.' })
    }
  }
  await go('/arcade'); await arcadeSpots(); await chrome('arcade'); await snap('arcade')
  await page.locator('button:has-text("Shop")').first().click(); await page.waitForTimeout(1100)
  const shopSpots = async (withNext) => {
    await add(page.locator('button:has-text("Games")').first(), { to: 'arcade', label: 'Games' })
    await add(page.locator('button:has-text("Shop")').first(), { to: 'shop', label: 'Shop' })
    if (withNext) { const r = await box(page.locator('button:has(svg.lucide-chevron-right)').last()); if (r) hs.push({ r, to: 'shop-2', label: 'Next page' }) }
  }
  await shopSpots(); await chrome('arcade'); await snap('shop')

  await go('/insights'); 
  const insightTabs = [['Today', 'insights'], ['Patterns', 'insights-patterns'], ['Trends', 'insights-trends'], ['Rings', 'insights-rings'], ['Sessions', 'insights-sessions']]
  const insightSpots = async (here) => { for (const [t, id] of insightTabs) if (id !== here) await add(page.locator(`[role=tab]:has-text("${t}"), button:has-text("${t}")`).first(), { to: id, label: t }) ; await add(page.locator('text=Demo history').first(), { kind: 'info', label: 'Sample data', tip: 'This history is sample data, flagged as such. In the real app the numbers are yours and can be erased in one tap.' }) }
  await insightSpots('insights'); await chrome('insights'); await snap('insights')
  for (const [t, id] of insightTabs.slice(1)) { await page.locator(`[role=tab]:has-text("${t}"), button:has-text("${t}")`).first().click(); await page.waitForTimeout(1300); await insightSpots(id); await chrome('insights'); await snap(id) }

  await go('/debrief'); await chrome('debrief'); await snap('debrief')

  await go('/settings'); await setTabs('settings'); await chrome('settings'); await snap('settings')
  for (const [t, id] of SET_TABS.slice(1)) {
    await page.locator(`[role=tab]:has-text("${t}"), button:has-text("${t}")`).first().click(); await page.waitForTimeout(1300)
    await setTabs(id)
    if (id === 'settings-look') await lookSpots()
    await chrome('settings'); await snap(id)
  }

  await go('/learn')
  for (const t of ['Black hole', 'Stoicism', 'Photosynthesis', 'Roman Empire', 'Cryptography', 'Evolution', 'Game theory', 'Neuroscience', 'Renaissance']) await add(page.locator(`button:has-text("${t}")`).first(), { kind: 'live', route: 'learn', label: t, tip: 'The lesson is written from Wikipedia as you open it, by fixed rules, never by an AI. That needs the network, so it opens in the real app.' })
  await add(page.locator('button:has-text("Surprise me")'), { kind: 'live', route: 'learn', label: 'Surprise me', tip: 'Picks a random topic and builds a lesson from Wikipedia. It needs the network, so it opens in the real app.' })
  await chrome('learn'); await snap('learn')
  await go('/together')
  await add(page.locator('button:has-text("Make a room")'), { kind: 'live', route: 'together', label: 'Make a room', tip: 'Rooms are for up to twelve friends, by a six-character code. They need a server, so they live in the real app.' })
  await chrome('together'); await snap('together')

  /* ------------------------------------------------------------------ a session: lock in, look away, finish */
  await go('/focus', 1500)
  await page.locator('button:has-text("Lock in")').click(); await page.waitForTimeout(2600)
  await add(page.locator('[data-movable="timer"]'), { kind: 'info', label: 'The clock', tip: 'Time counts only while this tab is in front. Leave, and the clock waits for you.', back: true })
  await add(page.locator('text=Slide to end session').first(), { kind: 'info', label: 'End session', tip: 'There is no pause button. To stop early you slide to end, or buy a Break in the Shop with credits you earned.' })
  await chrome('focus'); await snap('locked')
  await store('S.tick(240)')
  await page.waitForTimeout(300)
  await store('S.addLapse(); m.fx.useFx.getState().say({ title: "You wandered off", description: "64s away from your session. The timer waited for you.", variant: "warning" })')
  await page.waitForTimeout(1200)
  await add(page.locator('[data-movable="timer"]'), { kind: 'info', label: 'The clock', tip: 'The drift is counted, not hidden. The clock waited, and your clean streak starts again.', back: true })
  await chrome('focus'); await snap('drift')
  await store('const s=S.session; S.tick(s.goalMin*60 - s.elapsedSec - 1.2)')
  await page.waitForTimeout(4200)
  await add(page.locator('button:has-text("Launch again")'), { to: 'locked', label: 'Launch again' })
  hs.push({ r: [0, 0, 1, 1], to: 'focus@post', label: 'Close the card', ghost: true })
  await snap('done')
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)

  /* ------------------------------------------------------------------ the same screens, now that credits and a session exist */
  await go('/focus', 1600)
  await focusSpots(); await chrome('focus'); await snap('focus@post')
  for (const m of [10, 50, 90]) { await setSettings({ sessionMin: m }); await go('/focus', 1500); await focusSpots(); await chrome('focus'); await snap(`focus-${m}@post`) }
  await setSettings({ sessionMin: 25 })
  await go('/arcade'); await arcadeSpots(); await chrome('arcade'); await snap('arcade@post')
  await page.locator('button:has-text("Shop")').first().click(); await page.waitForTimeout(1100)
  await shopSpots(true); await chrome('arcade'); await snap('shop@post')
  // pages 2 and 3 of the shop
  const nextBtn = page.locator('button:has(svg.lucide-chevron-right)').last()
  for (const [n, id] of [[2, 'shop-2'], [3, 'shop-3']]) {
    if (await nextBtn.count()) { await nextBtn.click().catch(() => {}); await page.waitForTimeout(900) }
    await add(page.locator('button:has-text("Games")').first(), { to: 'arcade', label: 'Games' })
    await add(page.locator('button:has-text("Shop")').first(), { to: 'shop', label: 'Shop' })
    const prev = await box(page.locator('button:has(svg.lucide-chevron-left)').last()); if (prev) hs.push({ r: prev, to: n === 2 ? 'shop' : 'shop-2', label: 'Previous page' })
    if (n === 2) { const nx = await box(nextBtn); if (nx) hs.push({ r: nx, to: 'shop-3', label: 'Next page' }) }
    await chrome('arcade'); await snap(id)
  }
  await go('/insights'); await insightSpots('insights'); await chrome('insights'); await snap('insights@post')
  await go('/debrief'); await chrome('debrief'); await snap('debrief@post')

  /* ------------------------------------------------------------------ three games mid-play */
  const play = async (id, tile, keys, wait = 5200) => {
    await go('/arcade', 1500)
    await page.locator(tile).first().click(); await page.waitForTimeout(900)
    await page.locator('button:has-text("Start")').first().click(); await page.waitForTimeout(wait)
    for (const k of keys) { await page.keyboard.down(k[0]); await page.waitForTimeout(k[1]); await page.keyboard.up(k[0]) }
    await page.waitForTimeout(300)
    await add(page.locator('button:has-text("Games"), button:has-text("Back"), button[aria-label*="Back"]').first(), { to: 'arcade', label: 'Back to the games' })
    await add(page.locator('canvas').last(), { kind: 'info', label: 'The game', tip: 'A real round: keys or the on-screen pad, music that follows the action, and 75 seconds on the clock.', back: false })
    await chrome('arcade'); await snap(id)
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  }
  await play('game-rally', 'button:has-text("Rally")', [['ArrowUp', 260], ['ArrowDown', 200], ['ArrowUp', 160]])
  await play('game-snake', 'button:has-text("Snake")', [], 4300)
  await play('game-invaders', 'button:has-text("Invaders")', [['ArrowLeft', 500], ['ArrowRight', 300], [' ', 400]])
  await play('game-descent', 'button:has-text("Descent")', [['ArrowRight', 400], ['ArrowDown', 300]])

  fs.writeFileSync(`${OUT}/states.json`, JSON.stringify(states))
  await b.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
