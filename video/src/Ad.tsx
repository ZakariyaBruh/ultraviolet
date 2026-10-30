import type React from 'react'
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame } from 'remotion'
import { BARS, Bars, C, clamp, Dots, Fill, Grain, IN, Kicker, OUT, Screen, Slam, useShake, useSlam, useT, Vignette } from './ui'

export const FPS = 30
export const TOTAL = 1350
const s = (n: number) => Math.round(n * FPS)

/* ---------- 1. the feed: it never stops ---------- */
const Feed = () => {
  const f = useCurrentFrame()
  const speed = interpolate(f, [0, 120], [6, 140], { ...clamp, easing: IN })
  const y = (f * (f + 30) * 0.05 * speed) / 12
  const rows = Array.from({ length: 40 }, (_, i) => i)
  const stretch = interpolate(speed, [6, 140], [1, 2.6], clamp)
  return (
    <Fill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 560, width: 800, top: 0, translate: `0 ${-(y % 360)}px`, scale: `1 ${stretch}` }}>
        {rows.map((i) => {
          const w = 0.4 + random(`w${i}`) * 0.5
          return (
            <div key={i} style={{ height: 320, marginBottom: 40, border: '2px solid #2f3a52', background: '#141b2a', padding: 28, display: 'flex', gap: 24 }}>
              <div style={{ width: 84, height: 84, borderRadius: 84, background: '#3a4560' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 22, width: `${w * 100}%`, background: '#3a4560', marginBottom: 18 }} />
                <div style={{ height: 22, width: '90%', background: '#222c42', marginBottom: 14 }} />
                <div style={{ height: 22, width: '70%', background: '#222c42', marginBottom: 14 }} />
                <div style={{ height: 120, width: '100%', background: '#1b2437' }} />
              </div>
            </div>
          )
        })}
      </div>
    </Fill>
  )
}

const S1 = () => {
  const f = useCurrentFrame()
  const a = useT(6, 14)
  const b = useT(30, 14)
  const cut = f > 112
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Dots />
      {f > 44 && <Feed />}
      <Fill style={{ background: f > 44 ? 'rgba(5,7,12,0.4)' : 'transparent' }} />
      <Fill style={{ left: 120, top: 330 }}>
        <div style={{ fontFamily: 'Hanken', fontWeight: 300, fontSize: 84, color: C.ink, opacity: a * (f > 44 ? 0.9 : 1), translate: `0 ${(1 - a) * 30}px` }}>You opened it for one thing.</div>
        <div style={{ fontFamily: 'Hanken', fontWeight: 300, fontSize: 84, color: C.ink, opacity: b, translate: `0 ${(1 - b) * 30}px`, marginTop: 14 }}>
          Forty minutes later, you&rsquo;re still <span style={{ color: C.signal, fontWeight: 800 }}>scrolling.</span>
        </div>
      </Fill>
      {cut && <Fill style={{ background: C.ground }} />}
    </AbsoluteFill>
  )
}

/* ---------- 2. the slam ---------- */
const S2 = () => {
  const f = useCurrentFrame()
  const sh = useShake(3, 26)
  const sh2 = useShake(26, 22)
  const sh3 = useShake(50, 34)
  const bars = useT(52, 26)
  const u = useT(56, 14)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Dots opacity={0.25} />
      <Fill style={{ translate: `${sh.x + sh2.x + sh3.x}px ${sh.y + sh2.y + sh3.y}px`, rotate: `${sh.r + sh2.r + sh3.r}rad` }}>
        <Fill style={{ left: 130, top: 190 }}>
          <Slam words={['Scrolling']} at={3} size={250} />
          <Slam words={['has', 'no']} at={26} size={250} gap={4} style={{ marginTop: 10 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 30 }}>
            <Slam words={['friction.']} at={50} size={250} accent={[0]} style={{ marginTop: 10 }} />
          </div>
          <div style={{ height: 14, marginTop: 30, width: 1100 * u, background: C.signal }} />
        </Fill>
      </Fill>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><Bars progress={bars} height={22} /></div>
      {f > 78 && <Fill style={{ background: C.ground, opacity: interpolate(f, [78, 88], [0, 1], clamp) }} />}
    </AbsoluteFill>
  )
}

/* ---------- 3. the landing ---------- */
const S3 = () => {
  const f = useCurrentFrame()
  const z = interpolate(f, [0, 150], [1.18, 1], { ...clamp, easing: OUT })
  const t = useT(14, 16)
  const k = useT(40, 24)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Fill style={{ scale: `${z}`, transformOrigin: '70% 45%' }}>
        <OffthreadVideo src={staticFile('clips/landing.mp4')} startFrom={s(3.4)} muted style={{ width: 1920, height: 1080 }} />
      </Fill>
      <Fill style={{ left: 120, top: 118, opacity: t, translate: `0 ${(1 - t) * -20}px` }}>
        <Kicker size={30}>Meet Friction</Kicker>
        <div style={{ fontFamily: 'Hanken', fontWeight: 800, fontSize: 62, lineHeight: 1.05, color: C.ink, marginTop: 14, width: 760, textShadow: '0 4px 30px #000' }}>
          A focus timer that counts every time you leave.
        </div>
      </Fill>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}><Bars progress={k} height={10} /></div>
      <Vignette />
    </AbsoluteFill>
  )
}

/* ---------- 4. one screen, locked in ---------- */
const Callout = ({ at, side, children, sub }: { at: number; side: 'l' | 'r'; children: string; sub?: string }) => {
  const t = useT(at, 18)
  return (
    <div style={{ position: 'absolute', [side === 'l' ? 'left' : 'right']: 90, width: 540, opacity: t, translate: `${(1 - t) * (side === 'l' ? -80 : 80)}px 0` }}>
      <div style={{ height: 6, width: 90, background: C.signal, marginBottom: 18 }} />
      <div style={{ fontFamily: 'Hanken', fontWeight: 900, fontSize: 64, lineHeight: 1, textTransform: 'uppercase', color: C.ink, letterSpacing: '-0.02em' }}>{children}</div>
      {sub && <div style={{ fontFamily: 'Hanken', fontWeight: 400, fontSize: 30, color: C.dim, marginTop: 14, lineHeight: 1.25 }}>{sub}</div>}
    </div>
  )
}
const S4 = () => {
  const f = useCurrentFrame()
  const rise = useT(0, 28)
  const rot = interpolate(f, [0, 180], [-22, -8], { ...clamp, easing: OUT })
  const sc = interpolate(f, [0, 180], [0.58, 0.68], clamp)
  const shake = useShake(112, 20)
  const drift = useSlam(112, 9, 220)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Dots opacity={0.3} />
      <Fill style={{ perspective: 2400 }}>
        <Screen style={{ left: 0, top: 0, scale: `${sc}`, rotate: `${shake.r}rad`, transform: `rotateY(${rot}deg)`, translate: `${330 + shake.x}px ${(1 - rise) * 600 + shake.y + 40}px`, transformOrigin: '50% 50%', opacity: rise, boxShadow: '0 60px 160px rgba(0,0,0,0.7)' }}>
          <OffthreadVideo src={staticFile('clips/lock.mp4')} startFrom={s(1.5)} muted style={{ width: 1920, height: 1080 }} />
        </Screen>
      </Fill>
      <div style={{ position: 'absolute', top: 110 }}><Callout at={26} side="l" sub="Pick a length. Lock in.">One screen.</Callout></div>
      <div style={{ position: 'absolute', top: 380 }}><Callout at={52} side="l" sub="No feed. No infinite page.">Nothing scrolls.</Callout></div>
      <div style={{ position: 'absolute', top: 660, left: 90, width: 560, opacity: useT(104, 8), scale: `${interpolate(drift, [0, 1], [1.4, 1])}`, transformOrigin: 'left top' }}>
        <div style={{ background: C.signal, color: '#05070c', padding: '18px 26px', fontFamily: 'Barlow', fontWeight: 700, fontSize: 40, letterSpacing: '0.2em', textTransform: 'uppercase', display: 'inline-block' }}>Drift +1</div>
        <div style={{ fontFamily: 'Hanken', fontWeight: 900, fontSize: 52, textTransform: 'uppercase', lineHeight: 1, marginTop: 20, color: C.ink, letterSpacing: '-0.02em' }}>Every time you leave is counted.</div>
        <div style={{ fontFamily: 'Hanken', fontSize: 30, color: C.dim, marginTop: 14 }}>Six seconds away, and the numbers never lie.</div>
      </div>
      <Vignette />
    </AbsoluteFill>
  )
}

/* ---------- 5. tune in ---------- */
const TUNE = [
  { img: 'radio', label: 'Radio', note: 'Every station in the directory' },
  { img: 'tv', label: 'Live TV', note: 'Public channels from iptv-org' },
  { img: 'podcasts', label: 'Podcasts', note: 'Any show in Apple Podcasts' },
  { img: 'music', label: 'Songs', note: 'Whole tracks, no account' },
]
const S5 = () => {
  const f = useCurrentFrame()
  const per = 45
  const idx = Math.min(TUNE.length - 1, Math.floor(f / per))
  const local = f - idx * per
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Dots opacity={0.25} />
      {TUNE.map((t, i) => {
        const at = i * per
        const x = interpolate(f, [at - 4, at + 14, at + per - 8, at + per + 6], [1900, 0, 0, -1900], { ...clamp, easing: OUT })
        const z = interpolate(f, [at, at + per], [1.0, 1.12], clamp)
        const tilt = interpolate(f, [at - 4, at + 14, at + per - 8, at + per + 6], [-12, 0, 0, 12], clamp)
        if (f < at - 6 || f > at + per + 8) return null
        return (
          <Fill key={t.img} style={{ perspective: 2200 }}>
            <Screen style={{ left: 0, top: 0, scale: `${0.68 * z}`, translate: `${x + 300}px 110px`, transform: `rotateY(${tilt}deg)`, transformOrigin: '50% 50%', boxShadow: '0 60px 140px rgba(0,0,0,0.8)' }}>
              <Img src={staticFile(`shots/${t.img}.png`)} style={{ width: 1920, height: 1080 }} />
            </Screen>
          </Fill>
        )
      })}
      <Fill style={{ left: 130, top: 92 }}>
        <Kicker size={30}>Tune in, stay put</Kicker>
        <div key={idx} style={{ fontFamily: 'Hanken', fontWeight: 900, fontSize: 130, textTransform: 'uppercase', letterSpacing: '-0.03em', lineHeight: 0.95, color: C.ink, opacity: interpolate(local, [0, 8], [0, 1], clamp), translate: `0 ${interpolate(local, [0, 12], [30, 0], { ...clamp, easing: OUT })}px` }}>{TUNE[idx].label}</div>
      </Fill>
      <Fill style={{ left: 130, top: 232, opacity: interpolate(local, [10, 22], [0, 1], clamp) }}>
        <div style={{ fontFamily: 'Hanken', fontSize: 32, color: C.dim, width: 480, lineHeight: 1.25 }}>{TUNE[idx].note}. One player, on every screen.</div>
      </Fill>
      <Vignette />
    </AbsoluteFill>
  )
}

/* ---------- 6. learn, and the study windows ---------- */
const S6 = () => {
  const f = useCurrentFrame()
  const a = f < 75
  const z = interpolate(f, [0, 75], [1.0, 1.2], clamp)
  const z2 = interpolate(f, [75, 150], [1.12, 1.0], clamp)
  const sub = useT(30, 16)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      {a ? (
        <>
          <Fill style={{ scale: `${z}`, transformOrigin: '30% 40%' }}><Img src={staticFile('shots/learn.png')} style={{ width: 1920, height: 1080 }} /></Fill>
          <Fill style={{ background: 'rgba(5,7,12,0.6)' }} />
          <Fill style={{ left: 130, top: 360 }}>
            <Kicker size={30}>Learn</Kicker>
            <Slam words={['Lessons', 'from', 'Wikipedia.']} at={4} size={150} gap={5} accent={[2]} />
            <div style={{ fontFamily: 'Hanken', fontSize: 40, color: C.ink, marginTop: 24, opacity: sub }}>Built by fixed rules. <b style={{ color: C.signal }}>No AI writes them.</b></div>
          </Fill>
        </>
      ) : (
        <>
          <Fill style={{ scale: `${z2}`, transformOrigin: '20% 50%' }}>
            <OffthreadVideo src={staticFile('clips/widgets.mp4')} startFrom={s(2.2)} muted style={{ width: 1920, height: 1080 }} />
          </Fill>
          <Fill style={{ left: 0, right: 0, bottom: 0, height: 360, background: 'linear-gradient(transparent, rgba(5,7,12,0.92))' }} />
          <Fill style={{ left: 130, bottom: 90 }}>
            <Kicker size={30}>Study windows</Kicker>
            <Slam words={['Notepad.', 'Timer.', 'Calculator.']} at={78} size={110} gap={6} accent={[2]} />
          </Fill>
        </>
      )}
      <Vignette />
    </AbsoluteFill>
  )
}

/* ---------- 7. credits ---------- */
const S7 = () => {
  const f = useCurrentFrame()
  const a = f < 80
  const score = Math.round(interpolate(f, [8, 62], [0, 76], { ...clamp, easing: OUT }))
  const z = interpolate(f, [0, 80], [1.0, 1.35], clamp)
  const z2 = interpolate(f, [80, 150], [1.05, 1.0], clamp)
  const sub = useT(104, 14)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      {a ? (
        <>
          <Fill style={{ scale: `${z}`, transformOrigin: '12% 34%' }}><Img src={staticFile('shots/debrief.png')} style={{ width: 1920, height: 1080 }} /></Fill>
          <Fill style={{ background: 'rgba(5,7,12,0.62)' }} />
          <Fill style={{ left: 1010, top: 150 }}>
            <Kicker size={30}>Focus pays</Kicker>
            <Slam words={['Earn', 'credits.']} at={2} size={118} gap={6} accent={[1]} />
            <div style={{ fontFamily: 'Unbounded', fontWeight: 800, fontSize: 230, color: C.signal, lineHeight: 1, marginTop: 20 }}>{score}<span style={{ fontSize: 80, color: C.dim }}> /100</span></div>
            <div style={{ fontFamily: 'Hanken', fontSize: 32, color: C.ink, marginTop: 6, width: 800 }}>Your day, scored from your own numbers. No AI.</div>
          </Fill>
        </>
      ) : (
        <>
          <Fill style={{ scale: `${z2}`, transformOrigin: '50% 30%' }}><Img src={staticFile('shots/arcade.png')} style={{ width: 1920, height: 1080 }} /></Fill>
          <Fill style={{ background: 'rgba(5,7,12,0.5)' }} />
          <Fill style={{ left: 130, top: 640 }}>
            <Kicker size={30}>Then spend them</Kicker>
            <Slam words={['Games.', 'Breaks.']} at={84} size={170} gap={8} accent={[1]} />
            <div style={{ fontFamily: 'Hanken', fontSize: 34, color: C.ink, opacity: sub, marginTop: 18 }}>A game can never win you any. Credits come from focus only.</div>
          </Fill>
        </>
      )}
      <Vignette />
    </AbsoluteFill>
  )
}

/* ---------- 8. five looks ---------- */
const LOOKS = [
  { img: 'focus', name: 'Station' }, { img: 'theme-paper', name: 'Paper' }, { img: 'theme-phosphor', name: 'Phosphor' }, { img: 'theme-blueprint', name: 'Blueprint' }, { img: 'theme-sunset', name: 'Sunset' },
]
const S8 = () => {
  const f = useCurrentFrame()
  const per = 24
  const idx = Math.min(LOOKS.length - 1, Math.floor(f / per))
  const local = f - idx * per
  const z = interpolate(local, [0, per], [1.08, 1.0], clamp)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Fill style={{ scale: `${z}` }}><Img src={staticFile(`shots/${LOOKS[idx].img}.png`)} style={{ width: 1920, height: 1080 }} /></Fill>
      <Fill style={{ left: 90, top: 70 }}>
        <div style={{ background: C.signal, color: '#05070c', padding: '10px 22px', fontFamily: 'Barlow', fontWeight: 700, fontSize: 44, letterSpacing: '0.22em', textTransform: 'uppercase', display: 'inline-block' }}>{LOOKS[idx].name}</div>
      </Fill>
      <Fill style={{ right: 90, bottom: 150, textAlign: 'right', opacity: useT(2, 10) }}>
        <div style={{ background: C.ground, padding: '26px 38px', fontFamily: 'Hanken', fontWeight: 900, fontSize: 90, textTransform: 'uppercase', color: C.ink, letterSpacing: '-0.03em', lineHeight: 1, display: 'inline-block' }}>Five looks.<br /><span style={{ color: C.signal }}>One screen.</span></div>
      </Fill>
      {local < 3 && <Fill style={{ background: BARS[idx + 1], opacity: 0.5 * (1 - local / 3) }} />}
    </AbsoluteFill>
  )
}

/* ---------- 9. the end ---------- */
const S9 = () => {
  const f = useCurrentFrame()
  const ring = useT(4, 40)
  const sq = useSlam(30, 10, 200)
  const bars = useT(60, 30)
  const url = useT(86, 20)
  const sh = useShake(30, 14)
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Dots opacity={0.3} />
      <Fill style={{ translate: `${sh.x}px ${sh.y}px` }}>
        <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0 }}>
          <circle cx={960} cy={330} r={120} fill="none" stroke={C.ink} strokeWidth={22} strokeDasharray={`${ring * 754} 754`} transform="rotate(-100 960 330)" strokeLinecap="butt" />
          <rect x={1030} y={190} width={76} height={76} fill={C.signal} transform={`scale(${sq})`} style={{ transformOrigin: '1068px 228px' }} />
        </svg>
        <Fill style={{ top: 480, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Hanken', fontWeight: 900, fontSize: 210, color: C.ink, letterSpacing: '-0.04em', textTransform: 'uppercase', lineHeight: 1, opacity: useT(20, 10), scale: `${interpolate(useSlam(20, 14, 160), [0, 1], [1.25, 1])}` }}>Friction</div>
          <div style={{ fontFamily: 'Hanken', fontWeight: 400, fontSize: 52, color: C.ink, marginTop: 24, opacity: useT(46, 16) }}>Free. No account. Your data stays in your browser.</div>
          <div style={{ marginTop: 44, display: 'inline-block', background: C.signal, color: '#05070c', fontFamily: 'Unbounded', fontWeight: 700, fontSize: 54, padding: '22px 44px', opacity: url, scale: `${interpolate(url, [0, 1], [0.9, 1])}` }}>frictionx.vercel.app</div>
          <div style={{ marginTop: 34 }}><Kicker size={34} color={C.ice} style={{ opacity: useT(110, 16) }}>Launching on Product Hunt</Kicker></div>
        </Fill>
      </Fill>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><Bars progress={bars} height={26} /></div>
      {f > 168 && <Fill style={{ background: '#000', opacity: interpolate(f, [168, 180], [0, 1], clamp) }} />}
    </AbsoluteFill>
  )
}

/* a flash on every cut, in the signal yellow */
const Flash = ({ at }: { at: number }) => {
  const f = useCurrentFrame()
  const o = interpolate(f, [at, at + 1, at + 7], [0, 0.55, 0], clamp)
  return o > 0 ? <Fill style={{ background: C.signal, opacity: o, mixBlendMode: 'screen' }} /> : null
}

const CUTS = [4, 7, 12, 18, 24, 29, 34, 39]
const SCENES: [number, number, () => React.ReactElement][] = [
  [0, 4, S1], [4, 7, S2], [7, 12, S3], [12, 18, S4], [18, 24, S5], [24, 29, S6], [29, 34, S7], [34, 39, S8], [39, 45, S9],
]

export const Ad = () => (
  <AbsoluteFill style={{ background: C.ground }}>
    {SCENES.map(([a, b, Comp]) => (
      <Sequence key={a} from={s(a)} durationInFrames={s(b - a)} premountFor={30}><Comp /></Sequence>
    ))}
    {CUTS.map((c) => <Sequence key={c} from={s(c)} durationInFrames={10}><Flash at={0} /></Sequence>)}
    <Grain />
    <Audio src={staticFile('score.wav')} />
  </AbsoluteFill>
)
