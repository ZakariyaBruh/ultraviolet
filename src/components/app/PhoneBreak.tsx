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
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.05" result="a" />
          <feComposite in="d" in2="a" operator="in" />
        </filter>
        <clipPath id={`c${id}`}><rect width="1000" height="560" /></clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect width="1000" height="560" fill={INK} />

        {/* fire */}
        <g filter={`url(#g${id})`}>
          <path d="M215 570 L238 430 L268 380 L300 400 L330 300 L368 318 L398 232 L430 276 L470 168 L508 262 L546 180 L582 270 L622 212 L652 300 L700 262 L722 360 L772 384 L792 570 Z" fill={CORAL} />
          <path d="M330 560 L350 420 L388 440 L412 330 L452 400 L488 300 L526 392 L562 320 L596 410 L640 380 L660 560 Z" fill="#f59a85" opacity={0.7} />
          {/* black tongues coming down out of the dark */}
          <path d="M300 150 H430 L418 190 L400 230 L384 100 L366 190 L344 120 L326 80 Z" fill={INK} />
          <path d="M520 150 H690 L668 200 L652 250 L630 70 L606 150 L584 90 L560 40 Z" fill={INK} />
          <path d="M700 230 H800 L790 280 L770 90 L752 180 L730 100 Z" fill={INK} />
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
        <g transform="translate(500 322) rotate(-9) skewY(-5)">
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
