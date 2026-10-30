import { Composition } from 'remotion'
import { Ad, FPS, TOTAL } from './Ad'

export const Root = () => <Composition id="Ad" component={Ad} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
