import { Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { Dial, E, Fill, Grain, P, clamp, sec } from './kit'
import { detents } from './Title'
import { Dust, MotionBlur } from './Lens'

const GAP = 1250, FLOOR = 340

type Seg = { dur: number; from: number; rate?: number; freeze?: boolean }
type Key = [number, number, number, number]          // pane-relative seconds, centre x, centre y, width (all in the recording's 2560 x 1440 pixels)
type Pane = { id: string; w: number; h: number; src: string; start: number; end: number; segs: Seg[]; keys: Key[]; head: string[]; sub: string; veil?: { at: number; dur: number } }

/** the session, as told by the app's own screen recordings */
export const PANES: Pane[] = [
  { id: 'tune', w: 1160, h: 652, src: 'v4/ui/tune.mp4', start: 0, end: 4.8, head: ['Tune something', 'to stay with.'], sub: 'Live radio, TV, podcasts and songs. One at a time.',
    segs: [{ dur: 2.7, from: 2.2, rate: 1.15 }, { dur: 2.1, from: 5.7, rate: 1.9 }],
    keys: [[0, 770, 470, 1380], [2.4, 770, 510, 1380], [3.4, 1420, 700, 1900], [4.8, 1420, 700, 1800]] },
  { id: 'lock', w: 780, h: 700, src: 'v4/ui/session.mp4', start: 4.8, end: 9.6, head: ['Pick a length.', 'Lock in.'], sub: 'The timer only counts while you are looking at it.',
    segs: [{ dur: 3.0, from: 3.3, rate: 2.6 }, { dur: 1.8, from: 11.3, rate: 2.8 }],
    keys: [[0, 1280, 690, 920], [3.0, 1280, 690, 900], [4.8, 1280, 600, 860]] },
  { id: 'drift', w: 800, h: 700, src: 'v4/ui/session.mp4', start: 9.6, end: 14.4, head: ['Leave,', 'and it counts.'], sub: 'Away from the tab for six seconds is a drift.',
    segs: [{ dur: 0.7, from: 17.9 }, { dur: 1.6, from: 18.7, freeze: true }, { dur: 2.5, from: 26.3 }],
    veil: { at: 0.7, dur: 1.6 },
    keys: [[0, 1280, 560, 980], [2.1, 1280, 520, 980], [2.8, 1280, 430, 980], [3.7, 1280, 430, 980], [4.8, 480, 640, 860]] },
  { id: 'finish', w: 800, h: 700, src: 'v4/ui/session.mp4', start: 14.4, end: 18.0, head: ['Stay,', 'and you earn.'], sub: 'Finish a session and it pays out credits.',
    segs: [{ dur: 3.6, from: 30.0, rate: 1.4 }],
    keys: [[0, 1280, 640, 1250], [1.1, 1280, 720, 980], [3.6, 1280, 720, 940]] },
  { id: 'arcade', w: 1160, h: 652, src: 'v4/ui/arcade.mp4', start: 18.0, end: 21.6, head: ['Spend it', 'on play.'], sub: 'Sixteen small games. Credits come from focus, lessons and trivia.',
    segs: [{ dur: 3.6, from: 0.1, rate: 0.85 }],
    keys: [[0, 1300, 640, 2400], [3.6, 1350, 600, 1950]] },
  { id: 'looks', w: 1160, h: 652, src: 'v4/ui/themes.mp4', start: 21.6, end: 24.0, head: ['Make it yours.'], sub: 'Five looks, from newsprint to blueprint.',
    segs: [[3.3, 0.4], [4.9, 0.4], [6.5, 0.4], [1.7, 0.8], [8.0, 0.4]].map(([from, dur]) => ({ dur, from, freeze: true })),
    keys: [[0, 1280, 720, 2400]] },
]
export const WORLD_LEN = 24.0

/** long strip lamps lying in the floor's reflection, scattered along the whole track */
const LAMPS = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  return { x: -1800 + i * 330 + r(1) * 160, z: 500 + r(2) * 3600, w: 160 + r(3) * 360, o: 0.16 + r(4) * 0.5 }
})

const cropAt = (keys: Key[], t: number) => {
  const ts = keys.map((k) => k[0])
  const at = (i: number) => interpolate(t, ts, keys.map((k) => k[i]), { ...clamp, easing: E.inOut })
  return { cx: at(1), cy: at(2), cw: at(3) }
}

/** a crop that follows the action, then the segments that retime the recording */
const Screen = ({ pane, rel }: { pane: Pane; rel: number }) => {
  const c = cropAt(pane.keys, rel)
  const cw = Math.min(2560, c.cw)
  const ch = cw * (pane.h / pane.w)
  const x = Math.max(0, Math.min(2560 - cw, c.cx - cw / 2))
  const y = Math.max(0, Math.min(1440 - ch, c.cy - ch / 2))
  const s = pane.w / cw
  let at = 0
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: P.ground }}>
      {pane.segs.map((g, i) => {
        const from = sec(pane.start + at)
        at += g.dur
        return (
          <Sequence key={i} from={from} durationInFrames={sec(g.dur) + (i === pane.segs.length - 1 ? 0 : 1)} layout="none">
            <Freeze frame={g.freeze ? 0 : 1e9} active={!!g.freeze}>
              <OffthreadVideo src={staticFile(pane.src)} startFrom={sec(g.from)} playbackRate={g.rate ?? 1} muted
                style={{ position: 'absolute', width: 2560 * s, height: 1440 * s, left: -x * s, top: -y * s, maxWidth: 'none' }} />
            </Freeze>
          </Sequence>
        )
      })}
      {pane.veil && <Veil at={pane.veil.at} dur={pane.veil.dur} rel={rel} />}
    </div>
  )
}

/** the one thing that is not the app's own pixels: while the session is left behind, say so */
const Veil = ({ at, dur, rel }: { at: number; dur: number; rel: number }) => {
  const a = interpolate(rel, [at, at + 0.1, at + dur - 0.02, at + dur + 0.04], [0, 1, 1, 0], clamp)
  const n = Math.min(8, Math.floor(interpolate(rel, [at + 0.2, at + dur - 0.1], [0, 8.99], clamp)))
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: a, background: 'rgba(3,5,10,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ fontFamily: 'Hanken', fontWeight: 500, fontSize: 40, color: P.ink, letterSpacing: '-0.02em' }}>You left the tab.</div>
      <div style={{ fontFamily: 'Unbounded', fontWeight: 700, fontSize: 96, color: P.signal, letterSpacing: '-0.03em' }}>0:0{n}</div>
    </div>
  )
}

const off = (p: Pane) => p.w / 2 - 260      // where the pane's centre rests, relative to the middle of the frame
const camPath = (t: number) => {
  // stop i: arrive at (start + 0.55), leave at (end - 0.25)
  const xs: number[] = [], os: number[] = [], ts: number[] = []
  PANES.forEach((p, i) => { ts.push(p.start === 0 ? 0 : p.start + 0.55, p.end - 0.25); xs.push(i * GAP, i * GAP); os.push(off(p), off(p)) })
  let x = xs[0], o = os[0]
  for (let i = 0; i < ts.length - 1; i++) {
    if (t >= ts[i] && t <= ts[i + 1]) {
      const k = (t - ts[i]) / (ts[i + 1] - ts[i])
      const easing = xs[i] === xs[i + 1] ? E.inOut : E.cam
      x = interpolate(k, [0, 1], [xs[i], xs[i + 1]], { easing })
      o = interpolate(k, [0, 1], [os[i], os[i + 1]], { easing })
    }
  }
  if (t > ts[ts.length - 1]) { x = xs[xs.length - 1]; o = os[os.length - 1] }
  return { x, o }
}

const Caption = ({ pane, t }: { pane: Pane; t: number }) => {
  const inn = (i: number) => interpolate(t, [pane.start + 0.4 + i * 0.09, pane.start + 1.0 + i * 0.09], [0, 1], { ...clamp, easing: E.out })
  const out = interpolate(t, [pane.end - 0.35, pane.end - 0.05], [1, 0], { ...clamp, easing: E.in })
  const sub = interpolate(t, [pane.start + 0.9, pane.start + 1.5], [0, 1], { ...clamp, easing: E.out })
  if (t < pane.start || t > pane.end) return null
  return (
    <div style={{ position: 'absolute', left: 104, top: 392, width: 640, opacity: out, color: P.ink }}>
      {pane.head.map((h, i) => (
        <div key={i} style={{ overflow: 'hidden', height: 84, lineHeight: '84px', fontFamily: 'Hanken', fontWeight: 600, fontSize: 70, letterSpacing: '-0.04em' }}>
          <div style={{ transform: `translateY(${(1 - inn(i)) * 110}%)`, filter: `blur(${(1 - inn(i)) * 9}px)` }}>{h}</div>
        </div>
      ))}
      <div style={{ marginTop: 22, width: 470, fontFamily: 'Hanken', fontWeight: 400, fontSize: 30, lineHeight: 1.35, color: '#a9b1c2', opacity: sub, filter: `blur(${(1 - sub) * 6}px)`, transform: `translateY(${(1 - sub) * 10}px)` }}>{pane.sub}</div>
    </div>
  )
}

/** The session, told through the app's own screens standing on the same black glass as the dial. */
export const World = () => {
  const f = useCurrentFrame()
  const t = f / 24
  const { x: camX, o: camO } = camPath(t)
  const prev = camPath(t - 1 / 24)
  const speed = Math.abs(camX - camO - (prev.x - prev.o)) * 0.9
  const open = interpolate(t, [0, 0.9], [0, 1], { ...clamp, easing: E.out })
  const push = interpolate(t, [0, WORLD_LEN], [0, 70])       // a slow dolly in under everything, so no hold is ever still
  // the dial in the corner clicks one detent for each screen
  const turn = PANES.reduce((a, p, i) => a + (i === 0 ? 0 : detents(t, p.start - 0.1, 1, 0, 30)), 0)
  return (
    <Fill style={{ background: P.deep }}>
      <MotionBlur px={speed}>
      <div style={{ position: 'absolute', inset: 0, perspective: 1700, perspectiveOrigin: '960px 470px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 960, top: 540, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `translate3d(${camO - camX}px, ${40 * (1 - open)}px, ${push}px) rotateY(${Math.sin(t * 0.55) * 1.1}deg)`, opacity: open }}>
          {/* the floor: the dial's glass, scored with the ridges */}
          <div style={{ position: 'absolute', left: -9000, top: FLOOR, width: 18000 + 6000 * 0, height: 5200, transformOrigin: '50% 0', transform: 'translateZ(-4200px) rotateX(90deg)',
            background: `repeating-linear-gradient(90deg, rgba(127,211,255,0.00) 0px, rgba(127,211,255,0.00) 118px, rgba(127,211,255,0.10) 118px, rgba(127,211,255,0.10) 121px), ${P.deep}`,
            maskImage: 'linear-gradient(to top, #000 0%, #000 8%, transparent 72%)' }} />
          {LAMPS.map((l, i) => (
            <div key={'lamp' + i} style={{ position: 'absolute', left: l.x, top: FLOOR, width: l.w, height: 5, transformOrigin: '50% 0', transform: `translateZ(${-l.z}px) rotateX(90deg)`, opacity: l.o, background: 'linear-gradient(90deg, transparent, rgba(160,220,255,0.9) 18%, rgba(200,236,255,1) 50%, rgba(160,220,255,0.9) 82%, transparent)' }} />
          ))}
          {PANES.map((p, i) => {
            const near = Math.max(0, 1 - Math.abs(i * GAP - camX) / GAP)
            if (near <= 0.02) return null
            return <div key={'pool' + p.id} style={{ position: 'absolute', left: i * GAP - 900, top: FLOOR, width: 1800, height: 1100, transformOrigin: '50% 0', transform: 'translateZ(-350px) rotateX(90deg)', opacity: near * 0.9, background: 'radial-gradient(ellipse 50% 50% at 50% 28%, rgba(127,211,255,0.17), transparent 100%)' }} />
          })}
          {PANES.map((p, i) => {
            const rel = t - p.start
            const live = t > p.start - 1.4 && t < p.end + 1.4
            const dx = i * GAP - camX
            const k = Math.min(1, Math.abs(dx) / GAP)
            // at rest each screen is turned a little toward the caption, like a slab standing in the room; away from the camera it turns further
            const yaw = 9 * (1 - k) + (dx === 0 ? 0 : -Math.sign(dx) * 22 * Math.min(1, Math.abs(dx) / 1000))
            if (!live) return null
            return (
              <div key={p.id} style={{ position: 'absolute', left: i * GAP - p.w / 2, top: FLOOR - p.h, width: p.w, height: p.h, transform: `rotateY(${yaw}deg)`, opacity: 1 - 0.78 * k, filter: `blur(${k * 5}px)`, WebkitBoxReflect: 'below 10px linear-gradient(to bottom, transparent 58%, rgba(255,255,255,0.5) 100%)' }}>
                <div style={{ position: 'absolute', inset: -14, borderRadius: 20, background: '#080c14', border: '1px solid rgba(127,211,255,0.20)', borderTopColor: 'rgba(127,211,255,0.5)', boxShadow: '0 0 0 1px #02040a' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden' }}>
                  <Screen pane={p} rel={rel} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </MotionBlur>
      <Dust count={30} seed={3} opacity={0.55} area={{ x: 560, y: 120, w: 1360, h: 760 }} />
      {PANES.map((p) => <Caption key={p.id} pane={p} t={t} />)}
      <div style={{ position: 'absolute', left: 104, top: 940, opacity: open }}>
        <Dial size={76} deg={36 + turn} />
      </div>
      <Fill style={{ background: 'radial-gradient(ellipse 90% 85% at 62% 48%, transparent 55%, rgba(2,4,10,0.65) 100%)', pointerEvents: 'none' }} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
