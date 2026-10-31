import { Composition } from 'remotion'
import { Ad, FPS, TOTAL } from './Ad'
import { Trailer, TOTAL as T4 } from './v4/Trailer'
import { FPS as F4 } from './v4/kit'
import { Trailer6, TOTAL as T6, FPS as F6 } from './v6/Trailer6'

export const Root = () => (
  <>
    <Composition id="Trailer" component={Trailer} durationInFrames={T4} fps={F4} width={1920} height={1080} />
    <Composition id="V6" component={Trailer6} durationInFrames={T6} fps={F6} width={1920} height={1080} />
    <Composition id="Ad" component={Ad} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
  </>
)
