import { useMemo } from 'react'
import { P } from './kit'

/** The dial, drawn as vectors so it stays sharp at any zoom (the dive goes through it) and so the lighting can stay still while it turns.
 *  1000 x 1000 units, centre at 500. Outer knurl 480, body 470, rubber insert 300, grooves at 225 and 147, pointer from 63 to 284.
 *  `deg` is its angle, `travel` is how many degrees it covers during the shutter (for the blur). */
const TEETH = 96
export const Dial = ({ size, deg = 0, travel = 0, style }: { size: number; deg?: number; travel?: number; style?: React.CSSProperties }) => {
  const teeth = useMemo(() => {
    let d = ''
    for (let i = 0; i < TEETH; i++) {
      const a0 = (i / TEETH) * 2 * Math.PI, a1 = ((i + 0.5) / TEETH) * 2 * Math.PI, a2 = ((i + 1) / TEETH) * 2 * Math.PI
      const p = (a: number, r: number) => `${(500 + Math.sin(a) * r).toFixed(1)} ${(500 - Math.cos(a) * r).toFixed(1)}`
      d += `${i === 0 ? 'M' : 'L'}${p(a0, 464)} L${p(a1, 480)} L${p(a2, 464)} `
    }
    return d + 'Z'
  }, [])
  const blur = Math.min(1, Math.max(0, (travel - 2) / 8))
  const copies = travel > 3 ? Math.min(18, Math.ceil(travel / 3)) : 1
  const pointer = (a: number, alpha: number, k: number) => (
    <rect key={k} x={483} y={216} width={34} height={221} rx={2} fill="#ffe08a" opacity={alpha} transform={`rotate(${a} 500 500)`} />
  )
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} style={{ overflow: 'visible', display: 'block', ...style }}>
      <defs>
        <radialGradient id="dbody" cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffe879" />
          <stop offset="0.55" stopColor="#f6c52a" />
          <stop offset="1" stopColor="#e5a812" />
        </radialGradient>
        <linearGradient id="dins" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#16253a" />
          <stop offset="0.6" stopColor="#0a111c" />
          <stop offset="1" stopColor="#070b12" />
        </linearGradient>
        <filter id="dsoft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7" /></filter>
        <clipPath id="dclip"><circle cx="500" cy="500" r="470" /></clipPath>
        <linearGradient id="dspec" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={`rotate(${deg} 500 500)`}>
        <circle cx="500" cy="500" r="466" fill="url(#dbody)" />
        <path d={teeth} fill="#f2bd1d" opacity={1 - blur * 0.5} />
        {blur > 0 && <circle cx="500" cy="500" r="472" fill="none" stroke="#f2bd1d" strokeWidth="16" opacity={blur * 0.55} />}
      </g>
      <circle cx="500" cy="500" r="466" fill="none" stroke="#fff3b0" strokeWidth="3" opacity="0.5" />
      <circle cx="500" cy="500" r="300" fill="url(#dins)" stroke="#c78f10" strokeWidth="5" />
      <circle cx="500" cy="500" r="225" fill="none" stroke="#04070c" strokeWidth="7" opacity="0.9" />
      <circle cx="500" cy="500" r="225" fill="none" stroke="#2a3a52" strokeWidth="2" opacity="0.7" transform="translate(1.5 2)" />
      <circle cx="500" cy="500" r="147" fill="none" stroke="#04070c" strokeWidth="7" opacity="0.9" />
      <circle cx="500" cy="500" r="147" fill="none" stroke="#2a3a52" strokeWidth="2" opacity="0.7" transform="translate(1.5 2)" />
      {Array.from({ length: copies }, (_, k) => pointer(deg - (travel * k) / Math.max(1, copies - 1) + travel / 2, copies > 1 ? Math.max(0.12, 1.15 / copies) : 1, k))}
      {/* the light stays where it is while the dial turns */}
      <g clipPath="url(#dclip)" style={{ mixBlendMode: 'screen' }} filter="url(#dsoft)">
        <polygon points="640,860 760,760 930,880 770,990" fill="url(#dspec)" opacity="0.38" />
        <polygon points="40,520 420,960 330,990 20,640" fill="url(#dspec)" opacity="0.2" />
        <path d="M130 360 A395 395 0 0 1 400 120" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" opacity="0.28" />
      </g>
      <circle cx="500" cy="500" r="470" fill="none" stroke={P.ground} strokeWidth="2" opacity="0.5" />
    </svg>
  )
}
