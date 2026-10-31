import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { FPS, Fill, P, Snow, sec, whip } from './kit'
import { Hook, HOOK_FRAMES } from './Hook'
import { Title } from './Title'
import { AppScene, PRE } from './App'
import { AsciiWorld } from './AsciiWorld'
import { End, END_TOTAL } from './End'

/** the master clock, in seconds, of the cuts that matter (the score reads the same numbers) */
export const T = { world: 22.0, whipIn: 0.45, back: 27.4, backLen: 0.6, appEnd: 39.0 }
export const TOTAL = sec(T.appEnd + END_TOTAL)

/** the app and the ASCII world are two ends of one strip: the camera runs up it into the world and, later, back down */
const Elevator = ({ kind, children }: { kind: 'ui' | 'world'; children: React.ReactNode }) => {
  const f = useCurrentFrame() / FPS
  const up = whip((f - T.world) / T.whipIn), down = whip((f - T.back) / T.backLen)
  // ui: 0 -> +1080 going up, then 1080 -> 0 coming back; world: -1080 -> 0, then 0 -> -1080
  const p = f < T.back ? up.e : 1 - down.e
  const y = kind === 'ui' ? p * 1080 : (p - 1) * 1080
  const blur = f < T.back ? up.blur : down.blur
  return (
    <Fill style={{ transform: `translateY(${y}px)` }}>
      {blur > 0.4 && <svg width="0" height="0" style={{ position: 'absolute' }}><defs><filter id={`vb-${kind}`} x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation={`0 ${blur.toFixed(1)}`} /></filter></defs></svg>}
      <Fill style={{ filter: blur > 0.4 ? `url(#vb-${kind})` : undefined }}>{children}</Fill>
    </Fill>
  )
}

export const Trailer6 = () => (
  <AbsoluteFill style={{ background: P.deep }}>
    <Sequence from={0} durationInFrames={HOOK_FRAMES}><Hook /></Sequence>
    <Elevator kind="ui"><Sequence from={sec(13.0) - PRE} durationInFrames={sec(T.appEnd - 13.0) + PRE}><AppScene /></Sequence></Elevator>
    <Elevator kind="world"><Sequence from={sec(T.world)} durationInFrames={sec(T.back - T.world + T.backLen)}><AsciiWorld /></Sequence></Elevator>
    <Sequence from={sec(7.0)} durationInFrames={sec(6.0)}><Title /></Sequence>
    <Sequence from={sec(T.appEnd)} durationInFrames={sec(END_TOTAL)}><End /></Sequence>
    <Snow at={sec(6.76)} len={6} peak={0.6} />
    <Audio src={staticFile('v6/score.wav')} />
  </AbsoluteFill>
)
export { FPS }
