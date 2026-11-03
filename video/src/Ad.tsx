import type React from 'react'
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, random, staticFile, useCurrentFrame } from 'remotion'
import { Ascii, COLS, ROWS } from './Ascii'
import { Clip, Hud, Line, Plate, White } from './kit'
import { BARS, C, Dots, Fill, Grain, IN, Kicker, OUT, clamp, useShake, useSlam, useT } from './ui'

export const FPS = 30
export const TOTAL = 1350
const s = (n: number) => Math.round(n * FPS)

/** noise, as a channel with nothing on it: a small turbulence scaled up */
const Static = ({ opacity = 1 }: { opacity?: number }) => {
  const f = useCurrentFrame()
  return (
    <Fill style={{ opacity, mixBlendMode: 'screen' }}>
      <svg width="1920" height="1080" viewBox="0 0 480 270" preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }}>
        <filter id={`n${f}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed={f * 7 + 3} /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="linear" slope="2.2" intercept="-0.55" /><feFuncG type="linear" slope="2.2" intercept="-0.55" /><feFuncB type="linear" slope="2.2" intercept="-0.55" /></feComponentTransfer></filter>
        <rect width="480" height="270" filter={`url(#n${f})`} />
      </svg>
    </Fill>
  )
}

/* ---------- 1. power on: the line, the real boot terminal, the test card ---------- */
const TestCard = () => (
  <Fill style={{ background: C.ground }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 60, height: 560, display: 'flex' }}>{[...BARS.slice(0, 6), '#161b27'].map((c) => <div key={c} style={{ flex: 1, background: c }} />)}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 620, height: 80, display: 'flex' }}>{Array.from({ length: 14 }, (_, i) => <div key={i} style={{ flex: 1, background: `hsl(0 0% ${i * 7.5}%)` }} />)}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 700, bottom: 60, background: '#05070c', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <svg width="190" height="190" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="none" stroke={C.ink} strokeWidth="5" /><rect x="40" y="10" width="16" height="16" fill={C.signal} /></svg>
        <div>
          <div style={{ fontFamily: 'Hanken', fontWeight: 900, fontSize: 120, letterSpacing: '-0.03em', textTransform: 'uppercase', color: C.ink, lineHeight: 1 }}>Friction</div>
          <div style={{ fontFamily: 'GeistMono', fontSize: 26, letterSpacing: '0.3em', color: C.signal, marginTop: 10 }}>STATION TEST · 1000 HZ</div>
        </div>
      </div>
    </div>
  </Fill>
)
const S1 = () => {
  const f = useCurrentFrame()
  // the line, then the screen opens
  const line = interpolate(f, [2, 9], [0, 1], { ...clamp, easing: OUT })
  const open = interpolate(f, [9, 20], [0.004, 1], { ...clamp, easing: Easing.bezier(0.7, 0, 0.2, 1) })
  const boot = f >= 14 && f < 76
  const card = f >= 76
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {f < 9 && <Fill style={{ background: '#fff', top: 540, height: 3, bottom: 'auto', left: `${50 - line * 50}%`, right: `${50 - line * 50}%`, boxShadow: '0 0 40px 8px #fff' }} />}
      {f >= 9 && (
        <Fill style={{ scale: `1 ${open}`, background: C.ground, overflow: 'hidden' }}>
          {boot && <Clip src="v3/landing.mp4" from={0.12} cam={[[0, 1.0, 960, 480], [2.2, 1.06, 960, 480]]} />}
          {card && <TestCard />}
        </Fill>
      )}
      {f >= 70 && f < 84 && <Static opacity={interpolate(f, [70, 76, 84], [0, 0.85, 0], clamp)} />}
      {f >= 9 && f < 14 && <White at={9} len={5} peak={0.5} />}
    </AbsoluteFill>
  )
}

/* ---------- 2. the feed ---------- */
const HEIGHTS = Array.from({ length: 12 }, (_, i) => (random(`t${i}`) > 0.6 ? 360 : 240))
const PERIOD = HEIGHTS.reduce((a, h) => a + h + 40, 0)
const CARD = (ci: number, i: number, key: number) => {
  const w = 0.45 + random(`w${ci}-${i}`) * 0.5
  const tall = HEIGHTS[i] === 360
  return (
    <div key={key} style={{ height: HEIGHTS[i], marginBottom: 40, border: '2px solid #46567a', background: '#1c2640', padding: 26, display: 'flex', gap: 22 }}>
      <div style={{ width: 70, height: 70, borderRadius: 70, background: '#5a6a92', flex: 'none' }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 20, width: `${w * 100}%`, background: '#5a6a92', marginBottom: 16 }} />
        <div style={{ height: 18, width: '92%', background: '#33405f', marginBottom: 12 }} />
        <div style={{ height: 18, width: '64%', background: '#33405f', marginBottom: 12 }} />
        {tall && <div style={{ height: 150, width: '100%', background: '#2a3654' }} />}
      </div>
    </div>
  )
}
const Feed = () => {
  const f = useCurrentFrame()
  // exponential speed: slow, then too fast to read
  const k = 0.026
  const pos = (160 / k) * (Math.exp(k * f) - 1) * 0.35
  const v = 160 * 0.35 * Math.exp(k * f)
  const stretch = 1 + Math.min(5, v / 50)
  const cols = [{ x: 330, w: 380, o: 0 }, { x: 770, w: 380, o: 170 }, { x: 1210, w: 380, o: 60 }]
  return (
    <Fill style={{ overflow: 'hidden' }}>
      {cols.map((c, ci) => (
        <div key={ci} style={{ position: 'absolute', left: c.x, width: c.w, top: 0, bottom: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, transformOrigin: '50% 50%', scale: `1 ${stretch}`, translate: `0 ${-(((pos * (1 + ci * 0.25) + c.o) % PERIOD))}px` }}>
            {Array.from({ length: 24 }, (_, j) => { const i = j % 12
              return CARD(ci, i, j) })}
          </div>
        </div>
      ))}
    </Fill>
  )
}
const S2 = () => {
  const f = useCurrentFrame()
  const lost = Math.floor(interpolate(f, [30, 168], [0, 40 * 60], { ...clamp, easing: Easing.bezier(0.5, 0, 0.9, 0.6) }))
  const mm = String(Math.floor(lost / 60)).padStart(2, '0'), ss = String(lost % 60).padStart(2, '0')
  const fade = interpolate(f, [100, 160], [0.18, 0.62], clamp)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Dots opacity={0.25} />
      <Feed />
      <Fill style={{ background: `rgba(5,7,12,${fade})` }} />
      <Fill style={{ left: 120, top: 250 }}>
        <Line at={8} size={130} weight={400} font="Hanken" track="-0.03em" style={{ textTransform: 'none' }}>You opened it</Line>
        <Line at={22} size={130} weight={400} font="Hanken" track="-0.03em" style={{ textTransform: 'none' }}>for one thing.</Line>
        <Line at={74} size={130} weight={800} font="Hanken" track="-0.03em" style={{ textTransform: 'none', marginTop: 40 }}>Forty minutes later,</Line>
        <Line at={104} size={130} weight={800} font="Hanken" track="-0.03em" color={C.signal} style={{ textTransform: 'none' }}>still scrolling.</Line>
      </Fill>
      <Fill style={{ right: 120, bottom: 120, textAlign: 'right' }}>
        <div style={{ fontFamily: 'GeistMono', fontSize: 24, letterSpacing: '0.22em', color: C.dim }}>TIME LOST</div>
        <div style={{ fontFamily: 'Unbounded', fontWeight: 700, fontSize: 96, color: C.ink, letterSpacing: '-0.02em' }}>00:{mm}:{ss}</div>
      </Fill>
      {f >= 172 && <Fill style={{ background: '#000' }} />}
      {f >= 164 && f < 172 && <Static opacity={0.6} />}
    </AbsoluteFill>
  )
}

/* ---------- 3. the solid: scrolling has no friction ---------- */
const S3 = () => {
  const f = useCurrentFrame()
  const grow = interpolate(f, [0, 130], [26, 42], { ...clamp, easing: OUT })
  const thru = interpolate(f, [134, 178], [0, 1], { ...clamp, easing: Easing.bezier(0.6, 0, 0.9, 0.5) })
  const size = grow * (1 + thru * 7)
  const cx = interpolate(thru, [0, 1], [COLS * 0.78, COLS * 0.5])
  const sh = useShake(0, 30)
  const sh2 = useShake(30, 22)
  const sh3 = useShake(60, 38)
  const sub = useT(92, 16)
  const textOut = interpolate(f, [128, 142], [1, 0], clamp)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Dots opacity={0.28} />
      <Fill style={{ translate: `${sh.x + sh2.x + sh3.x}px ${sh.y + sh2.y + sh3.y}px` }}>
        <Ascii shape="torus" cx={cx} cy={ROWS / 2} size={size} a={0.9 + f * 0.032} b={f * 0.047} c={f * 0.01} color={C.signal} opacity={interpolate(f, [0, 6], [0, 1], clamp)} />
        <Fill style={{ left: 110, top: 210, opacity: textOut }}>
          <Line at={0} size={236} font="Hanken" weight={900} track="-0.04em">Scrolling</Line>
          <Line at={30} size={236} font="Hanken" weight={900} track="-0.04em" style={{ marginTop: 6 }}>has no</Line>
          <Line at={60} size={236} font="Hanken" weight={900} track="-0.04em" color={C.signal} style={{ marginTop: 6 }}>friction.</Line>
          <div style={{ fontFamily: 'Hanken', fontSize: 44, color: C.ink, marginTop: 40, width: 880, lineHeight: 1.2, opacity: sub, translate: `0 ${(1 - sub) * 24}px` }}>A focus timer that counts every time you leave.</div>
        </Fill>
      </Fill>
      <White at={0} len={10} peak={0.9} />
      <White at={30} len={7} color={C.signal} peak={0.35} />
      <White at={60} len={9} color={C.signal} peak={0.5} />
    </AbsoluteFill>
  )
}

/* ---------- 4. focus ---------- */
const S4a = () => (
  <AbsoluteFill style={{ background: C.ground }}>
    <Clip src="v3/focus.mp4" from={4.0} cam={[[0, 1.0, 960, 480], [0.6, 2.0, 960, 620], [3.0, 2.0, 960, 620], [3.9, 1.15, 960, 500]]} />
    <Plate at={10} out={104} kicker="One screen" style={{ left: 90, top: 100 }}>Pick a length.</Plate>
  </AbsoluteFill>
)
const S4b = () => {
  const sh = useShake(54, 16)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <div style={{ position: 'absolute', inset: 0, translate: `${sh.x}px ${sh.y}px` }}>
        <Clip src="v3/focus.mp4" from={11.2} cam={[[0, 1.0, 960, 480], [0.5, 1.7, 960, 590], [1.5, 1.7, 960, 590], [2.3, 1.15, 960, 440], [3.9, 1.3, 960, 420]]} />
      </div>
      <Plate at={6} out={52} kicker="Then" style={{ left: 90, top: 100 }}>Lock in.</Plate>
      <Plate at={66} kicker="Leave the tab" style={{ left: 90, top: 100 }} sub="Six seconds away and it counts as a drift. The numbers never lie.">It&rsquo;s a drift.</Plate>
    </AbsoluteFill>
  )
}

/* ---------- 5. tune in ---------- */
const S5 = () => {
  const f = useCurrentFrame()
  const label = f < 75 ? 'Radio' : f < 120 ? 'Radio' : f < 150 ? 'TV' : f < 165 ? 'Podcasts' : 'Songs'
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      {f < 75 && <Clip src="v3/tune.mp4" from={5.2} cam={[[0, 1.0, 960, 480], [0.8, 1.8, 600, 400], [2.5, 1.8, 600, 400]]} />}
      {f >= 75 && f < 120 && <Clip src="v3/tune.mp4" from={8.0} cam={[[0, 1.45, 900, 520], [1.5, 1.2, 960, 520]]} />}
      {f >= 120 && f < 150 && <Clip src="v3/tune.mp4" from={13.5} cam={[[0, 1.25, 1000, 420], [1, 1.1, 1000, 440]]} />}
      {f >= 150 && f < 165 && <Clip src="v3/tune.mp4" from={18.6} cam={[[0, 1.2, 960, 400], [0.5, 1.1, 960, 440]]} />}
      {f >= 165 && <Clip src="v3/tune.mp4" from={23.3} cam={[[0, 1.2, 960, 400], [0.5, 1.1, 960, 440]]} />}
      <Plate at={6} kicker="Tune in, stay put" style={{ left: 90, top: 770 }} sub="One player on every screen. It never stops when you move around.">{label}.</Plate>
      {[75, 120, 150, 165].map((c) => f >= c && f < c + 6 && <Static key={c} opacity={0.55} />)}
    </AbsoluteFill>
  )
}

/* ---------- 6. study windows ---------- */
const S6 = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      {f < 60 && <Clip src="v3/widgets.mp4" from={3.9} cam={[[0, 1.2, 600, 400], [1.0, 1.7, 480, 520], [2.0, 1.7, 480, 520]]} />}
      {f >= 60 && <Clip src="v3/report.mp4" from={11.9} cam={[[0, 1.25, 960, 470], [2, 1.12, 960, 480]]} />}
      <Plate at={4} out={50} kicker="Study windows" style={{ left: 1000, top: 760 }} sub="Notepad, timer, calculator, converter, to-do list, scratch board and a small browser.">Cards, dealt.</Plate>
      <Plate at={64} kicker="Lessons" style={{ left: 90, top: 770 }} sub="Built from Wikipedia by fixed rules. No AI writes them.">Learn anything.</Plate>
    </AbsoluteFill>
  )
}

/* ---------- 7. the day, scored ---------- */
const S7 = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      {f < 60 && <Clip src="v3/report.mp4" from={0.9} cam={[[0, 1.0, 960, 480], [0.7, 1.7, 460, 640], [2, 1.7, 460, 640]]} />}
      {f >= 60 && <Clip src="v3/report.mp4" from={7.0} cam={[[0, 1.35, 960, 400], [2, 1.15, 960, 440]]} />}
      <Plate at={6} kicker="The debrief" style={{ left: 1060, top: 100 }} sub="Your day, scored from your own numbers. No AI.">Held. Drifted.</Plate>
      <Plate at={64} kicker="Then spend them" style={{ left: 90, top: 770 }} sub="Focus earns credits. A game can never win you any.">Games. Breaks.</Plate>
    </AbsoluteFill>
  )
}

/* ---------- 8. five looks ---------- */
const LOOKS = [['Paper', 6.6], ['Phosphor', 9.5], ['Blueprint', 12.5], ['Sunset', 15.4], ['Station', 18.3]] as const
const S8 = () => {
  const f = useCurrentFrame()
  const per = 18
  const i = Math.min(4, Math.floor(f / per))
  const l = f - i * per
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Sequence key={i} from={i * per} durationInFrames={per + 2}>
        <Clip src="v3/themes.mp4" from={LOOKS[i][1]} cam={[[0, 1.28, 960, 470], [0.6, 1.4, 960, 470]]} />
      </Sequence>
      <div style={{ position: 'absolute', left: 90, top: 100, background: C.signal, color: '#05070c', padding: '10px 26px', fontFamily: 'Barlow', fontWeight: 700, fontSize: 64, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: interpolate(l, [0, 4], [0, 1], clamp) }}>{LOOKS[i][0]}</div>
      <div style={{ position: 'absolute', right: 90, bottom: 110, background: '#05070c', padding: '18px 34px', fontFamily: 'Hanken', fontWeight: 900, fontSize: 80, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '-0.03em', color: C.ink, textAlign: 'right' }}>Five looks.<br /><span style={{ color: C.signal }}>One screen.</span></div>
      {l < 3 && <Fill style={{ background: BARS[i + 1], opacity: 0.4 * (1 - l / 3) }} />}
    </AbsoluteFill>
  )
}

/* ---------- 9. sign off ---------- */
const S9 = () => {
  const f = useCurrentFrame()
  const ring = useT(4, 36)
  const sq = useSlam(26, 10, 200)
  const bars = useT(70, 26)
  const url = useT(96, 16)
  const sh = useShake(26, 14)
  // the picture folds to a line and a dot
  const off = interpolate(f, [150, 163, 172, 180], [1, 0.006, 0.006, 0], { ...clamp, easing: Easing.bezier(0.7, 0, 0.3, 1) })
  const offx = interpolate(f, [166, 180], [1, 0.0, ], clamp)
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Fill style={{ background: C.ground, scale: `${f > 166 ? offx : 1} ${off}`, translate: `${sh.x}px ${sh.y}px` }}>
        <Dots opacity={0.3} />
        <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0 }}>
          <circle cx={960} cy={330} r={118} fill="none" stroke={C.ink} strokeWidth={22} strokeDasharray={`${ring * 741} 741`} transform="rotate(-100 960 330)" />
          <rect x={1028} y={196} width={74} height={74} fill={C.signal} style={{ transformOrigin: '1065px 233px', scale: `${sq}` }} />
        </svg>
        <Fill style={{ top: 470, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Hanken', fontWeight: 900, fontSize: 200, letterSpacing: '-0.04em', textTransform: 'uppercase', lineHeight: 1, color: C.ink, opacity: useT(22, 8), scale: `${1 + (1 - useSlam(22, 14, 170)) * 0.25}` }}>Friction</div>
          <div style={{ fontFamily: 'Hanken', fontSize: 50, color: C.ink, marginTop: 22, opacity: useT(48, 16) }}>Free. No account. Your data stays in your browser.</div>
          <div style={{ marginTop: 38, display: 'inline-block', background: C.signal, color: '#05070c', fontFamily: 'Unbounded', fontWeight: 700, fontSize: 52, padding: '20px 44px', opacity: url, scale: `${0.92 + 0.08 * url}` }}>frictionx.vercel.app</div>
          <div style={{ marginTop: 30 }}><Kicker size={32} color={C.ice} style={{ opacity: useT(118, 14) }}>Launching on Product Hunt</Kicker></div>
        </Fill>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 66 }}><div style={{ display: 'flex', width: '100%', height: 24 }}>{[...BARS.slice(0, 6), '#ff3b3b'].map((c, i) => <div key={c} style={{ flex: 1, background: c, scale: `${interpolate(bars, [i / 9, i / 9 + 0.4], [0, 1], clamp)} 1`, transformOrigin: 'left' }} />)}</div></div>
      </Fill>
      {f >= 150 && f < 176 && <Fill style={{ top: 538, height: 4, bottom: 'auto', background: '#fff', boxShadow: '0 0 30px 6px #fff', opacity: interpolate(f, [150, 160, 176], [0, 1, 0], clamp), left: `${(1 - (f > 166 ? offx : 1)) * 50}%`, right: `${(1 - (f > 166 ? offx : 1)) * 50}%` }} />}
    </AbsoluteFill>
  )
}

/* ---------- the cut list ---------- */
type Scene = { from: number; len: number; Comp: () => React.ReactElement; ch: string; name: string }
const SCENES: Scene[] = [
  { from: 0, len: 4, Comp: S1, ch: '00', name: 'Test' },
  { from: 4, len: 6, Comp: S2, ch: '01', name: 'Feed' },
  { from: 10, len: 6, Comp: S3, ch: '02', name: 'Friction' },
  { from: 16, len: 4, Comp: S4a, ch: '03', name: 'Focus' },
  { from: 20, len: 4, Comp: S4b, ch: '03', name: 'Lock in' },
  { from: 24, len: 6, Comp: S5, ch: '04', name: 'Tune in' },
  { from: 30, len: 4, Comp: S6, ch: '05', name: 'Study' },
  { from: 34, len: 4, Comp: S7, ch: '06', name: 'Debrief' },
  { from: 38, len: 3, Comp: S8, ch: '07', name: 'Looks' },
  { from: 41, len: 4, Comp: S9, ch: '99', name: 'Sign off' },
]

const Overlay = () => {
  const f = useCurrentFrame()
  const t = f / FPS
  const sc = SCENES.find((x) => t >= x.from && t < x.from + x.len) ?? SCENES[0]
  const hud = t >= 0.7
  return <>{hud && <HudBars ch={sc.ch} name={sc.name} />}</>
}
const HudBars = ({ ch, name }: { ch: string; name: string }) => {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Hud ch={ch} name={name} />
    </div>
  )
}

export const Ad = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {SCENES.map(({ from, len, Comp }) => (
      <Sequence key={from} from={s(from)} durationInFrames={s(len)} premountFor={20}><Comp /></Sequence>
    ))}
    <Overlay />
    <Grain />
    <Audio src={staticFile('score2.wav')} />
  </AbsoluteFill>
)
