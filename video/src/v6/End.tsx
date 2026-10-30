import { interpolate, useCurrentFrame } from 'remotion'
import { Dial } from './Dial'
import { Contours } from './Contours'
import { angle } from './Title'
import { Bars, E, FPS, Fill, Grain, P, Vignette, clamp, shake, sp, spr } from './kit'

const URL_TXT = 'frictionx.vercel.app'
const A2 = 1080, T2 = 0.5
const ang2 = (t: number) => (t <= 0 ? 0 : A2 * (1 - Math.exp(-t / T2)))

/** Thirty-five seconds on: the dial lands again, the address types out like the front page's readout, the line says what it is. */
export const End = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const pop = 1 + 0.35 * (1 - spr(now, 0.45, 0.6))
  const s = shake(now, 0, 8)
  const chars = Math.max(0, Math.min(URL_TXT.length, Math.floor((now - 0.45) * 24)))
  const caret = Math.floor(now * 2.4) % 2 === 0 || chars < URL_TXT.length
  const ph = spr(now - 1.35, 0.55, 0.86)
  const sub = spr(now - 1.8, 0.55, 0.9)
  const out = interpolate(now, [3.0, 3.45], [0, 1], { ...clamp, easing: E.in })
  const rate = (A2 / T2) * Math.exp(-now / T2)
  return (
    <Fill style={{ background: P.ground }}>
      <Fill style={{ transform: `translate(${s.x}px, ${s.y}px)`, opacity: 1 - out }}>
        <Contours t={now + 40} opacity={0.85} cx={960} cy={520} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}><Bars progress={interpolate(now, [0.05, 0.9], [0, 1], { ...clamp, easing: E.out })} height={14} /></div>
        <div style={{ position: 'absolute', left: 960 - 170, top: 150, width: 340, height: 340, transform: `scale(${pop})` }}>
          <Dial size={340} deg={ang2(now) + 17} travel={(rate * 0.5) / FPS} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', fontFamily: 'Unbounded', fontWeight: 800, fontSize: 98, letterSpacing: '-0.025em', color: P.ink, lineHeight: 1 }}>
          {URL_TXT.slice(0, chars)}<span style={{ color: P.signal, opacity: caret ? 1 : 0 }}>▮</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 726, display: 'flex', justifyContent: 'center', opacity: Math.min(1, ph * 1.4), transform: `translateY(${(1 - ph) * 30}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, border: `2px solid ${P.signal}`, padding: '14px 28px 10px', background: 'rgba(5,7,12,0.9)' }}>
            <div style={{ fontFamily: 'Barlow', fontWeight: 700, fontSize: 50, letterSpacing: '0.06em', textTransform: 'uppercase', color: P.signal, lineHeight: 1 }}>Launching on Product Hunt</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 850, textAlign: 'center', fontFamily: 'Hanken', fontWeight: 500, fontSize: 32, color: P.dim, opacity: Math.min(1, sub * 1.4), transform: `translateY(${(1 - sub) * 20}px)` }}>
          Free. No account. Your data stays in your browser.
        </div>
      </Fill>
      <Vignette k={0.5} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
