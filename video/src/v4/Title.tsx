import { interpolate, useCurrentFrame } from 'remotion'
import { Img, staticFile } from 'remotion'
import { Dial, E, Fill, Grain, P, clamp, sec } from './kit'
import { Dust, Glow } from './Lens'
import { useWordmark } from './Mark'

/** the dial clicks round a few detents, slowing, then settles: the stops are real steps, not a smooth turn */
export const detents = (t: number, start: number, n: number, span: number, deg = 11) => {
  let a = 0
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1 || 1)
    const at = start + span * (1 - Math.pow(1 - k, 1.7))     // clicks come further apart as it slows
    const u = interpolate(t, [at, at + 0.11], [0, 1], { ...clamp, easing: E.out })
    a += deg * u + (u > 0 && u < 1 ? Math.sin(u * Math.PI) * 1.6 : 0)
  }
  return a
}

/** FRICTION, with the dial for its O. Used for the title and again for the close. */
export const Wordmark = ({ size = 200, deg = 0, travel = 1, reveal = 1, big = 560, top: topOverride, dialOpacity = 1, style }: { size?: number; deg?: number; travel?: number; reveal?: number; big?: number; top?: number; dialOpacity?: number; style?: React.CSSProperties }) => {
  const m = useWordmark(size)
  if (!m) return null
  const dial = size * 0.98
  const slot = m.o + size * 0.02
  const total = m.a + slot + m.b
  const l = interpolate(reveal, [0, 1], [90, 0], clamp)
  const top = topOverride ?? 540 - size * 0.42
  // the dial begins alone at the middle of the screen, large, and travels into the O as the letters open around it.
  // It is sized and placed directly (no big scale transform), so the picture is always rasterised at the size it is shown.
  const slotCx = 960 - total / 2 + m.a + slot / 2
  const slotCy = top + size * 0.5 + size * 0.02
  const dSize = interpolate(travel, [0, 1], [big, dial])
  const cx = interpolate(travel, [0, 1], [960, slotCx])
  const cy = interpolate(travel, [0, 1], [540 + (topOverride === undefined ? 0 : topOverride - (540 - size * 0.42)) * 0 + (slotCy - 540) * 0, slotCy])
  return (
    <>
      <div style={{ position: 'absolute', left: 960 - total / 2, top, width: total, height: size, fontFamily: 'Unbounded', fontWeight: 800, fontSize: size, letterSpacing: '-0.02em', color: P.ink, lineHeight: 1, ...style }}>
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: Math.min(1, reveal * 1.6), transform: `translateX(${l * 1.5}px)` }}>FRICTI</div>
        <div style={{ position: 'absolute', left: m.a + slot, top: 0, opacity: Math.min(1, reveal * 1.6), transform: `translateX(${-l * 1.5}px)` }}>N</div>
      </div>
      <div style={{ position: 'absolute', left: cx - dSize / 2, top: cy - dSize / 2, width: dSize, height: dSize, opacity: dialOpacity }}>
        <Dial size={dSize} deg={deg} />
      </div>
    </>
  )
}

/** 9.6 - 14.4 s: the dial from above, then it becomes the O */
export const Title = () => {
  const f = useCurrentFrame()
  const t = f / 24
  const big = 780
  // phase 1 (0 - 1.9 s): the big dial alone, clicking round. phase 2: it shrinks into the O while the letters open out around it
  const p = interpolate(t, [1.9, 2.7], [0, 1], { ...clamp, easing: E.cam })
  const r = interpolate(t, [2.55, 3.35], [0, 1], { ...clamp, easing: E.out })
  const deg = 36 + detents(t, 0.35, 7, 1.15)
  const out = interpolate(t, [4.3, 4.8], [1, 0], { ...clamp, easing: E.in })
  const tag = interpolate(t, [3.2, 3.8], [0, 1], { ...clamp, easing: E.out })
  return (
    <Fill style={{ background: P.deep, opacity: out, transform: `scale(${1 - (1 - out) * 0.06 + t * 0.006})` }}>
      {t < 2.05 && (
        <Fill style={{ opacity: interpolate(t, [1.84, 1.98], [1, 0], clamp) * interpolate(t, [0, 0.5], [0, 1], { ...clamp, easing: E.inOut }) }}>
          <Glow bloom={0.16} streak={0.12}>
            <Img src={staticFile(`v4/macro/m${String(Math.min(46, Math.floor(t * 24) + 1)).padStart(4, '0')}.png`)} style={{ width: 1920, height: 1080 }} />
          </Glow>
        </Fill>
      )}
      <Wordmark size={250} big={big} deg={deg} travel={p} reveal={r} dialOpacity={interpolate(t, [1.78, 1.9], [0, 1], clamp)} />
      <Dust count={22} seed={7} opacity={0.35 * interpolate(t, [2.4, 3.2], [0.4, 1], clamp)} />
      <Fill style={{ top: 540 + 250 * 0.58 + 40, left: 0, right: 0, bottom: 'auto', textAlign: 'center', opacity: tag, transform: `translateY(${(1 - tag) * 16}px)` }}>
        <div style={{ fontFamily: 'Hanken', fontWeight: 500, fontSize: 76, letterSpacing: '-0.035em', color: P.ink }}>Put the friction back.</div>
        <div style={{ fontFamily: 'Hanken', fontWeight: 400, fontSize: 32, color: P.dim, marginTop: 18 }}>A focus timer that counts every time you leave.</div>
      </Fill>
      <Grain />
    </Fill>
  )
}
