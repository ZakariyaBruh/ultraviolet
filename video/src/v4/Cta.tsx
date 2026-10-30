import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { E, Fill, Grain, P, clamp } from './kit'
import { Wordmark, detents } from './Title'

/** one of the closing lines, cut from the same mask as the hook's */
const Line = ({ at, children }: { at: number; children: string }) => {
  const t = useCurrentFrame() / 24
  const u = interpolate(t, [at, at + 0.55], [0, 1], { ...clamp, easing: E.out })
  return (
    <div style={{ overflow: 'hidden', height: 112, lineHeight: '112px' }}>
      <div style={{ transform: `translateY(${(1 - u) * 118}%)` }}>{children}</div>
    </div>
  )
}

/** 38.4 s to the end. The hook said what the feed lacks; this says what Friction lacks. Then the name, and where to find it. */
export const Cta = () => {
  const t = useCurrentFrame() / 24
  // the stopped dial from the opening shot, dim behind the lines, then gone
  const bg = interpolate(t, [0, 0.6, 3.0, 3.6], [0, 0.42, 0.42, 0], clamp)
  const lines = interpolate(t, [3.0, 3.4], [1, 0], { ...clamp, easing: E.in })
  const p = interpolate(t, [3.5, 4.3], [0, 1], { ...clamp, easing: E.cam })
  const r = interpolate(t, [4.15, 4.95], [0, 1], { ...clamp, easing: E.out })
  const deg = 36 + detents(t, 6.3, 1, 0, 24)
  const url = interpolate(t, [5.0, 5.6], [0, 1], { ...clamp, easing: E.out })
  const line = interpolate(t, [5.2, 6.0], [0, 1], { ...clamp, easing: E.cam })
  const ph = interpolate(t, [5.7, 6.3], [0, 1], { ...clamp, easing: E.out })
  const end = interpolate(t, [6.85, 7.2], [1, 0], { ...clamp, easing: E.in })
  return (
    <Fill style={{ background: P.deep }}>
      {t < 3.7 && <Fill style={{ opacity: bg }}>
        <Img src={staticFile('v4/run/f0222.png')} style={{ width: 1920, height: 1080, transform: `translateX(300px) scale(${1.08 + t * 0.012})` }} />
        <Fill style={{ background: 'radial-gradient(ellipse 80% 80% at 60% 50%, transparent 40%, rgba(2,4,10,0.85) 100%)' }} />
      </Fill>}
      <Fill style={{ opacity: lines, left: 132, top: 250, right: 'auto', bottom: 'auto', color: P.ink, fontFamily: 'Hanken', fontWeight: 600, fontSize: 96, letterSpacing: '-0.035em' }}>
        <Line at={0.3}>No account.</Line>
        <Line at={0.95}>No feed.</Line>
        <Line at={1.6}>No price.</Line>
        <div style={{ marginTop: 28, fontWeight: 400, fontSize: 32, letterSpacing: 0, color: P.dim, opacity: interpolate(t, [2.1, 2.7], [0, 1], clamp) }}>Your data stays in this browser.</div>
      </Fill>
      <Fill style={{ opacity: end * (t > 3.4 ? 1 : 0), transform: `scale(${1 + t * 0.004})` }}>
        <Wordmark size={250} big={420} deg={deg} travel={p} reveal={r} top={540 - 250 * 0.42 - 130} />
        <Fill style={{ top: 625, left: 0, right: 0, bottom: 'auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', position: 'relative', opacity: url, transform: `translateY(${(1 - url) * 14}px)`, fontFamily: 'Hanken', fontWeight: 600, fontSize: 84, letterSpacing: '-0.035em', color: P.ink }}>
            frictionx.vercel.app
            <div style={{ position: 'absolute', left: 0, bottom: -12, height: 5, width: `${line * 100}%`, background: P.signal }} />
          </div>
          <div style={{ marginTop: 58, opacity: ph, fontFamily: 'Barlow', fontWeight: 700, fontSize: 34, letterSpacing: '0.24em', textTransform: 'uppercase', color: P.dim }}>Launching on Product Hunt</div>
        </Fill>
      </Fill>
      <Grain />
    </Fill>
  )
}
