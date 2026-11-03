import { Audio, Sequence, staticFile } from 'remotion'
import { Fill, P, sec } from './kit'
import { Hook } from './Hook'
import { Title } from './Title'
import { World, WORLD_LEN } from './World'
import { Cta } from './Cta'

/** 19 bars at 100 bpm: every cut lands on a bar line */
export const TOTAL = sec(45.6)
export const T_TITLE = 9.6
export const T_WORLD = 14.4
export const T_CTA = T_WORLD + WORLD_LEN

export const Trailer = () => (
  <Fill style={{ background: P.deep }}>
    <Sequence from={0} durationInFrames={sec(T_TITLE)}><Hook /></Sequence>
    <Sequence from={sec(T_TITLE)} durationInFrames={sec(T_WORLD - T_TITLE)}><Title /></Sequence>
    <Sequence from={sec(T_WORLD)} durationInFrames={sec(WORLD_LEN)}><World /></Sequence>
    <Sequence from={sec(T_CTA)} durationInFrames={TOTAL - sec(T_CTA)}><Cta /></Sequence>
    <Audio src={staticFile('v4/score.wav')} />
  </Fill>
)
