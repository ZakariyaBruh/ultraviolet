import { Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import { BARS, E, FPS, Fill, Grain, Kicker, P, Ticks, clamp, shake, spr } from './kit'
import { Body, Screen } from './Device'
import { Contours } from './Contours'

/**
 * The real app, filmed frame by frame (scripts/capture6.cjs), staged as a run of different shots instead of one screen with a caption:
 *   0.0  type beside a tablet turned toward it          (set a length, lock in)
 *   3.6  the tablet steps aside for two magnified insets  (the toast and the drift count)
 *   6.9  the tablet front on, a word standing behind it, a stamp on the corner (finish, credits)
 *   8.3  the tablet lies down flat and the camera skims over its glass until the frame is only that: black, and the next scene rises on it
 *  14.8  the same screen cut into five strips, one look each
 *  17.4  the strips turn on their edges; behind them a tablet at an angle and a number                 (the Arcade)
 *  20.1  half footage, half a field of yellow with the words on it, which takes the frame and becomes the yellow dial of the next shot
 * The tablet is one prop carried from shot to shot on springs, so the changes of layout are moves, not cuts.
 * Times are seconds from this scene's zero (the master clock minus 13.0).
 */
const SW = 1280, SH = 720
const TAKE = staticFile('v6/take.mp4')
/** the scene is mounted this many frames before its own time zero (13.0 s), so the doughnut's hole has the app to show */
export const PRE = 14

/** the take, cut to the scene's clock: a 1280 x 720 box */
const Take = () => (
  <>
    <Sequence from={0} durationInFrames={PRE} layout="none">
      <Freeze frame={0}><OffthreadVideo src={TAKE} startFrom={4} muted style={{ width: SW, height: SH }} /></Freeze>
    </Sequence>
    <Sequence from={PRE} durationInFrames={4 * FPS} layout="none">
      <OffthreadVideo src={TAKE} startFrom={4} muted style={{ width: SW, height: SH }} />
    </Sequence>
    <Sequence from={PRE + 4 * FPS} durationInFrames={3 * FPS} layout="none">
      <OffthreadVideo src={TAKE} startFrom={149} muted style={{ width: SW, height: SH }} />
    </Sequence>
    <Sequence from={PRE + 7 * FPS} durationInFrames={Math.round(2.4 * FPS)} layout="none">
      <OffthreadVideo src={TAKE} startFrom={262} muted style={{ width: SW, height: SH }} />
    </Sequence>
    <Sequence from={PRE + Math.round(14.4 * FPS)} durationInFrames={Math.round(11.6 * FPS) + 4} layout="none">
      <OffthreadVideo src={TAKE} startFrom={364} muted style={{ width: SW, height: SH }} />
    </Sequence>
  </>
)
/** one still of the take */
const Still = ({ frame, style }: { frame: number; style?: CSSProperties }) => (
  <Freeze frame={0}><OffthreadVideo src={TAKE} startFrom={frame} muted style={{ width: SW, height: SH, ...style }} /></Freeze>
)

/* ---------- the tablet as a prop: where it stands in each shot, joined by one spring ---------- */
type Pose = { x: number; y: number; s: number; rx: number; ry: number; rz: number }
const POSES: (Pose & { t: number })[] = [
  { t: -9, x: 960, y: 540, s: 1.5, rx: 0, ry: 0, rz: 0 },          // the screen fills the frame as the doughnut's hole opens on it
  { t: 0.5, x: 1345, y: 556, s: 0.86, rx: 4, ry: 19, rz: 0 },      // turned toward the words on the left
  { t: 3.55, x: 600, y: 700, s: 0.76, rx: 0, ry: 0, rz: 0 },        // out of the way of the insets
  { t: 6.85, x: 960, y: 632, s: 0.96, rx: 0, ry: 0, rz: 0 },       // front on
]
const RIG: Pose[] = (() => {
  const keys = ['x', 'y', 's', 'rx', 'ry', 'rz'] as const
  const w = (2 * Math.PI) / 0.7, zeta = 0.84, sub = 16, h = 1 / FPS / sub
  const cur: Pose = { ...POSES[0] }, vel: Pose = { x: 0, y: 0, s: 0, rx: 0, ry: 0, rz: 0 }
  const out: Pose[] = []
  for (let f = -PRE; f <= 10 * FPS; f++) {
    const t = f / FPS
    let key = POSES[0]
    for (const k of POSES) if (k.t <= t) key = k
    for (let i = 0; i < sub; i++) for (const k of keys) { vel[k] += (w * w * (key[k] - cur[k]) - 2 * zeta * w * vel[k]) * h; cur[k] += vel[k] * h }
    out.push({ ...cur })
  }
  return out
})()

const Tablet = ({ pose, ty = 0, tz = 0, lens = 0, persp = 2200, shade = 1, children }: { pose: Pose; ty?: number; tz?: number; lens?: number; persp?: number; shade?: number; children: ReactNode }) => (
  <Fill style={{ transform: `translateY(${lens}px)` }}>
    <Fill style={{ perspective: persp, perspectiveOrigin: '960px 540px' }}>
      <div style={{ position: 'absolute', left: pose.x - SW / 2, top: pose.y - SH / 2, width: SW, height: SH, transformOrigin: '50% 50%', transform: `translateY(${ty}px) translateZ(${tz}px) rotateZ(${pose.rz}deg) rotateY(${pose.ry}deg) rotateX(${pose.rx}deg) scale(${pose.s})` }}>
        <Body shade={shade} />
        <Screen>{children}</Screen>
      </div>
    </Fill>
  </Fill>
)

/* ---------- type ---------- */
/** a line of the station's condensed capitals that rises out of its own baseline and leaves the same way */
const Line = ({ now, t0, t1, size, color = P.ink, children, font = 'Barlow', weight = 700, track = '0.005em' }: { now: number; t0: number; t1: number; size: number; color?: string; children: ReactNode; font?: string; weight?: number; track?: string }) => {
  const p = spr(now - t0, 0.42, 0.8)
  const out = interpolate(now, [t1, t1 + 0.2], [0, 1], { ...clamp, easing: E.in })
  return (
    <div style={{ height: size * 0.9, overflow: 'hidden' }}>
      <div style={{ transform: `translateY(${((1 - p) * 104 - out * 104).toFixed(2)}%)`, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 0.9, letterSpacing: track, textTransform: 'uppercase', color, whiteSpace: 'nowrap' }}>{children}</div>
    </div>
  )
}

/** a magnified piece of the screen, lifted out and ruled, with a line back to where it came from */
const Inset = ({ now, t0, t1, rect, m, left, top, label, from }: { now: number; t0: number; t1: number; rect: [number, number, number, number]; m: number; left: number; top: number; label: string; from: Pose }) => {
  if (now < t0 || now > t1 + 0.3) return null
  const p = spr(now - t0, 0.45, 0.78)
  const out = interpolate(now, [t1, t1 + 0.22], [0, 1], { ...clamp, easing: E.in })
  const [x, y, w, h] = rect
  // where the piece sits on the tablet, in the frame
  const sx = from.x + (x - SW / 2) * from.s, sy = from.y + (y - SH / 2) * from.s, sw = w * from.s, sh = h * from.s
  const draw = interpolate(now, [t0, t0 + 0.3], [0, 1], { ...clamp, easing: E.out }) * (1 - out)
  const ex = left, ey = top + (h * m) / 2
  return (
    <>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: 1 - out }}>
        <rect x={sx - 4} y={sy - 4} width={sw + 8} height={sh + 8} fill="none" stroke={P.signal} strokeWidth={3} strokeDasharray={2 * (sw + sh + 16)} strokeDashoffset={2 * (sw + sh + 16) * (1 - draw)} />
        <line x1={sx + sw + 4} y1={sy + sh / 2} x2={sx + sw + 4 + (ex - sx - sw - 4) * draw} y2={sy + sh / 2 + (ey - sy - sh / 2) * draw} stroke={P.signal} strokeWidth={2} />
      </svg>
      <div style={{ position: 'absolute', left, top, opacity: Math.min(1, p * 1.6) * (1 - out), transform: `translateX(${(1 - p) * 60}px) scale(${0.92 + 0.08 * p})`, transformOrigin: '0 50%' }}>
        <Kicker size={24} style={{ position: 'absolute', left: 0, top: -44 }}>{label}</Kicker>
        <div style={{ position: 'relative', width: w * m, height: h * m, border: `1px solid ${P.rule}`, background: P.ground }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: -x * m, top: -y * m, width: SW, height: SH, transform: `scale(${m})`, transformOrigin: '0 0' }}><Take /></div>
          </div>
          <Ticks />
        </div>
      </div>
    </>
  )
}

/* ---------- five looks: one screen in five strips ---------- */
const LOOKS = [{ n: 'Station', f: 372 }, { n: 'Paper', f: 390 }, { n: 'Phosphor', f: 404 }, { n: 'Blueprint', f: 419 }, { n: 'Sunset', f: 434 }]
const Slats = ({ now }: { now: number }) => {
  // each strip takes its turn to be the wide one, half a second apart
  const turn = (i: number) => spr(now - (15.0 + i * 0.5), 0.5, 0.82) - spr(now - (15.5 + i * 0.5), 0.5, 0.82)
  const wt = LOOKS.map((_, i) => 1 + 1.5 * turn(i))
  const sum = wt.reduce((a, b) => a + b, 0)
  let x = 0
  const settle = 1.05 - 0.05 * spr(now - 14.8, 0.9, 1)
  return (
    <Fill style={{ background: P.deep, perspective: 2400 }}>
      {LOOKS.map((l, i) => {
        const w = (wt[i] / sum) * 1920, left = x
        x += w
        // the way out: every strip turns on its left edge until it is edge on, one after another
        const flip = interpolate(now, [17.42 + i * 0.045, 17.42 + i * 0.045 + 0.3], [0, 1], { ...clamp, easing: E.in })
        if (flip >= 1) return null
        return (
          <div key={l.n} style={{ position: 'absolute', left, top: 0, width: w + 1, height: 1080, overflow: 'hidden', transformOrigin: '0 50%', transform: `rotateY(${(flip * 90).toFixed(2)}deg)`, borderRight: `3px solid ${P.deep}`, filter: `brightness(${1 - 0.6 * flip})` }}>
            <div style={{ position: 'absolute', left: -left, top: 0, width: 1920, height: 1080, transform: `scale(${settle})`, transformOrigin: '50% 50%' }}>
              <div style={{ width: SW, height: SH, transform: 'scale(1.5)', transformOrigin: '0 0' }}><Still frame={l.f} /></div>
            </div>
            <div style={{ position: 'absolute', left: 0, bottom: 0, padding: '12px 22px 12px 20px', background: P.deep, fontFamily: 'Barlow', fontWeight: 700, fontSize: 30, letterSpacing: '0.2em', textTransform: 'uppercase', color: turn(i) > 0.5 ? P.signal : P.ink, whiteSpace: 'nowrap' }}>{l.n}</div>
          </div>
        )
      })}
      {/* the words on two strips of tape, as on the lock shot */}
      <div style={{ position: 'absolute', left: 96, top: 330, transform: 'rotate(-2deg)', opacity: 1 - interpolate(now, [17.3, 17.45], [0, 1], clamp) }}>
        {([['Same screen.', 15.0, P.deep, P.ink], ['Five looks.', 15.5, P.signal, P.deep]] as const).map(([w, t0, bg, fg]) => {
          const p = spr(now - t0, 0.34, 0.66)
          return <div key={w} style={{ width: 'fit-content', marginBottom: 14, opacity: now >= t0 ? 1 : 0, transform: `translateX(${(1 - p) * -70}px) scale(${1.2 - 0.2 * p})`, transformOrigin: '0 50%', background: bg, color: fg, padding: '18px 34px 10px', fontFamily: 'Barlow', fontWeight: 700, fontSize: 168, lineHeight: 0.9, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{w}</div>
        })}
      </div>
    </Fill>
  )
}

export const AppScene = () => {
  const raw = useCurrentFrame()
  const f = raw - PRE
  const now = f / FPS
  const rig = RIG[Math.max(0, Math.min(RIG.length - 1, raw))]
  // arrival: the screen opens out of the middle of the dial
  const arrive = raw / FPS < 1.4 ? 0.74 + 0.26 * spr(raw / FPS, 0.6, 0.84) : 1
  const breath = 1 + 0.006 * Math.sin(now * 0.8)
  const hit = shake(now, 8.0, 7), lockHit = shake(now, 2.5, 5)

  /* the tablet lies down and the camera goes over it: 8.3 to 9.02 */
  const q = interpolate(now, [8.3, 9.02], [0, 1], clamp)
  const fly = now >= 8.3
  const pose: Pose = fly
    ? { x: 960, y: interpolate(q, [0, 0.6], [rig.y, 540], { ...clamp, easing: E.inOut }), s: interpolate(q, [0, 1], [rig.s, 2.3], { ...clamp, easing: E.inOut }), rx: interpolate(q, [0, 0.62], [0, 84], { ...clamp, easing: E.inOut }), ry: 0, rz: 0 }
    : { ...rig, s: rig.s * arrive * breath, x: rig.x + hit.x + lockHit.x, y: rig.y + hit.y + lockHit.y }
  const ty = fly ? interpolate(q, [0.1, 0.8], [0, 230], { ...clamp, easing: E.inOut }) : 0
  const tz = fly ? interpolate(q, [0.3, 1], [0, 380], { ...clamp, easing: E.in }) : 0
  const lens = fly ? interpolate(q, [0.6, 1], [0, -740], { ...clamp, easing: E.inOut }) : 0
  const glass = fly ? interpolate(q, [0.3, 0.86], [1, 0], clamp) : 1

  const story = now < 9.4
  const strips = now >= 14.8 && now < 17.95
  const arcade = now >= 17.4 && now < 20.1
  const front = now >= 20.1

  /* the arcade: the tablet at an angle, running off the frame, and the number beside it */
  const ap = spr(now - 17.45, 0.8, 0.86)
  const arcadePose: Pose = { x: 1440 - 60 * (1 - ap), y: 670, s: 1.02 + 0.1 * (1 - ap), rx: 7, ry: 15, rz: -6 + 3 * (1 - ap) }
  const count = Math.round(16 * interpolate(now, [17.75, 18.35], [0, 1], { ...clamp, easing: E.out }))

  /* the front page: footage on the left, the yellow field on the right; at the end the field takes the frame */
  const take = interpolate(now, [23.2, 23.7], [0, 1], { ...clamp, easing: E.inOut })
  const edge = 1056 * (1 - take)
  const ridges = interpolate(now, [23.35, 23.95], [0, 1], { ...clamp, easing: E.inOut })
  const drift = interpolate(now, [20.1, 24], [0, 1], clamp)

  return (
    <Fill style={{ background: P.deep }}>
      {story && (
        <>
          <Contours t={now * 2 + 30} opacity={0.55 * (fly ? 1 - q : 1)} cx={960} cy={540} />

          {/* 0.0: the words, left */}
          {now > 0.6 && now < 3.8 && (
            <div style={{ position: 'absolute', left: 104, top: 300 }}>
              <Kicker size={26} style={{ marginBottom: 30, opacity: spr(now - 0.7, 0.4, 1) * (1 - interpolate(now, [3.3, 3.5], [0, 1], clamp)) }}>The session</Kicker>
              {now < 2.75 ? (
                <>
                  <Line now={now} t0={0.75} t1={2.42} size={212}>Set a</Line>
                  <Line now={now} t0={0.9} t1={2.46} size={212}>length.</Line>
                </>
              ) : (
                <>
                  <Line now={now} t0={2.5} t1={3.3} size={290} color={P.signal}>Lock</Line>
                  <Line now={now} t0={2.56} t1={3.34} size={290} color={P.signal}>in.</Line>
                </>
              )}
            </div>
          )}

          {/* 3.6: the headline over the tablet, the insets on the right */}
          {now > 3.8 && now < 7.1 && (
            <div style={{ position: 'absolute', left: 104, top: 84 }}>
              <Line now={now} t0={4.0} t1={6.62} size={156}>Leave the tab.</Line>
              <Line now={now} t0={5.3} t1={6.66} size={156} color={P.signal}>It counts.</Line>
            </div>
          )}

          {/* 6.9: the word standing behind the tablet */}
          {now > 6.9 && now < 8.6 && (() => {
            const up = spr(now - 7.0, 0.6, 0.8), solid = now >= 8.0
            const away = interpolate(now, [8.25, 8.5], [0, 1], { ...clamp, easing: E.in })
            return (
              <div style={{ position: 'absolute', left: 0, right: 0, top: 96, textAlign: 'center', transform: `translateY(${(1 - up) * 240 + away * 200}px)`, opacity: 1 - away, fontFamily: 'Unbounded', fontWeight: 800, fontSize: 318, lineHeight: 1, letterSpacing: '-0.04em', color: solid ? P.ink : 'transparent', WebkitTextStroke: `3px ${P.ink}` }}>FINISH.</div>
            )
          })()}

          <Tablet pose={pose} ty={ty} tz={tz} lens={lens} persp={fly ? 1300 : 2200} shade={glass}>
            <div style={{ opacity: glass }}><Take /></div>
          </Tablet>

          <Inset now={now} t0={4.55} t1={6.6} rect={[453, 18, 374, 74]} m={1.8} left={1180} top={420} label="It tells you" from={rig} />
          <Inset now={now} t0={5.3} t1={6.64} rect={[48, 243, 366, 100]} m={1.8} left={1180} top={650} label="It keeps count" from={rig} />

          {/* 8.0: the stamp */}
          {now >= 8.0 && now < 8.6 && (() => {
            const p = spr(now - 8.0, 0.32, 0.62)
            const away = interpolate(now, [8.28, 8.45], [0, 1], { ...clamp, easing: E.in })
            return (
              <div style={{ position: 'absolute', left: 1190, top: 800, transform: `rotate(-7deg) scale(${(1.7 - 0.7 * p) * (1 - 0.3 * away)})`, opacity: Math.min(1, p * 2) * (1 - away), background: P.signal, padding: '18px 34px 14px', fontFamily: 'Barlow', fontWeight: 700, fontSize: 118, lineHeight: 0.9, textTransform: 'uppercase', color: P.deep, whiteSpace: 'nowrap', boxShadow: `10px 10px 0 ${P.deep}` }}>Earn credits.</div>
            )
          })()}

          {/* the glass takes the frame: nothing but black by 9.0 */}
          {fly && <Fill style={{ background: '#000', opacity: interpolate(q, [0.9, 1], [0, 1], clamp) }} />}
          {now >= 0 && now < 0.2 && <Fill style={{ background: '#fff', opacity: 0.16 * (1 - now / 0.2), pointerEvents: 'none' }} />}
        </>
      )}

      {arcade && (
        <Fill style={{ background: P.deep }}>
          <Contours t={now * 2 + 60} opacity={0.5} cx={960} cy={540} />
          <Tablet pose={arcadePose}><Take /></Tablet>
          <div style={{ position: 'absolute', left: 96, top: 120 }}>
            <div style={{ fontFamily: 'Unbounded', fontWeight: 800, fontSize: 470, lineHeight: 0.86, letterSpacing: '-0.06em', color: P.signal, opacity: now > 17.75 ? 1 : 0, transform: `translateX(${(1 - spr(now - 17.75, 0.5, 0.8)) * -80}px)`, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
            <div style={{ marginTop: 26 }}><Line now={now} t0={18.1} t1={19.85} size={190}>Games.</Line></div>
            <div style={{ marginTop: 22 }}><Line now={now} t0={18.5} t1={19.88} size={74} color={P.ice} track="0.08em">Paid for in focus.</Line></div>
          </div>
        </Fill>
      )}

      {strips && <Slats now={now} />}

      {front && (
        <Fill style={{ background: P.deep }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1056, height: 1080, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: -14 * 2.52 - drift * 40, top: -28 * 2.52, width: SW, height: SH, transform: 'scale(2.52)', transformOrigin: '0 0' }}><Take /></div>
          </div>
          <div style={{ position: 'absolute', left: edge, top: 0, right: 0, height: 1080, background: P.signal, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 72, top: 250, opacity: 1 - interpolate(now, [23.15, 23.35], [0, 1], clamp) }}>
              <Kicker size={26} color={P.deep} style={{ marginBottom: 34, opacity: spr(now - 20.3, 0.4, 1) }}>The front page</Kicker>
              <Line now={now} t0={20.5} t1={23.1} size={146} color={P.deep}>No feed.</Line>
              <Line now={now} t0={21.5} t1={23.14} size={146} color={P.deep}>No account.</Line>
              <div style={{ marginTop: 30 }}><Line now={now} t0={22.5} t1={23.16} size={74} color={P.deep} track="0.08em">Open it and start.</Line></div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: edge - 3, top: 0, width: 6, height: 1080, background: P.deep, opacity: take < 1 ? 1 : 0 }} />
          {/* the field dissolves into the first frame of the next shot itself (the dial's knurled edge), so the cut lands on identical pixels */}
          <Fill style={{ opacity: ridges, transform: 'scale(1.012)' }}><Img src={staticFile('v6/lock/l_0001.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Fill>
        </Fill>
      )}

      <Fill style={{ background: 'rgb(4,9,22)', mixBlendMode: 'lighten', pointerEvents: 'none', opacity: front ? 1 - take : 1 }} />
      <Grain opacity={0.03} />
    </Fill>
  )
}

/** the colour bars close over the picture from both edges and open on the next one: the way out of the text world */
export const BarsWipe = ({ at }: { at: number }) => {
  const t = useCurrentFrame() / FPS - at
  if (t < 0 || t > 0.95) return null
  return (
    <Fill style={{ pointerEvents: 'none' }}>
      {BARS.map((c, i) => {
        const a = interpolate(t, [i * 0.03, i * 0.03 + 0.2], [0, 1], { ...clamp, easing: E.inOut })
        const b = interpolate(t, [0.44 + i * 0.03, 0.44 + i * 0.03 + 0.26], [0, 1], { ...clamp, easing: E.inOut })
        const h = `${((a - b) * 100).toFixed(2)}%`
        const edge = i % 2 === 0 ? { top: `${(b * 100).toFixed(2)}%` } : { bottom: `${(b * 100).toFixed(2)}%` }
        return <div key={c} style={{ position: 'absolute', left: (i * 1920) / 7 - 1, width: 1920 / 7 + 2, height: h, background: c, ...edge }} />
      })}
    </Fill>
  )
}
