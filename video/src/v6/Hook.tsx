import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { E, FPS, Fill, Grain, P, Vignette, clamp, shake, spr } from './kit'

export const HOOK_FRAMES = 186
const LINES: { t: string; at: number; c: string }[] = [
  { t: 'Scrolling', at: 0.35, c: P.ink },
  { t: 'has no', at: 0.95, c: P.ink },
  { t: 'friction.', at: 1.55, c: P.signal },
]
const THEN: { t: string; at: number }[] = [
  { t: 'Until something', at: 3.85 },
  { t: 'pushes back.', at: 4.1 },
]
const FIRST_OUT = 3.45
const OUT_AT = 5.5

/** The baked Blender hook: a dial that slides and spins faster and faster with nothing to stop it, then the floor bites. The words land as it speeds up. */
export const Hook = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const idx = Math.min(HOOK_FRAMES, f + 1)
  const s = shake(now, 6.03, 6)
  // a push of a few percent over the whole shot so the picture never sits still
  const z = 1.0 + 0.045 * (now / 6.2)
  return (
    <Fill style={{ background: P.deep }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}><defs><filter id="hooksharp" x="0" y="0" width="100%" height="100%"><feConvolveMatrix order="3" kernelMatrix="0 -0.45 0 -0.45 2.8 -0.45 0 -0.45 0" preserveAlpha="true" /></filter></defs></svg>
      <Fill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${z * 1.012})`, transformOrigin: '52% 58%', filter: 'url(#hooksharp)' }}>
        <Img src={staticFile(`v6/hook/h_${String(idx).padStart(4, '0')}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Fill>
      <Fill>
        <div style={{ position: 'absolute', left: 100, top: 90, display: 'flex', flexDirection: 'column' }}>
          {LINES.map((l, i) => {
            const p = spr(now - l.at, 0.5, 0.86)
            const out = interpolate(now, [FIRST_OUT + i * 0.06, FIRST_OUT + i * 0.06 + 0.28], [0, 1], { ...clamp, easing: E.in })
            return (
              <div key={l.t} style={{ overflow: 'hidden', height: 106, opacity: 1 - out }}>
                <div style={{ transform: `translateY(${(1 - p) * 118 - out * 130}px)`, fontFamily: 'Unbounded', fontWeight: 800, fontSize: 94, lineHeight: '106px', letterSpacing: '-0.03em', textTransform: 'uppercase', color: l.c }}>{l.t}</div>
              </div>
            )
          })}
        </div>
        <div style={{ position: 'absolute', left: 104, top: 96, display: 'flex', flexDirection: 'column' }}>
          {THEN.map((l, i) => {
            const p = spr(now - l.at, 0.5, 0.88)
            const out = interpolate(now, [OUT_AT + i * 0.06, OUT_AT + i * 0.06 + 0.28], [0, 1], { ...clamp, easing: E.in })
            return (
              <div key={l.t} style={{ overflow: 'hidden', height: 84, opacity: 1 - out }}>
                <div style={{ transform: `translateY(${(1 - p) * 92 - out * 100}px)`, fontFamily: 'Hanken', fontWeight: 600, fontSize: 72, lineHeight: '84px', letterSpacing: '-0.03em', color: P.ink }}>{l.t}</div>
              </div>
            )
          })}
        </div>
      </Fill>
      {/* the glass throws one lamp back at the lower left of every frame: a plain white wedge that competes with the dial, so the corner is graded down */}
      <Fill style={{ background: 'radial-gradient(ellipse 36% 32% at 0% 100%, rgba(2,4,10,0.97) 0%, rgba(2,4,10,0.8) 50%, rgba(2,4,10,0) 100%)', pointerEvents: 'none' }} />
      <Vignette k={0.5} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
