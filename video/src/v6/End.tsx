import { Easing, interpolate, useCurrentFrame } from 'remotion'
import { Dial } from './Dial'
import { Contours } from './Contours'
import { Bars, E, FPS, Fill, Grain, P, Vignette, clamp, shake, spr, useLetters } from './kit'

/** the dial's turn in the last card: thrown at 0.55 s, slowed by friction (the score's ratchet follows this exact law) */
export const A2 = 1080, T2 = 0.5, DIAL_AT = 0.55
export const ang2 = (t: number) => (t <= DIAL_AT ? 0 : A2 * (1 - Math.exp(-(t - DIAL_AT) / T2)))
const SIZE = 188
const WORD = 'FRICTION'
export const END_TOTAL = 4.6

/** The two endings that were liked, one above the other: v3's mark (the ring that draws itself, the square that lands) on top, and v4's stack under it
 *  (FRICTION with the dial as its O, the address with its underline, Launching on Product Hunt). Then the picture folds to a line and a dot, as v3's did. */
export const End = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const m = useLetters(WORD, SIZE)
  if (!m) return <Fill style={{ background: P.ground }} />
  const left = (1920 - m.total) / 2
  const oy = 452
  const ox = left + m.x[6] + m.w[6] / 2
  const mo = m.w[6]
  const s = shake(now, 0.45, 7)

  // the mark
  const ring = interpolate(now, [0.0, 0.8], [0, 1], { ...clamp, easing: E.out })
  const sq = spr(now - 0.45, 0.4, 0.5)
  const R = 78, MX = 960, MY = 200, CIRC = 2 * Math.PI * R
  // the line
  const wordIn = (i: number) => spr(now - (0.55 + i * 0.05), 0.6, 0.85)
  const dialIn = spr(now - DIAL_AT, 0.55, 0.72)
  const url = interpolate(now, [1.25, 1.8], [0, 1], { ...clamp, easing: E.out })
  const underline = interpolate(now, [1.5, 2.2], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.15, 1) })
  const line = interpolate(now, [1.95, 2.45], [0, 1], { ...clamp, easing: E.out })
  const ph = interpolate(now, [2.35, 2.9], [0, 1], { ...clamp, easing: E.out })
  const bars = interpolate(now, [0.1, 1.0], [0, 1], { ...clamp, easing: E.out })
  // the picture folds to a line and a dot (v3's sign-off)
  const fold = Easing.bezier(0.7, 0, 0.3, 1)
  const sy = interpolate(now, [3.7, 3.95, 4.15, 4.3], [1, 0.006, 0.006, 0], { ...clamp, easing: fold })
  const sx = interpolate(now, [4.05, 4.3], [1, 0], clamp)
  const lineOp = interpolate(now, [3.7, 3.92, 4.3], [0, 1, 0], clamp)
  const rate = (A2 / T2) * Math.exp(-(now - DIAL_AT) / T2)

  return (
    <Fill style={{ background: '#000' }}>
      <Fill style={{ background: P.ground, transform: `translate(${s.x}px, ${s.y}px) scale(${sx * (1 + 0.016 * now)}, ${sy * (1 + 0.016 * now)})` }}>
        <Contours t={now * 2.5 + 40} opacity={0.8} cx={960} cy={540} />
        {/* v3: the mark */}
        <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
          <circle cx={MX} cy={MY} r={R} fill="none" stroke={P.ink} strokeWidth={15} strokeDasharray={`${ring * CIRC} ${CIRC}`} transform={`rotate(-100 ${MX} ${MY})`} />
          <rect x={MX + 0.89 * R - 25} y={MY - 0.82 * R - 25} width={50} height={50} fill={P.signal} style={{ transformOrigin: `${MX + 0.89 * R}px ${MY - 0.82 * R}px`, scale: `${sq}` }} />
        </svg>
        {/* v4: the stack */}
        <div style={{ position: 'absolute', left, top: oy - SIZE * 0.52, width: m.total, height: SIZE, fontFamily: 'Unbounded', fontSize: SIZE, lineHeight: 1, letterSpacing: '-0.02em', color: P.ink }}>
          {WORD.split('').map((c, i) => i === 6 ? null : (
            <span key={i} style={{ position: 'absolute', left: m.x[i], width: m.w[i], top: 0, textAlign: 'center', whiteSpace: 'nowrap', opacity: Math.min(1, wordIn(i) * 1.6), transform: `translateY(${(1 - wordIn(i)) * 90}px)`, fontWeight: Math.round(200 + 600 * Math.min(1, Math.max(0, wordIn(i)))) }}>{c}</span>
          ))}
        </div>
        <div style={{ position: 'absolute', left: ox - mo / 2, top: oy - mo / 2, width: mo, height: mo, transform: `scale(${2.6 - 1.6 * dialIn})`, opacity: Math.min(1, dialIn * 2) }}>
          <Dial size={mo} deg={ang2(now) + 17 + Math.max(0, now - 2.0) * 14} travel={Math.max(0, (rate * 0.5) / FPS)} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 600, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', position: 'relative', opacity: url, transform: `translateY(${(1 - url) * 16}px)`, fontFamily: 'Hanken', fontWeight: 600, fontSize: 80, letterSpacing: '-0.035em', color: P.ink }}>
            frictionx.vercel.app
            <div style={{ position: 'absolute', left: 0, bottom: -12, height: 6, width: `${underline * 100}%`, background: P.signal }} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 738, display: 'flex', justifyContent: 'center', opacity: ph, transform: `translateY(${(1 - ph) * 14}px)` }}>
          <div style={{ position: 'relative', border: `2px solid ${P.signal}`, padding: '16px 34px 13px', background: 'rgba(5,7,12,0.9)', fontFamily: 'Barlow', fontWeight: 700, fontSize: 36, lineHeight: 1, letterSpacing: '0.24em', textTransform: 'uppercase', color: P.signal }}>
            Launching on Product Hunt
          </div>
        </div>
        <div style={{ position: 'absolute', left: 96, right: 96, bottom: 54, display: 'flex', justifyContent: 'space-between', fontFamily: 'Barlow', fontWeight: 700, fontSize: 24, letterSpacing: '0.22em', textTransform: 'uppercase', color: P.dim, opacity: line }}>
          <span>frictionx.vercel.app</span><span>Free · No account · Your data stays in your browser</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 100 }}><Bars progress={bars} height={18} /></div>
        <Vignette k={0.5} />
      </Fill>
      {lineOp > 0.001 && <Fill style={{ top: 538, height: 4, bottom: 'auto', background: '#fff', boxShadow: '0 0 30px 6px #fff', opacity: lineOp, left: `${(1 - sx) * 50}%`, right: `${(1 - sx) * 50}%` }} />}
      <Grain opacity={0.05} />
    </Fill>
  )
}
