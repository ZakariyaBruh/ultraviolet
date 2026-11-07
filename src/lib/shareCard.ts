/**
 * The week as a picture, drawn on a canvas in this browser with the live theme colours: a 1080 x 1350 card to keep or share.
 * It carries only what the Week screen already shows. Nothing is uploaded.
 */
export interface CardDay { letter: string; min: number; before: number; today: boolean; future: boolean }
export interface CardData {
  range: string
  title: string
  held: string
  /** for example "up 22% on last week", or '' when there is nothing to compare with */
  delta: string
  days: CardDay[]
  stats: [string, string][]
  goalLine: string
  goalPct: number
}

const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']
const W = 1080
const H = 1350
const PAD = 72

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

async function fonts() {
  try {
    await Promise.all(['700 96px "Unbounded Variable"', '700 40px "Barlow Condensed"', '400 30px "Hanken Grotesk Variable"', '600 30px "Hanken Grotesk Variable"'].map((f) => document.fonts.load(f)))
    await document.fonts.ready
  } catch { /* the system fonts will do */ }
}

export async function drawWeekCard(d: CardData): Promise<HTMLCanvasElement> {
  await fonts()
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const ground = css('--ground', '#05070c')
  const ink = css('--ink', '#f3f1ea')
  const ink2 = css('--ink-2', '#c3c2bb')
  const ink3 = css('--ink-3', '#9d9d97')
  const signal = css('--signal', '#ffd23f')
  const ice = css('--ice', '#7fd3ff')
  const rule = css('--rule', 'rgba(243,241,234,0.16)')
  const cond = '"Barlow Condensed", "Arial Narrow", sans-serif'
  const dot = '"Unbounded Variable", "Hanken Grotesk Variable", sans-serif'
  const body = '"Hanken Grotesk Variable", system-ui, sans-serif'
  const text = (t: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'left', track = 0) => {
    g.font = font
    g.fillStyle = fill
    g.textAlign = align
    g.textBaseline = 'alphabetic'
    if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = `${track}px`
    g.fillText(t, x, y)
    if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = '0px'
  }

  g.fillStyle = ground
  g.fillRect(0, 0, W, H)
  // the test-card bars
  const bw = W / BARS.length
  BARS.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * bw, 0, bw + 1, 18) })

  // header
  text('FRICTION', PAD, 112, `700 46px ${cond}`, ink, 'left', 6)
  text(d.range.toUpperCase(), W - PAD, 112, `600 38px ${cond}`, ink3, 'right', 4)
  g.fillStyle = rule
  g.fillRect(PAD, 140, W - PAD * 2, 2)

  // the headline figure
  text(d.title.toUpperCase(), PAD, 218, `700 40px ${cond}`, signal, 'left', 6)
  text(d.held, PAD, 372, `700 150px ${dot}`, ink)
  if (d.delta) text(d.delta, PAD, 432, `600 38px ${body}`, ice)

  // the seven days: this week as bars, last week as a tick
  const top = 520
  const base = 900
  const colW = (W - PAD * 2) / 7
  const max = Math.max(30, ...d.days.map((x) => Math.max(x.min, x.before)))
  d.days.forEach((x, i) => {
    const cx = PAD + colW * i + colW / 2
    const bwid = colW * 0.56
    const h = Math.max(x.min > 0 ? 6 : 0, (x.min / max) * (base - top))
    g.fillStyle = x.future ? rule : signal
    if (x.min > 0 || x.future) g.fillRect(cx - bwid / 2, x.future ? base - 6 : base - h, bwid, x.future ? 6 : h)
    if (x.before > 0 && !x.future) {
      g.fillStyle = ice
      const ty = base - (x.before / max) * (base - top)
      g.fillRect(cx - bwid / 2 - 8, ty - 2, bwid + 16, 4)
    }
    text(x.letter, cx, base + 52, `700 36px ${cond}`, x.today ? signal : ink2, 'center', 2)
    if (x.today) { g.fillStyle = signal; g.fillRect(cx - 14, base + 64, 28, 4) }
  })
  g.fillStyle = rule
  g.fillRect(PAD, base + 1, W - PAD * 2, 2)
  g.fillStyle = ice
  g.fillRect(PAD, base + 108, 28, 4)
  text('the same day last week', PAD + 44, base + 118, `400 28px ${body}`, ink3)

  // the numbers underneath
  const sy = 1090
  const sw = (W - PAD * 2) / d.stats.length
  d.stats.forEach(([k, v], i) => {
    const x = PAD + sw * i
    text(v, x, sy + 44, `700 52px ${dot}`, ink)
    text(k.toUpperCase(), x, sy + 92, `600 28px ${cond}`, ink3, 'left', 3)
  })

  // the weekly goal
  if (d.goalLine) {
    const gy = 1232
    g.fillStyle = rule
    g.fillRect(PAD, gy, W - PAD * 2, 12)
    g.fillStyle = signal
    g.fillRect(PAD, gy, (W - PAD * 2) * Math.min(1, Math.max(0, d.goalPct)), 12)
    text(d.goalLine, PAD, gy + 56, `600 30px ${body}`, ink2)
  }
  text('frictionx.app', W - PAD, H - 44, `600 32px ${cond}`, ink3, 'right', 4)
  return c
}

/** save the card: the share sheet where the browser has one for files, a download otherwise */
export async function saveCard(c: HTMLCanvasElement, name: string): Promise<'shared' | 'saved'> {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('The picture could not be made.')
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My week on Friction' }); return 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return 'shared' }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'saved'
}
