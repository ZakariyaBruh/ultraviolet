import { useId } from 'react'

/**
 * "Break the connection": a phone at the middle of a fire and smoke, its cable snapped, every notification and
 * app flying off it. Drawn as grainy flat shapes, after the screen-printed look of the reference. Fixed colours
 * on purpose: it is an illustration, and reads the same in every theme.
 */
const CORAL = '#f0806c'
const INK = '#07060d'
const BLUE = '#4a3fd9'
const BLUE_HI = '#7468f4'
const BLUE_LO = '#2b2296'
const CREAM = '#ece3d6'


/** A flame as a leaf with a leaning tip, so the fire reads as licking tongues and not zigzags. */
function flame(cx: number, base: number, h: number, w: number, lean: number) {
  const tx = cx + lean, ty = base - h
  return `M${cx - w} ${base} C${cx - w * 1.7} ${base - h * 0.5} ${cx + lean * 0.2 - w * 1.0} ${base - h * 0.72} ${tx} ${ty} C${cx + lean * 0.6 + w * 0.6} ${base - h * 0.64} ${cx + w * 1.7} ${base - h * 0.42} ${cx + w} ${base} Z`
}
const TONGUES: [number, number, number, number][] = [[250, 300, 70, -26], [305, 380, 62, 18], [360, 330, 66, -34], [420, 430, 60, 30], [470, 360, 68, -24], [520, 460, 62, 22], [575, 380, 66, -30], [630, 420, 62, 34], [685, 340, 66, -20], [735, 290, 62, 28], [780, 230, 54, -14]]
const DARK: [number, number, number, number][] = [[330, 230, 34, 20], [405, 270, 38, -22], [585, 260, 36, 26], [655, 220, 32, -18], [715, 190, 28, 14]]
const EMBERS: [number, number, number][] = [[280, 150, 4], [330, 110, 3], [610, 120, 5], [690, 90, 3], [760, 160, 4], [220, 220, 3], [820, 260, 4], [470, 70, 3], [540, 40, 4], [380, 60, 3]]

function Cloud({ x, y, r, s = 1 }: { x: number; y: number; r: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={-6} cy={8} r={r} fill={BLUE_LO} />
      <circle r={r} fill={BLUE} />
      <circle cx={r * 0.18} cy={-r * 0.2} r={r * 0.8} fill={BLUE_HI} opacity={0.55} />
      <circle cx={-r * 0.3} cy={r * 0.35} r={r * 0.5} fill={BLUE_LO} opacity={0.6} />
    </g>
  )
}

function Chip({ x, y, r, glyph, fill = '#3a2f8f', rot = 0 }: { x: number; y: number; r: number; glyph: 'heart' | 'bell' | 'chat' | 'badge' | 'play' | 'wifi'; fill?: string; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(1 0.78)`}>
      <ellipse cx={0} cy={r * 0.22} rx={r} ry={r} fill={INK} opacity={0.55} />
      <circle r={r} fill={fill} />
      <circle r={r * 0.82} fill="none" stroke={CREAM} strokeOpacity={0.45} strokeWidth={r * 0.1} strokeDasharray={`${r * 0.34} ${r * 0.2}`} />
      <g fill={CREAM} stroke="none">
        {glyph === 'heart' && <path d={`M0 ${r * 0.38} C ${-r * 0.7} -${r * 0.05} ${-r * 0.4} ${-r * 0.5} 0 ${-r * 0.2} C ${r * 0.4} ${-r * 0.5} ${r * 0.7} -${r * 0.05} 0 ${r * 0.38} Z`} fill="#ff7a95" />}
        {glyph === 'bell' && <path d={`M${-r * 0.35} ${r * 0.25} L${-r * 0.25} ${-r * 0.1} Q0 ${-r * 0.62} ${r * 0.25} ${-r * 0.1} L${r * 0.35} ${r * 0.25} Z M${-r * 0.1} ${r * 0.33} h${r * 0.2} v${r * 0.1} h${-r * 0.2} Z`} />}
        {glyph === 'chat' && <path d={`M${-r * 0.45} ${-r * 0.35} h${r * 0.9} v${r * 0.55} h${-r * 0.5} l${-r * 0.25} ${r * 0.25} v${-r * 0.25} h${-r * 0.15} Z`} />}
        {glyph === 'badge' && <text textAnchor="middle" y={r * 0.2} fontSize={r * 0.62} fontWeight={800} fontFamily="system-ui, sans-serif" fill={CORAL}>99+</text>}
        {glyph === 'play' && <path d={`M${-r * 0.22} ${-r * 0.35} L${r * 0.42} 0 L${-r * 0.22} ${r * 0.35} Z`} />}
        {glyph === 'wifi' && <path d={`M${-r * 0.5} ${-r * 0.1} Q0 ${-r * 0.6} ${r * 0.5} ${-r * 0.1} M${-r * 0.3} ${r * 0.1} Q0 ${-r * 0.2} ${r * 0.3} ${r * 0.1}`} fill="none" stroke={CREAM} strokeWidth={r * 0.12} strokeLinecap="round" />}
      </g>
    </g>
  )
}

function Tile({ x, y, s, rot, dots }: { x: number; y: number; s: number; rot: number; dots: number[][] }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-s / 2 + 3} y={-s / 2 + 5} width={s} height={s} rx={s * 0.2} fill={INK} opacity={0.5} />
      <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.2} fill={CREAM} />
      {dots.map(([dx, dy], i) => <circle key={i} cx={dx * s} cy={dy * s} r={s * 0.07} fill={BLUE_LO} />)}
    </g>
  )
}

function Gem({ x, y, s, rot = 0 }: { x: number; y: number; s: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M${-s} 0 L${-s * 0.5} ${-s * 0.6} H${s * 0.5} L${s} 0 L0 ${s} Z`} fill="#2fbf71" />
      <path d={`M${-s} 0 L${-s * 0.5} ${-s * 0.6} L0 0 Z M${s} 0 L${s * 0.5} ${-s * 0.6} L0 0 Z`} fill="#8fe8b5" opacity={0.8} />
      <path d={`M${-s} 0 L0 ${s} L0 0 Z`} fill="#16864a" opacity={0.7} />
    </g>
  )
}

export function PhoneBreak({ className, slice = false, label = 'A phone at the centre of a fire, its cable snapped and its notifications flying away' }: { className?: string; slice?: boolean; label?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 1000 560" preserveAspectRatio={slice ? 'xMidYMid slice' : 'xMidYMid meet'} role="img" aria-label={label} className={className}>
      <defs>
        <filter id={`g${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="9" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="9" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.95" result="a" />
          <feComposite in="d" in2="a" operator="in" />
        </filter>
        <clipPath id={`c${id}`}><rect width="1000" height="560" /></clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect width="1000" height="560" fill={INK} />

        {/* the dial behind it all: a wheel, half swallowed by the fire */}
        <g transform="translate(500 330)" opacity={0.9}>
          <circle r={236} fill="none" stroke={BLUE_LO} strokeWidth={26} />
          <circle r={236} fill="none" stroke={CREAM} strokeOpacity={0.35} strokeWidth={4} strokeDasharray="3 15.4" />
          <circle r={208} fill="none" stroke={BLUE} strokeWidth={3} />
          <circle r={262} fill="none" stroke={BLUE_HI} strokeOpacity={0.4} strokeWidth={2} />
          {Array.from({ length: 12 }, (_, i) => <path key={i} d="M0 -208 L0 -150" stroke={BLUE} strokeWidth={4} transform={`rotate(${i * 30})`} />)}
        </g>

        {/* fire */}
        <g filter={`url(#g${id})`}>
          <rect x={200} y={470} width={620} height={110} fill={CORAL} />
          {TONGUES.map(([x, h, w, l], i) => <path key={i} d={flame(x, 560, h, w, l)} fill={CORAL} />)}
          {TONGUES.map(([x, h, w, l], i) => <path key={i} d={flame(x + 6, 560, h * 0.68, w * 0.62, l * 0.6)} fill="#f59a85" />)}
          {TONGUES.filter((_, i) => i % 2 === 0).map(([x, h, w, l], i) => <path key={i} d={flame(x + 8, 560, h * 0.36, w * 0.34, l * 0.3)} fill="#ffd2bf" />)}
          {/* black tongues licking up out of the middle of it */}
          {DARK.map(([x, h, w, l], i) => <path key={i} d={flame(x, 560 - 40 * (i % 2), h, w, l)} fill={INK} />)}
        </g>
        {/* embers lifting off */}
        <g fill={CORAL} filter={`url(#g${id})`}>
          {EMBERS.map(([x, y, r], i) => <path key={i} d={`M${x} ${y - r * 3} L${x + r} ${y} L${x} ${y + r * 3} L${x - r} ${y} Z`} />)}
        </g>

        {/* smoke */}
        <g filter={`url(#g${id})`}>
          <Cloud x={20} y={470} r={120} />
          <Cloud x={150} y={540} r={110} />
          <Cloud x={40} y={330} r={90} />
          <Cloud x={300} y={560} r={100} />
          <Cloud x={520} y={600} r={110} />
          <Cloud x={700} y={570} r={100} />
          <Cloud x={880} y={520} r={120} />
          <Cloud x={990} y={400} r={110} />
          <Cloud x={940} y={300} r={80} />
        </g>

        {/* the phone */}
        <g transform="translate(500 318) rotate(-9) skewY(-5) scale(1.12)">
          <rect x={-72} y={-150} width={150} height={290} rx={26} fill="#0d0a22" />
          <rect x={-78} y={-156} width={150} height={290} rx={26} fill="#1c1648" stroke={BLUE_HI} strokeWidth={3} />
          <rect x={-66} y={-144} width={126} height={266} rx={18} fill={CORAL} />
          <rect x={-66} y={-144} width={126} height={110} rx={18} fill="#f59a85" opacity={0.5} />
          <rect x={-22} y={-138} width={34} height={8} rx={4} fill={INK} />
          {/* lock screen: a clock that has stopped, and notifications that will not deliver */}
          <rect x={-50} y={-100} width={94} height={12} rx={6} fill={INK} opacity={0.85} />
          <rect x={-50} y={-80} width={64} height={10} rx={5} fill={INK} opacity={0.55} />
          <rect x={-50} y={-30} width={94} height={30} rx={8} fill={INK} opacity={0.8} />
          <rect x={-50} y={10} width={94} height={30} rx={8} fill={INK} opacity={0.65} />
          <circle cx={-34} cy={-15} r={7} fill={CORAL} /><circle cx={-34} cy={25} r={7} fill="#ff7a95" />
          {/* the crack */}
          <path d="M60 -144 L28 -88 L44 -70 L8 -10 L22 6 L-14 70 L-2 84 L-30 122" fill="none" stroke={CREAM} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          <path d="M8 -10 L-36 -20 M22 6 L52 24 M-14 70 L-52 80" fill="none" stroke={CREAM} strokeWidth={2.5} strokeLinecap="round" />
          {/* port */}
          <rect x={-14} y={128} width={28} height={6} rx={3} fill={INK} />
        </g>

        {/* the cable, snapped */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M486 462 C470 500 430 506 396 520" stroke={CREAM} strokeWidth={8} />
          <path d="M396 520 l-10 6 M396 520 l-12 -4 M396 520 l-6 12" stroke={CREAM} strokeWidth={3} />
        </g>
        <g transform="translate(690 470) rotate(24)">
          <path d="M-60 -46 C-34 -30 -20 -10 0 0" fill="none" stroke={CREAM} strokeWidth={8} strokeLinecap="round" />
          <rect x={0} y={-12} width={40} height={24} rx={6} fill={CREAM} />
          <rect x={40} y={-8} width={14} height={5} fill={CREAM} /><rect x={40} y={3} width={14} height={5} fill={CREAM} />
        </g>
        {/* the spark where it broke */}
        <g transform="translate(404 516)">
          <path d="M0 -26 L6 -8 L24 -14 L10 0 L26 10 L6 8 L0 28 L-6 8 L-24 12 L-10 -2 L-22 -16 L-6 -8 Z" fill="#ffd24a" />
          <path d="M0 -14 L3 -4 L13 -6 L5 1 L0 12 L-3 3 L-12 4 L-5 -2 Z" fill={CREAM} />
        </g>

        {/* the glass, falling */}
        <g fill={CREAM} opacity={0.9}>
          <path d="M452 350 l14 -6 l-4 16 Z" /><path d="M560 420 l18 4 l-12 10 Z" /><path d="M430 300 l10 -10 l2 14 Z" /><path d="M590 250 l12 -4 l-6 14 Z" />
        </g>
        {/* notifications thrown off the screen */}
        <g transform="translate(610 240) rotate(18)"><rect x={-44} y={-12} width={88} height={24} rx={8} fill={CREAM} /><circle cx={-30} cy={0} r={6} fill={CORAL} /><rect x={-18} y={-5} width={48} height={5} rx={2.5} fill={INK} opacity={0.7} /><rect x={-18} y={3} width={32} height={4} rx={2} fill={INK} opacity={0.4} /></g>
        <g transform="translate(402 232) rotate(-16)"><rect x={-40} y={-11} width={80} height={22} rx={7} fill={CREAM} /><circle cx={-27} cy={0} r={5} fill="#ff7a95" /><rect x={-16} y={-4} width={44} height={5} rx={2.5} fill={INK} opacity={0.7} /><rect x={-16} y={3} width={28} height={4} rx={2} fill={INK} opacity={0.4} /></g>
        {/* speed lines behind the chips */}
        <g stroke={BLUE_HI} strokeWidth={3} strokeLinecap="round" opacity={0.5}>
          <path d="M330 262 l-46 22 M350 284 l-30 12" /><path d="M606 164 l40 -18 M680 244 l40 -8" /><path d="M745 346 l36 10" />
        </g>

        {/* everything leaving */}
        <Chip x={300} y={250} r={36} glyph="heart" fill="#33297f" rot={-14} />
        <Chip x={352} y={170} r={26} glyph="bell" fill="#2b2296" rot={10} />
        <Chip x={240} y={380} r={42} glyph="chat" fill="#3a2f8f" rot={-8} />
        <Chip x={196} y={300} r={20} glyph="play" fill="#4a3fd9" rot={6} />
        <Chip x={640} y={150} r={40} glyph="badge" fill="#7a2f58" rot={12} />
        <Chip x={720} y={230} r={24} glyph="wifi" fill="#2b2296" rot={-10} />
        <Chip x={770} y={336} r={30} glyph="bell" fill="#33297f" rot={16} />
        <Chip x={560} y={90} r={18} glyph="heart" fill="#4a3fd9" rot={-6} />
        <Tile x={820} y={170} s={36} rot={14} dots={[[-0.2, -0.2], [0.2, 0.2], [0, 0]]} />
        <Tile x={686} y={330} s={30} rot={-22} dots={[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]} />
        <Tile x={400} y={110} s={22} rot={-18} dots={[[-0.2, -0.2], [0.2, 0.2]]} />
        <Gem x={330} y={440} s={22} rot={-12} />
        <Gem x={806} y={410} s={16} rot={20} />
        <Gem x={455} y={170} s={12} rot={8} />
      </g>
    </svg>
  )
}
