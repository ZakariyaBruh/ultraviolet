import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { E, FPS, Fill, P, Snow, clamp, sec } from './kit'
import { Hook, HOOK_FRAMES } from './Hook'
import { Title } from './Title'
import { AppScene, BarsWipe, PRE } from './App'
import { AsciiWorld } from './AsciiWorld'
import { End, END_TOTAL } from './End'
import { LockSegment, LOCK_S } from './LockSegment'

/** the master clock, in seconds, of the cuts that matter (the score reads the same numbers) */
export const T = { world: 22.0, whipIn: 0.45, back: 27.4, backLen: 0.6, appEnd: 37.0, lockEnd: 41.0 }
export const TOTAL = sec(T.lockEnd + END_TOTAL)

/** the text world rises on the black glass the camera has just flown over, and leaves behind the colour bars */
const WorldIn = ({ children }: { children: React.ReactNode }) => {
  const t = useCurrentFrame() / FPS
  const p = interpolate(t, [0, 0.25], [0, 1], { ...clamp, easing: E.out })
  return <Fill style={{ opacity: p, transform: `scale(${1.1 - 0.1 * p})` }}>{children}</Fill>
}

export const Trailer6 = () => (
  <AbsoluteFill style={{ background: P.deep }}>
    <Sequence from={0} durationInFrames={HOOK_FRAMES}><Hook /></Sequence>
    <Sequence from={sec(13.0) - PRE} durationInFrames={sec(T.appEnd - 13.0) + PRE}><AppScene /></Sequence>
    <Sequence from={sec(T.world)} durationInFrames={sec(T.back + 0.4 - T.world)}><WorldIn><AsciiWorld /></WorldIn></Sequence>
    <BarsWipe at={T.back} />
    <Sequence from={sec(7.0)} durationInFrames={sec(6.0)}><Title /></Sequence>
    <Sequence from={sec(T.appEnd)} durationInFrames={sec(LOCK_S)}><LockSegment /></Sequence>
    <Sequence from={sec(T.lockEnd)} durationInFrames={sec(END_TOTAL)}><End /></Sequence>
    <Snow at={sec(6.76)} len={6} peak={0.6} />
    <Snow at={sec(33.0)} len={5} peak={0.75} />
    <Audio src={staticFile('v6/score.wav')} />
  </AbsoluteFill>
)
export { FPS }
