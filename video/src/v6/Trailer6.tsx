import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion'
import { FPS, P, sec } from './kit'
import { Hook, HOOK_FRAMES } from './Hook'
import { Title } from './Title'
import { AppScene, PRE } from './App'
import { End, END_TOTAL } from './End'

export const TOTAL = sec(35.0 + END_TOTAL)

export const Trailer6 = () => (
  <AbsoluteFill style={{ background: P.deep }}>
    <Sequence from={0} durationInFrames={HOOK_FRAMES}><Hook /></Sequence>
    <Sequence from={sec(13.0) - PRE} durationInFrames={sec(22.0) + PRE}><AppScene /></Sequence>
    <Sequence from={sec(7.0)} durationInFrames={sec(6.0)}><Title /></Sequence>
    <Sequence from={sec(35.0)} durationInFrames={sec(END_TOTAL)}><End /></Sequence>
    <Audio src={staticFile('v6/score.wav')} />
  </AbsoluteFill>
)
export { FPS }
