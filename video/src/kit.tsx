import { Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import { C, Fill, OUT, clamp } from './ui'

/** the cinema window: 1920 x 960 between two 60 px bars, which carry the on-screen display */
export const WIN = { w: 1920, h: 960, top: 60 }

const EASE = Easing.bezier(0.45, 0, 0.12, 1)

/** a camera move over real footage: [seconds into the scene, zoom, focus x, focus y] in the footage's own pixels (1920 x 960) */
export type Cam = [number, number, number, number][]
export const camAt = (cam: Cam, t: number) => {
  const ts = cam.map((k) => k[0])
  const f = (i: number) => interpolate(t, ts, cam.map((k) => k[i]), { ...clamp, easing: EASE })
  return { s: f(1), x: f(2), y: f(3) }
}

/** real footage of the app, with a camera: it pushes in on the part being talked about */
export const Clip = ({ src, from = 0, cam, rate = 1, style }: { src: string; from?: number; cam: Cam; rate?: number; style?: CSSProperties }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { s, x, y } = camAt(cam, frame / fps)
  return (
    <div style={{ position: 'absolute', left: 0, top: WIN.top, width: WIN.w, height: WIN.h, overflow: 'hidden', background: C.ground, ...style }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: WIN.w, height: WIN.h, transformOrigin: '0 0', transform: `translate(${WIN.w / 2 - x * s}px, ${WIN.h / 2 - y * s}px) scale(${s})` }}>
        <OffthreadVideo src={staticFile(src)} startFrom={Math.round(from * fps)} playbackRate={rate} muted style={{ width: WIN.w, height: WIN.h }} />
      </div>
    </div>
  )
}

export const tc = (frame: number, fps = 30) => {
  const f = frame % fps, s = Math.floor(frame / fps) % 60, m = Math.floor(frame / fps / 60) % 60, h = Math.floor(frame / fps / 3600)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`
}

/** a line of big type that lands on the beat */
export const Line = ({ at, children, size = 150, color = C.ink, weight = 700, font = 'Barlow', track = '-0.01em', style }: { at: number; children: ReactNode; size?: number; color?: string; weight?: number; font?: string; track?: string; style?: CSSProperties }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [at, at + 7], [0, 1], { ...clamp, easing: OUT })
  const k = interpolate(frame, [at, at + 12], [1, 0], { ...clamp, easing: Easing.bezier(0.2, 0.9, 0.1, 1) })
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 0.92, letterSpacing: track, textTransform: 'uppercase', color, opacity: t, translate: `0 ${k * 60}px`, scale: `${1 + k * 0.18}`, transformOrigin: '0 100%', ...style }}>{children}</div>
  )
}

/** a plate that slides in from the left: what to look at */
export const Plate = ({ at, out, kicker, children, sub, style }: { at: number; out?: number; kicker?: string; children: ReactNode; sub?: string; style?: CSSProperties }) => {
  const frame = useCurrentFrame()
  const i = interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: OUT })
  const o = out === undefined ? 0 : interpolate(frame, [out, out + 8], [0, 1], { ...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0) })
  const vis = i * (1 - o)
  if (vis <= 0) return null
  return (
    <div style={{ position: 'absolute', opacity: vis, translate: `${(1 - i) * -120 + o * -80}px 0`, ...style }}>
      <div style={{ display: 'inline-block', background: C.ground, borderLeft: `10px solid ${C.signal}`, padding: '20px 36px 22px 30px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        {kicker && <div style={{ fontFamily: 'Barlow', fontWeight: 700, fontSize: 26, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.signal, marginBottom: 6 }}>{kicker}</div>}
        <div style={{ fontFamily: 'Barlow', fontWeight: 700, fontSize: 84, lineHeight: 0.95, textTransform: 'uppercase', color: C.ink, letterSpacing: '-0.005em' }}>{children}</div>
        {sub && <div style={{ fontFamily: 'Hanken', fontWeight: 400, fontSize: 30, color: C.dim, marginTop: 10, maxWidth: 760, lineHeight: 1.25 }}>{sub}</div>}
      </div>
    </div>
  )
}

/** the on-screen display in the two bars */
export const Hud = ({ ch, name }: { ch: string; name: string }) => {
  const frame = useCurrentFrame()
  const blink = Math.floor(frame / 15) % 2 === 0
  const mono: CSSProperties = { fontFamily: 'GeistMono', fontSize: 22, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dim }
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: WIN.top, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px' }}>
        <div style={{ ...mono, display: 'flex', alignItems: 'center', gap: 18, color: C.ink }}>
          <span style={{ width: 16, height: 16, background: C.signal, opacity: blink ? 1 : 0.25 }} />
          <span style={{ color: C.signal }}>CH {ch}</span><span>{name}</span>
        </div>
        <div style={{ ...mono, color: C.ink }}>{tc(frame + 0)}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: WIN.top, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px' }}>
        <div style={mono}>frictionx.vercel.app</div>
        <div style={mono}>Free · No account · Your data stays in your browser</div>
      </div>
    </>
  )
}

export const White = ({ at, len = 8, color = '#fff', peak = 0.9 }: { at: number; len?: number; color?: string; peak?: number }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [at, at + 1, at + len], [0, peak, 0], clamp)
  return o > 0 ? <Fill style={{ background: color, opacity: o }} /> : null
}
