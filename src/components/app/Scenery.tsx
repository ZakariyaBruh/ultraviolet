import { useMemo } from 'react'
import type { ThemeId } from '@/lib/themes'

/**
 * The picture behind the panels for the supporter themes (see themes.css). Drawn once from a fixed seed, so it is the same every visit,
 * from the theme's own tokens, so an accent or background the person picked still colours it. Nothing here moves except the sky in
 * Observatory, and that stops under calm motion and prefers-reduced-motion. These replace the contour field for those themes (every
 * supporter theme has one: see Backdrop).
 */
const rng = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const mixc = (c: string, pct: number, into = 'var(--ground)') => `color-mix(in srgb, ${c} ${pct}%, ${into})`

export function Scenery({ theme, level }: { theme: ThemeId; level: 0 | 1 | 2 }) {
  switch (theme) {
    case 'library': return <Library />
    case 'observatory': return <Observatory turning={level >= 1} />
    case 'mono': return <Mono />
    case 'receipt': return <Receipt />
    case 'chalkboard': return <Chalk />
    default: return null
  }
}

/* ───────── Library: a lattice wall and, at the foot, the shelf the nav stands on ───────── */

const TILE_W = 1200
const SHELF_H = 88
const BOARD = 8

function Library() {
  const books = useMemo(() => {
    // tonal leather, never bright: the wall's own colour lifted a little, some warmer and some cooler, so that the shelf reads as books and not as colour
    const spines = [mixc('var(--hot)', 15), mixc('var(--hot)', 10), mixc('var(--signal)', 12), mixc('var(--ink)', 9), mixc('var(--ok)', 9), mixc('var(--ice)', 9)]
    const out: { x: number; y: number; w: number; h: number; fill: string; band: number; plate: boolean }[] = []
    const r = rng(31)
    let x = 0
    while (x < TILE_W) {
      let w = 13 + Math.floor(r() * 18)
      if (TILE_W - x - w < 13) w = TILE_W - x
      const h = 40 + Math.floor(r() * 36)
      out.push({ x, y: SHELF_H - BOARD - h, w, h, fill: spines[Math.floor(r() * spines.length)], band: Math.floor(r() * 3), plate: r() < 0.5 })
      x += w
    }
    return out
  }, [])
  return (
    <>
      {/* the wall: binding cloth with a small diamond lattice, very quiet */}
      <svg className="absolute inset-0 size-full" aria-hidden focusable="false">
        <defs>
          <pattern id="lib-lattice" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M24 0 48 24 24 48 0 24Z" fill="none" style={{ stroke: 'var(--brass)', strokeOpacity: 0.07 }} />
            <path d="M24 20 28 24 24 28 20 24Z" style={{ fill: 'var(--brass)', fillOpacity: 0.1 }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lib-lattice)" />
      </svg>
      {/* the shelf at the foot of the screen, with the nav and the player standing in front of it */}
      <svg className="absolute inset-x-0 bottom-0 w-full" height={SHELF_H} aria-hidden focusable="false">
        <defs>
          <pattern id="lib-books" width={TILE_W} height={SHELF_H} patternUnits="userSpaceOnUse">
            {books.map((b) => (
              <g key={b.x}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} style={{ fill: b.fill }} />
                <rect x={b.x} y={b.y} width={1.5} height={b.h} style={{ fill: 'var(--ink)', opacity: 0.07 }} />
                <rect x={b.x + b.w - 1} y={b.y} width={1} height={b.h} style={{ fill: 'var(--ground)', opacity: 0.6 }} />
                {b.band > 0 && <rect x={b.x} y={b.y + 8} width={b.w} height={2} style={{ fill: 'var(--brass)', opacity: 0.42 }} />}
                {b.band === 2 && <rect x={b.x} y={b.y + 13} width={b.w} height={1} style={{ fill: 'var(--brass)', opacity: 0.28 }} />}
                {b.plate && <rect x={b.x + b.w * 0.22} y={b.y + b.h * 0.36} width={b.w * 0.56} height={Math.min(26, b.h * 0.28)} style={{ fill: 'var(--brass)', opacity: 0.2 }} />}
                {b.band > 0 && <rect x={b.x} y={b.y + b.h - 10} width={b.w} height={2} style={{ fill: 'var(--brass)', opacity: 0.36 }} />}
              </g>
            ))}
            <rect x={0} y={SHELF_H - BOARD} width={TILE_W} height={BOARD} style={{ fill: 'var(--ground)' }} />
            <rect x={0} y={SHELF_H - BOARD} width={TILE_W} height={2} style={{ fill: 'var(--brass)', opacity: 0.45 }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lib-books)" />
      </svg>
    </>
  )
}

/* ───────── Observatory: a turning star chart ───────── */

const CONS: { name: string; at: [number, number]; rot: number; s: number; pts: [number, number][]; lines: [number, number][]; label: [number, number] }[] = [
  { name: 'Ursa Major', at: [-560, -560], rot: -14, s: 1.5, label: [60, 150], pts: [[0, 0], [-10, 60], [100, 80], [110, 20], [200, -5], [290, -40], [390, -20]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
  { name: 'Cassiopeia', at: [330, -720], rot: 6, s: 1.7, label: [50, 120], pts: [[0, 40], [60, 0], [120, 50], [180, 10], [235, 55]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'Orion', at: [-420, 140], rot: -8, s: 1.55, label: [-20, 200], pts: [[-30, -110], [130, -100], [45, -130], [0, 0], [45, 12], [90, 24], [-10, 140], [125, 150], [50, 60], [52, 92]], lines: [[0, 3], [1, 5], [0, 1], [3, 4], [4, 5], [3, 6], [5, 7], [4, 8], [8, 9], [2, 0], [2, 1]] },
  { name: 'Cygnus', at: [330, 250], rot: 18, s: 1.5, label: [30, 290], pts: [[0, 0], [50, 110], [100, 230], [-80, 100], [180, 125]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] },
  { name: 'Lyra', at: [-60, -330], rot: 4, s: 1.4, label: [-10, 150], pts: [[0, 0], [20, 52], [72, 62], [62, 112], [12, 102]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]] },
  { name: 'Leo', at: [120, 620], rot: -10, s: 1.5, label: [100, 150], pts: [[0, 0], [40, -40], [100, -50], [150, -10], [140, 50], [60, 60], [230, 70], [300, 40]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [4, 6], [6, 7]] },
]
const BRIGHT: { name: string; x: number; y: number }[] = [
  { name: 'Vega', x: -700, y: -40 }, { name: 'Rigel', x: -250, y: 420 }, { name: 'Capella', x: 640, y: -360 },
  { name: 'Altair', x: 620, y: 560 }, { name: 'Sirius', x: -620, y: 560 }, { name: 'Polaris', x: 20, y: -80 },
]

function Observatory({ turning }: { turning: boolean }) {
  const stars = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 360 }, () => {
      const rad = 940 * Math.sqrt(r())
      const a = r() * Math.PI * 2
      const pick = r()
      return { x: Math.cos(a) * rad, y: Math.sin(a) * rad, r: 0.7 + r() ** 6 * 3, o: 0.2 + r() * 0.6, fill: pick < 0.14 ? 'var(--signal)' : pick < 0.3 ? 'var(--ice)' : 'var(--ink)' }
    })
  }, [])
  const ring = (r: number, len: number, count: number, w: number, o: number) => (
    <circle r={r} fill="none" strokeWidth={len} strokeDasharray={`${w} ${(2 * Math.PI * r) / count - w}`} style={{ stroke: 'var(--ice)', opacity: o }} />
  )
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <svg className={turning ? 'obs-turn' : ''} viewBox="-1000 -1000 2000 2000" focusable="false" style={{ position: 'absolute', left: '64%', top: '60%', width: '150vmax', height: '150vmax', translate: '-50% -50%' }}>
        <g fill="none" style={{ stroke: 'var(--ice)' }}>
          <circle r="975" strokeWidth="1.5" opacity=".55" />
          <circle r="905" strokeWidth="1" opacity=".4" />
          <circle r="700" strokeWidth="1" opacity=".26" strokeDasharray="2 10" />
          <circle r="500" strokeWidth="1" opacity=".26" />
          <circle r="300" strokeWidth="1" opacity=".26" strokeDasharray="2 10" />
          <circle r="120" strokeWidth="1" opacity=".3" />
          {Array.from({ length: 24 }, (_, i) => <line key={i} x1="0" y1="-120" x2="0" y2="-905" transform={`rotate(${i * 15})`} strokeWidth="1" opacity={i % 6 === 0 ? 0.3 : 0.12} />)}
        </g>
        {ring(940, 30, 360, 1.6, 0.42)}
        {ring(932, 20, 72, 2, 0.55)}
        {ring(926, 14, 36, 2.6, 0.7)}
        <g style={{ fill: 'var(--ice)', fontFamily: 'var(--font-cond)', letterSpacing: '4px' }} fontSize="26" textAnchor="middle" opacity=".7">
          {Array.from({ length: 12 }, (_, i) => <text key={i} transform={`rotate(${i * 30}) translate(0 -860)`}>{i * 30}°</text>)}
        </g>
        <ellipse rx="700" ry="260" transform="rotate(-24) translate(0 90)" fill="none" strokeWidth="1.4" strokeDasharray="14 10" style={{ stroke: 'var(--signal)', opacity: 0.4 }} />
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} style={{ fill: s.fill, opacity: s.o }} />)}
        {CONS.map((c) => (
          <g key={c.name} transform={`translate(${c.at[0]} ${c.at[1]}) rotate(${c.rot}) scale(${c.s})`}>
            {c.lines.map(([a, b], i) => <line key={i} x1={c.pts[a][0]} y1={c.pts[a][1]} x2={c.pts[b][0]} y2={c.pts[b][1]} strokeWidth="1.2" style={{ stroke: 'var(--ice)', opacity: 0.5 }} />)}
            {c.pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 ? 4.6 : 3.2} style={{ fill: 'var(--signal)', opacity: 0.85 }} />)}
            <text x={c.label[0]} y={c.label[1]} fontSize="22" style={{ fill: 'var(--ice)', opacity: 0.7, fontFamily: 'var(--font-dot)', fontStyle: 'italic', letterSpacing: '1px' }}>{c.name}</text>
          </g>
        ))}
        {BRIGHT.map((b) => (
          <g key={b.name} transform={`translate(${b.x} ${b.y})`}>
            <line x1="-16" x2="16" strokeWidth="1" style={{ stroke: 'var(--signal)', opacity: 0.7 }} />
            <line y1="-16" y2="16" strokeWidth="1" style={{ stroke: 'var(--signal)', opacity: 0.7 }} />
            <circle r="4.2" style={{ fill: 'var(--signal)' }} />
            <text x="14" y="30" fontSize="20" style={{ fill: 'var(--ink)', opacity: 0.6, fontFamily: 'var(--font-dot)', fontStyle: 'italic', letterSpacing: '1px' }}>{b.name}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ───────── Mono: a twelve column grid under one huge outlined word ───────── */

function Mono() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="mono-cols absolute inset-0" />
      <div className="mono-word l">Friction</div>
      <div className="mono-word r">Stay put</div>
    </div>
  )
}

/* ───────── Receipt: a grey counter with a paper tape down one side ───────── */

function Receipt() {
  const bars = useMemo(() => {
    const r = rng(3)
    const out: { y: number; h: number; w: number }[] = []
    let y = 104
    while (y < 244) { const h = 2 + Math.floor(r() * 4); out.push({ y, h, w: 34 + Math.floor(r() * 3) * 6 }); y += h + 2 + Math.floor(r() * 4) }
    return out
  }, [])
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="rc-speck absolute inset-0" />
      <svg className="absolute hidden md:block" focusable="false" style={{ right: 10, top: 74, rotate: '1.6deg', transformOrigin: '50% 0' }} width="78" height="1500" viewBox="0 0 78 1500">
        <path d={`M0 7 ${Array.from({ length: 13 }, (_, i) => `L${i * 6 + 3} ${i % 2 ? 7 : 0}`).join(' ')} L78 7 V1500 H0 Z`} style={{ fill: 'var(--surface)' }} />
        {Array.from({ length: 61 }, (_, i) => <g key={i}><circle cx="6" cy={24 + i * 24} r="2.5" style={{ fill: 'var(--ground)' }} /><circle cx="72" cy={24 + i * 24} r="2.5" style={{ fill: 'var(--ground)' }} /></g>)}
        <text x="39" y="40" textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--ink)', fontFamily: 'var(--font-dot)', letterSpacing: '2px' }}>FRICTION</text>
        <line x1="12" x2="66" y1="56" y2="56" strokeDasharray="3 3" style={{ stroke: 'var(--ink)', opacity: 0.5 }} />
        <text x="39" y="78" textAnchor="middle" fontSize="9" style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-dot)', letterSpacing: '1px' }}>STAY PUT</text>
        {bars.map((b, i) => <rect key={i} x={39 - b.w / 2} y={b.y} width={b.w} height={b.h} style={{ fill: 'var(--ink)' }} />)}
        <line x1="12" x2="66" y1="268" y2="268" strokeDasharray="3 3" style={{ stroke: 'var(--ink)', opacity: 0.5 }} />
        {[330, 700, 1070].map((y) => (
          <text key={y} transform={`translate(44 ${y}) rotate(90)`} fontSize="11" style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-dot)', letterSpacing: '3px' }}>THANK YOU FOR STAYING * THANK YOU</text>
        ))}
        <g transform="translate(39 1260) rotate(-8)">
          <rect x="-26" y="-14" width="52" height="28" fill="none" strokeWidth="2" style={{ stroke: 'var(--hot)' }} />
          <text textAnchor="middle" y="5" fontSize="13" fontWeight="700" style={{ fill: 'var(--hot)', fontFamily: 'var(--font-dot)', letterSpacing: '2px' }}>HELD</text>
        </g>
      </svg>
    </div>
  )
}

/* ───────── Chalkboard: dust and doodles in the margins ───────── */

/** a hand-drawn closed or open line through points, each one nudged a little, drawn with smooth curves */
function chalk(pts: [number, number][], seed: number, jitter = 1.6, close = false): string {
  const r = rng(seed)
  const p = pts.map(([x, y]) => [x + (r() - 0.5) * jitter * 2, y + (r() - 0.5) * jitter * 2])
  const n = p.length
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`
  for (let i = 1; i < n + (close ? 1 : 0); i++) {
    const a = p[(i - 1) % n], b = p[i % n]
    const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * jitter, my = (a[1] + b[1]) / 2 + (r() - 0.5) * jitter
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`
  }
  return d
}
const circle = (cx: number, cy: number, rad: number, seed: number) => chalk(Array.from({ length: 11 }, (_, i) => [cx + Math.cos((i / 10) * Math.PI * 2) * rad, cy + Math.sin((i / 10) * Math.PI * 2) * rad] as [number, number]), seed, rad * 0.05)
const star = (cx: number, cy: number, rad: number, seed: number) => chalk(Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const k = i % 2 ? rad * 0.45 : rad; return [cx + Math.cos(a) * k, cy + Math.sin(a) * k] as [number, number] }), seed, 1.2, true)

function Chalk() {
  const stroke = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2.4 } as const
  const hand = { fontFamily: 'var(--font-dot)' } as const
  // laid out for a 1600 x 900 board: on a 1440 wide screen the margins are x 80 to 180 on the left and 1420 to 1520 on the right
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="chalk-dust absolute inset-0" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g {...stroke} style={{ stroke: 'var(--ink)', opacity: 0.26 }}>
          {/* a lightbulb */}
          <path d={circle(130, 392, 24, 1)} />
          <path d={chalk([[120, 416], [121, 430], [140, 430], [141, 416]], 2, 1.1)} />
          <path d={chalk([[121, 437], [140, 437]], 3, 0.8)} />
          <path d={chalk([[130, 350], [130, 338]], 4, 0.8)} /><path d={chalk([[100, 364], [92, 356]], 5, 0.8)} /><path d={chalk([[160, 364], [168, 356]], 6, 0.8)} />
          {/* an hourglass */}
          <path d={chalk([[1448, 452], [1500, 452]], 7, 1)} /><path d={chalk([[1448, 540], [1500, 540]], 8, 1)} />
          <path d={chalk([[1454, 452], [1454, 468], [1474, 496], [1454, 524], [1454, 540]], 9, 1.2)} />
          <path d={chalk([[1494, 452], [1494, 468], [1474, 496], [1494, 524], [1494, 540]], 10, 1.2)} />
          {/* a graph that climbs */}
          <path d={chalk([[96, 596], [96, 700], [176, 700]], 11, 1.2)} />
          <path d={chalk([[104, 684], [124, 670], [142, 652], [158, 638], [172, 614]], 12, 1.4)} />
          <path d={chalk([[162, 612], [173, 610], [172, 624]], 13, 0.8)} />
          {/* a checklist */}
          <path d={chalk([[1438, 612], [1456, 612], [1456, 630], [1438, 630], [1438, 612]], 14, 0.9)} /><path d={chalk([[1442, 622], [1447, 627], [1457, 608]], 15, 0.8)} />
          <path d={chalk([[1438, 652], [1456, 652], [1456, 670], [1438, 670], [1438, 652]], 16, 0.9)} /><path d={chalk([[1442, 662], [1447, 667], [1457, 648]], 17, 0.8)} />
          <path d={chalk([[1468, 622], [1512, 620]], 18, 1.2)} /><path d={chalk([[1468, 662], [1504, 660]], 19, 1.2)} />
        </g>
        <g {...stroke} style={{ stroke: 'var(--signal)', opacity: 0.34 }}>
          <path d={circle(1470, 100, 20, 20)} />
          {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <path key={i} d={chalk([[1470 + Math.cos(a) * 30, 100 + Math.sin(a) * 30], [1470 + Math.cos(a) * 44, 100 + Math.sin(a) * 44]], 30 + i, 0.8)} /> })}
          <path d={star(130, 250, 16, 40)} /><path d={star(1466, 280, 14, 41)} /><path d={star(114, 520, 11, 42)} /><path d={star(1500, 740, 12, 43)} />
        </g>
        <g {...stroke} style={{ stroke: 'var(--ice)', opacity: 0.32 }}>
          <path d={chalk([[1440, 360], [1470, 354], [1500, 362]], 50, 1.2)} />
          <path d={chalk([[1440, 372], [1494, 374]], 51, 1.2)} />
        </g>
        <g style={{ fill: 'var(--ink)', opacity: 0.28, ...hand }} fontSize="26">
          <text transform="translate(92 804) rotate(3)">E = mc²</text>
          <text transform="translate(1432 812) rotate(-4)">π r²</text>
        </g>
      </svg>
    </div>
  )
}
