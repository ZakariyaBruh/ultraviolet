import { Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { E, FPS, Fill, Grain, Kicker, P, Ticks, Vignette, clamp, shake, spr } from './kit'

/** The real app, one take, filmed frame by frame (scripts/capture6.cjs) and played back through a virtual camera that is a spring:
 *  it carries its speed from one target to the next, so every move eases out of the last one instead of cutting between fixed crops. */
type Rect = [number, number, number, number]
type Key = { t: number; r: Rect }
const SW = 1280, SH = 720          // the page's own size in css pixels
const OUT = 1.5                    // 1920 / 1280
const ZMAX = 2.0                   // the take has 3 pixels per css pixel, so up to 2x is still one to one

// seconds from the start of this scene (the master clock minus 13.0)
const FULL: Rect = [0, 0, 1280, 720]
const KEYS: Key[] = [
  { t: 0, r: FULL },
  { t: 0.55, r: [320, 280, 640, 360] },          // the slider and Lock in: drag, then press
  { t: 2.45, r: [300, 120, 680, 420] },          // locked: the timer and the solid
  { t: 4.0, r: [300, 0, 680, 360] },
  { t: 4.5, r: [200, 0, 880, 495] },             // the toast, with the timer under it
  { t: 5.7, r: [0, 150, 640, 360] },             // the drift counted on the left
  { t: 6.9, r: [320, 110, 640, 360] },           // the timer running out
  { t: 7.9, r: [320, 180, 640, 360] },           // the card
  { t: 9.2, r: [200, 100, 880, 495] },           // back out (the ASCII world covers the screen from here until 14.4)
  { t: 14.0, r: [160, 90, 960, 540] },           // the looks, ready when the app comes back
  { t: 17.4, r: [640, 360, 640, 360] },          // down to the tab bar
  { t: 18.45, r: [0, 0, 1280, 720] },            // the arcade
  { t: 19.45, r: [0, 0, 640, 360] },             // up to the logo
  { t: 20.35, r: [0, 130, 640, 360] },           // the front page: the status readout types out
  { t: 22.4, r: [520, 90, 760, 428] },
  { t: 23.1, r: [720, 100, 440, 247] },          // into the solid
]
const SCENE_S = 24.0
/** the scene is mounted this many frames before its own time zero (13.0 s), so the doughnut's hole has the app to show */
export const PRE = 14

const toCam = (r: Rect) => {
  const z = Math.max(1, Math.min(ZMAX, Math.min(SW / r[2], SH / r[3])))
  const hw = SW / z / 2, hh = SH / z / 2
  const cx = Math.max(hw, Math.min(SW - hw, r[0] + r[2] / 2)), cy = Math.max(hh, Math.min(SH - hh, r[1] + r[3] / 2))
  return { cx, cy, l: Math.log(z) }
}
type Cam = { cx: number; cy: number; z: number; vx: number; vy: number }
const TABLE: Cam[] = (() => {
  const out: Cam[] = []
  const response = 0.64, zeta = 0.9, w = (2 * Math.PI) / response
  let x = 640, y = 360, l = 0, vx = 0, vy = 0, vl = 0
  const sub = 16, h = 1 / FPS / sub
  for (let f = 0; f <= Math.ceil(SCENE_S * FPS) + 2; f++) {
    const t = f / FPS
    let key = KEYS[0]
    for (const k of KEYS) if (k.t <= t) key = k
    const tg = toCam(key.r)
    const x0 = x, y0 = y
    for (let i = 0; i < sub; i++) {
      for (const [p, v, g] of [['x', 'vx', tg.cx], ['y', 'vy', tg.cy], ['l', 'vl', tg.l]] as const) {
        const cur = p === 'x' ? x : p === 'y' ? y : l
        const vel = v === 'vx' ? vx : v === 'vy' ? vy : vl
        const a = w * w * (g - cur) - 2 * zeta * w * vel
        const nv = vel + a * h
        const nc = cur + nv * h
        if (p === 'x') { x = nc; vx = nv } else if (p === 'y') { y = nc; vy = nv } else { l = nc; vl = nv }
      }
    }
    out.push({ cx: x, cy: y, z: Math.exp(l), vx: (x - x0) * FPS, vy: (y - y0) * FPS })
  }
  return out
})()

const CAPTIONS: { t0: number; t1: number; kicker: string; text: string; top?: boolean }[] = [
  { t0: 1.0, t1: 3.1, kicker: 'The session', text: 'Set a length. Lock in.' },
  { t0: 4.6, t1: 6.7, kicker: 'A drift', text: 'Leave the tab. It counts.' },
  { t0: 8.3, t1: 10.4, kicker: 'The reward', text: 'Finish. Earn credits.' },
  { t0: 15.0, t1: 17.4, kicker: 'Five themes', text: 'Same screen, five looks.' },
  { t0: 18.0, t1: 19.8, kicker: 'The Arcade', text: 'Spend them on games.', top: true },
  { t0: 20.5, t1: 23.0, kicker: 'The front page', text: 'No feed. No account.' },
]
/** a floating plate as the app draws them: flat, ruled, registration ticks at the corners, the kicker in the station's label voice over a plain title */
const Caption = ({ now, t0, t1, kicker, text, top }: { now: number; t0: number; t1: number; kicker: string; text: string; top?: boolean }) => {
  if (now < t0 - 0.05 || now > t1 + 0.4) return null
  const p = spr(now - t0, 0.5, 0.88)
  const out = interpolate(now, [t1, t1 + 0.25], [0, 1], { ...clamp, easing: E.in })
  return (
    <div style={{ position: 'absolute', left: 104, ...(top ? { top: 104 } : { bottom: 104 }), transform: `translateY(${(1 - p) * (top ? -26 : 26) + out * (top ? -18 : 18)}px)`, opacity: Math.min(1, p * 1.5) * (1 - out) }}>
      <div style={{ position: 'relative', background: 'rgba(5,7,12,0.94)', border: `1px solid ${P.rule}`, padding: '24px 40px 26px 34px' }}>
        <Ticks />
        <Kicker size={25} style={{ marginBottom: 14 }}>{kicker}</Kicker>
        <div style={{ fontFamily: 'Hanken', fontWeight: 700, fontSize: 56, lineHeight: 1.04, letterSpacing: '-0.03em', color: P.ink, whiteSpace: 'nowrap' }}>{text}</div>
      </div>
    </div>
  )
}

export const AppScene = () => {
  const raw = useCurrentFrame()
  const f = raw - PRE
  const now = f / FPS
  const c = TABLE[Math.max(0, Math.min(TABLE.length - 1, f))]
  // motion blur from the camera's own speed: a box blur along its path, one shutter long (180 degrees)
  const bx = Math.abs(c.vx) * c.z * OUT * 0.5 / FPS * 0.2, by = Math.abs(c.vy) * c.z * OUT * 0.5 / FPS * 0.2
  const blurOn = bx > 0.35 || by > 0.35
  // a breath in the frame so no shot is ever a still: a hundredth of zoom and a few pixels
  const bz = 1 + 0.006 * Math.sin(now * 0.8), bxp = Math.sin(now * 0.55) * 3, byp = Math.cos(now * 0.43) * 2
  const plunge = interpolate(now, [23.2, 24.0], [0, 1], { ...clamp, easing: E.in })
  const sc = OUT * c.z * bz * (1 + 5 * plunge)
  const s = shake(now, 8.0, 6)
  // arrival: the screen opens out of the middle of the dial, with rings leaving it
  const arrive = 0.74 + 0.26 * spr(raw / FPS, 0.6, 0.84)
  return (
    <Fill style={{ background: P.deep }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}><defs><filter id="camblur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} /></filter></defs></svg>
      <Fill>
        <Fill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${raw / FPS < 1.4 ? arrive : 1})`, transformOrigin: '960px 540px' }}>
          <Fill style={{ filter: `${blurOn ? 'url(#camblur) ' : ''}contrast(1.07) saturate(1.1)` }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: SH, transformOrigin: '0 0', transform: `translate(${960 + bxp}px, ${540 + byp}px) scale(${sc}) translate(${-c.cx}px, ${-c.cy}px)` }}>
              <Sequence from={0} durationInFrames={PRE} layout="none">
                <Freeze frame={0}><OffthreadVideo src={staticFile('v6/take.mp4')} startFrom={4} muted style={{ width: SW, height: SH }} /></Freeze>
              </Sequence>
              <Sequence from={PRE} durationInFrames={4 * FPS} layout="none">
                <OffthreadVideo src={staticFile('v6/take.mp4')} startFrom={4} muted style={{ width: SW, height: SH }} />
              </Sequence>
              <Sequence from={PRE + 4 * FPS} durationInFrames={3 * FPS} layout="none">
                <OffthreadVideo src={staticFile('v6/take.mp4')} startFrom={149} muted style={{ width: SW, height: SH }} />
              </Sequence>
              <Sequence from={PRE + 7 * FPS} durationInFrames={Math.round(2.4 * FPS)} layout="none">
                <OffthreadVideo src={staticFile('v6/take.mp4')} startFrom={262} muted style={{ width: SW, height: SH }} />
              </Sequence>
              <Sequence from={PRE + Math.round(14.4 * FPS)} durationInFrames={Math.round(11.6 * FPS) + 4} layout="none">
                <OffthreadVideo src={staticFile('v6/take.mp4')} startFrom={364} muted style={{ width: SW, height: SH }} />
              </Sequence>
            </div>
          </Fill>
        </Fill>
      </Fill>
      {now >= 0 && now < 0.2 && <Fill style={{ background: '#fff', opacity: 0.16 * (1 - now / 0.2), pointerEvents: 'none' }} />}
      {CAPTIONS.map((cp) => <Caption key={cp.text} now={now} {...cp} />)}
      <Fill style={{ background: 'rgb(4,9,22)', mixBlendMode: 'lighten', pointerEvents: 'none' }} />
      <Grain opacity={0.03} />
    </Fill>
  )
}
