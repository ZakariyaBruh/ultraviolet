import hanken from '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?inline'
import unbounded from '@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2?inline'
import geistMono from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?inline'
import barlow600 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?inline'
import barlow700 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?inline'
import dela from '@fontsource/dela-gothic-one/files/dela-gothic-one-latin-400-normal.woff2?inline'

/**
 * The app's own faces, as data, for the sandboxed demo frame. The frame is not allowed to fetch anything, so a demo could never
 * load a font by itself; these @font-face rules carry them in the page instead. This file is only loaded when an AI generated demo is
 * about to be shown, so it costs nothing until then.
 */
const face = (family: string, src: string, weight: string) => `@font-face{font-family:"${family}";src:url(${src}) format("woff2");font-weight:${weight};font-style:normal;font-display:block}`

export const FACES = [
  face('Hanken Grotesk Variable', hanken, '100 900'),
  face('Unbounded Variable', unbounded, '200 900'),
  face('Geist Mono Variable', geistMono, '100 900'),
  face('Barlow Condensed', barlow600, '600'),
  face('Barlow Condensed', barlow700, '700'),
  face('Dela Gothic One', dela, '400'),
].join('')
