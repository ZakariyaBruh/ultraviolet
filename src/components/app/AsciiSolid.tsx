import { useEffect, useRef } from 'react'

const RAMP = ' .,-~:;=!*#$@'

/** A 3D torus drawn in text. Spin speed follows `speed`; reduced motion draws one frame. */
export function AsciiSolid({ cols = 44, rows = 22, speed = 1, still = false, className = '' }: { cols?: number; rows?: number; speed?: number; still?: boolean; className?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const spd = useRef(speed)
  spd.current = speed
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let A = 1.1
    let B = 0.4
    let raf = 0
    let last = 0
    const frame = () => {
      const out = new Array<string>(cols * rows).fill(' ')
      const z = new Array<number>(cols * rows).fill(0)
      const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B)
      const K2 = 5
      const K1 = (cols * K2 * 3) / (8 * 3.2)
      for (let th = 0; th < TAU; th += 0.07) {
        const cT = Math.cos(th), sT = Math.sin(th)
        for (let ph = 0; ph < TAU; ph += 0.03) {
          const cP = Math.cos(ph), sP = Math.sin(ph)
          const cx = 2 + cT
          const cy = sT
          const x = cx * (cB * cP + sA * sB * sP) - cy * cA * sB
          const y = cx * (sB * cP - sA * cB * sP) + cy * cA * cB
          const zz = K2 + cA * cx * sP + cy * sA
          const ooz = 1 / zz
          const xp = Math.floor(cols / 2 + K1 * ooz * x)
          const yp = Math.floor(rows / 2 - K1 * ooz * y * 0.5)
          const L = cP * cT * sB - cA * cT * sP - sA * sT + cB * (cA * sT - cT * sA * sP)
          if (L > 0 && xp >= 0 && xp < cols && yp >= 0 && yp < rows) {
            const o = xp + yp * cols
            if (ooz > z[o]) {
              z[o] = ooz
              out[o] = RAMP[Math.min(RAMP.length - 1, Math.floor(L * 8))]
            }
          }
        }
      }
      let s = ''
      for (let r = 0; r < rows; r++) s += out.slice(r * cols, (r + 1) * cols).join('') + '\n'
      el.textContent = s
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 24) return
      const dt = last ? (now - last) / 1000 : 0
      last = now
      A += 0.9 * spd.current * dt
      B += 0.5 * spd.current * dt
      frame()
    }
    frame()
    if (!still) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [cols, rows, still])
  return <pre ref={ref} aria-hidden className={`m-0 select-none font-mono leading-[1] ${className}`} />
}

const TAU = Math.PI * 2
