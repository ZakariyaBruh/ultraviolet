import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { E, FPS, Fill, Grain, P, clamp, sec } from './kit'
import { Dust, Glow } from './Lens'

export const BLENDER_FRAMES = 222
/** from this frame the shot is the larger (1600 x 900) render */
export const HQ_FROM = 150
export const blenderFrame = (idx: number) => (idx >= HQ_FROM ? `v4/run_hq/f${String(idx).padStart(4, '0')}.png` : `v4/run/f${String(idx).padStart(4, '0')}.png`)
const pad = (n: number) => String(n).padStart(4, '0')

/** one line of the hook: it rises out of a mask, the way a title is cut into a film */
const Line = ({ at, children }: { at: number; children: string }) => {
  const f = useCurrentFrame()
  const t = interpolate(f, [sec(at), sec(at + 0.55)], [0, 1], { ...clamp, easing: E.out })
  return (
    <div style={{ overflow: 'hidden', height: 112, lineHeight: '112px' }}>
      <div style={{ transform: `translateY(${(1 - t) * 118}%)`, opacity: t > 0 ? 1 : 0 }}>{children}</div>
    </div>
  )
}

/** the dial's travel in the Blender scene, in its own units (see blender/knob.py): it accelerates, then the ridges brake it */
const V0 = 7, V1 = 36, T1 = 5.4, T_END = 9.2, SCALE_D = 1.014
export const dialX = (t: number) => {
  if (t <= T1) return V0 * t + 0.5 * ((V1 - V0) / T1) * t * t
  const x1 = V0 * T1 + 0.5 * (V1 - V0) * T1
  const D = T_END - T1, td = Math.min(t - T1, D), p = 2.4
  return x1 + ((V1 * D) / (p + 1)) * (1 - (1 - td / D) ** (p + 1)) * SCALE_D
}
const r = (i: number, n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }

/** thin light that slides across the glass as the dial runs: the lamp reflections, drawn long so the speed can be felt */
const Streaks = ({ t }: { t: number }) => {
  const x = dialX(t)
  const v = (dialX(t + 0.02) - dialX(Math.max(0, t - 0.02))) / 0.04
  const gate = interpolate(t, [4.9, 5.35], [1, 0], clamp) * interpolate(v, [9, 30], [0, 1], clamp)
  if (gate <= 0.01) return null
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => {
        const d = 0.5 + r(i, 1) * 1.1
        const y = 700 + r(i, 2) * 340
        const len = 120 + v * 11 * d * (0.5 + r(i, 3))
        const span = 1920 + 900
        const px = (((r(i, 4) * span - x * 34 * d) % span) + span) % span - 450
        return <div key={i} style={{ position: 'absolute', left: px, top: y, width: len, height: 2 + d * 1.6, opacity: gate * (0.22 + 0.4 * (d / 1.6)), background: 'linear-gradient(90deg, transparent, rgba(150,214,255,0.95) 70%, rgba(220,244,255,1))', mixBlendMode: 'screen' }} />
      })}
    </>
  )
}

/** Cold open: a dial slides across black glass with nothing to stop it. 0 - 9.9 s */
export const Hook = () => {
  const f = useCurrentFrame()
  const idx = Math.min(BLENDER_FRAMES, f + 1)
  // the text leaves with the impact, on the frame the ridges bite
  const out = interpolate(f, [sec(5.3), sec(5.3) + 3], [1, 0], clamp)
  // the whole picture arrives out of black in the first half second
  const open = interpolate(f, [0, sec(0.7)], [0, 1], { ...clamp, easing: E.out })
  // and leaves on the last frame: a short fade, then the cut to the dial from above
  const close = interpolate(f, [sec(9.05), sec(9.45)], [1, 0], { ...clamp, easing: E.inOut })
  // the ridges bite: one short pulse of light and a shove
  const hit = Math.exp(-(((f / 24 - 5.32) / 0.07) ** 2))
  return (
    <Fill style={{ background: P.deep }}>
      <Fill style={{ opacity: open * close }}>
        <Glow bloom={0.2} streak={0.14}>
        <Img src={staticFile(blenderFrame(idx))} style={{ width: 1920, height: 1080, filter: `contrast(1.05) saturate(1.04) brightness(${1 + hit * 0.3})`, transform: `translate(${Math.sin(f * 2.3) * 6 * hit}px, ${Math.cos(f * 1.7) * 5 * hit}px) scale(${1 + hit * 0.012})` }} />
        <Streaks t={f / 24} />
        </Glow>
        <Dust count={26} seed={1} opacity={0.4} area={{ x: 0, y: 160, w: 1920, h: 760 }} />
        <Fill style={{ background: 'radial-gradient(ellipse 85% 80% at 52% 55%, transparent 55%, rgba(2,4,10,0.7) 100%)' }} />
        <Fill style={{ background: 'linear-gradient(35deg, rgba(2,4,10,0.92) 0%, rgba(2,4,10,0.55) 14%, transparent 34%)' }} />
      </Fill>
      <Fill style={{ opacity: out, left: 132, top: 150, right: 'auto', bottom: 'auto', color: P.ink, fontFamily: 'Hanken', fontWeight: 600, fontSize: 96, letterSpacing: '-0.035em' }}>
        <Line at={1.0}>No bottom.</Line>
        <Line at={2.3}>No edge.</Line>
        <Line at={3.6}>No brakes.</Line>
      </Fill>
      <Grain opacity={0.07} />
    </Fill>
  )
}
