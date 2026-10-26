import type { ComponentType } from 'react'
import type { DemoProps } from './kit'
import { Cipher, Control, Dilemma, Doubling, Growth, Perspective, Reaction, Roman, Scales } from './mind'
import { Climate, Coin, Herd, Light, Orbit, Selection, Slit } from './science'

/** the interactive demos a lesson can carry, by id */
export const DEMOS: Record<string, ComponentType<DemoProps>> = {
  cipher: Cipher, orbit: Orbit, selection: Selection, coin: Coin, dilemma: Dilemma, light: Light, scales: Scales, slit: Slit,
  control: Control, herd: Herd, reaction: Reaction, perspective: Perspective, roman: Roman, doubling: Doubling, growth: Growth, climate: Climate,
}

/** which demo suits a lesson, chosen by what its title is about; none when nothing fits */
const RULES: [RegExp, keyof typeof DEMOS][] = [
  [/black hole|gravit|orbit|planet|solar system|galax|neutron star|supernova|astronom/i, 'orbit'],
  [/cipher|cryptograph|encrypt|enigma|cryptanaly/i, 'cipher'],
  [/\bevolution\b|natural selection|darwin|adaptation|genetic/i, 'selection'],
  [/probabilit|statistic|law of large|coin flip/i, 'coin'],
  [/game theory|prisoner|nash equilibrium|cooperation/i, 'dilemma'],
  [/photosynth|chlorophyll|\bplants?\b|botany/i, 'light'],
  [/\bmusic|\bscales?\b|harmony|\bchords?\b|melody|rhythm/i, 'scales'],
  [/quantum|double-slit|wave.particle|photon|electron/i, 'slit'],
  [/stoic|epictetus|marcus aurelius|seneca/i, 'control'],
  [/immune|vaccin|epidemic|pandemic|virus|infectious|measles|influenza|covid/i, 'herd'],
  [/neuroscien|\bbrain\b|neuron|reflex|nervous system/i, 'reaction'],
  [/renaissance|linear perspective|brunelleschi|leonardo/i, 'perspective'],
  [/\broman\b|\brome\b|\blatin\b|caesar/i, 'roman'],
  [/egypt|pharaoh|pyramid|\bnile\b/i, 'doubling'],
  [/industrial revolution|economic growth|capitalis|factory/i, 'growth'],
  [/climate|global warming|greenhouse|carbon dioxide/i, 'climate'],
]
export const demoFor = (title: string): string | null => RULES.find(([re]) => re.test(title))?.[1] ?? null

export function Demo({ id, played }: { id: string } & DemoProps) {
  const C = DEMOS[id]
  return C ? <C played={played} /> : null
}
