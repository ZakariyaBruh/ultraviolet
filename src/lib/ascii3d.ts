/**
 * Solids drawn in text. A shape is a cloud of points with normals; drawing one turns it, projects every point, keeps the
 * nearest in each cell (a z-buffer) and lights it from one side. The result is a grid of brightness values (0 to 1) that a
 * <pre> or a canvas turns into characters. The same engine draws the dial, the page headers and the backdrop scene.
 */
export type Shape = 'torus' | 'sphere' | 'cube' | 'knot' | 'helix' | 'pyramid'
export const SHAPES: Shape[] = ['torus', 'sphere', 'cube', 'knot', 'helix', 'pyramid']
export const SHAPE_NAME: Record<Shape, string> = { torus: 'Donut', sphere: 'Globe', cube: 'Cube', knot: 'Trefoil knot', helix: 'Double helix', pyramid: 'Pyramid' }

/** dark to bright: seventeen steps, ordered by how much ink each mark really has in the mono face, so a lit curve shades smoothly instead of in bands */
export const RAMP = ' .,-~;!=*+?%#@&$WM'

interface Cloud { n: number; p: Float32Array; q: Float32Array; rad: number }
type V = [number, number, number]

const TAU = Math.PI * 2
const norm = (v: V): V => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function build(list: { p: V; n: V }[]): Cloud {
  const p = new Float32Array(list.length * 3)
  const q = new Float32Array(list.length * 3)
  let rad = 0
  list.forEach((pt, i) => { p.set(pt.p, i * 3); q.set(norm(pt.n), i * 3); rad = Math.max(rad, Math.hypot(...pt.p)) })
  return { n: list.length, p, q, rad }
}

/** a tube of the given radius around a curve, with the frame taken from the curve's own bend */
function tube(at: (t: number) => V, t0: number, t1: number, steps: number, r: number, sides: number): { p: V; n: V }[] {
  const out: { p: V; n: V }[] = []
  const e = 1e-3
  for (let i = 0; i < steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps
    const c = at(t), a = at(t + e), b = at(t - e)
    const T = norm([a[0] - b[0], a[1] - b[1], a[2] - b[2]])
    const acc: V = [a[0] + b[0] - 2 * c[0], a[1] + b[1] - 2 * c[1], a[2] + b[2] - 2 * c[2]]
    let N = norm(acc)
    if (Math.hypot(...acc) < 1e-9) N = norm(cross(T, [0, 0, 1]))
    const B = cross(T, N)
    for (let j = 0; j < sides; j++) {
      const u = (j / sides) * TAU
      const cu = Math.cos(u), su = Math.sin(u)
      const n: V = [N[0] * cu + B[0] * su, N[1] * cu + B[1] * su, N[2] * cu + B[2] * su]
      out.push({ p: [c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r], n })
    }
  }
  return out
}

const face = (o: V, du: V, dv: V, n: V, k: number): { p: V; n: V }[] => {
  const out: { p: V; n: V }[] = []
  for (let i = 0; i <= k; i++) for (let j = 0; j <= k; j++) {
    const u = i / k * 2 - 1, v = j / k * 2 - 1
    out.push({ p: [o[0] + du[0] * u + dv[0] * v, o[1] + du[1] * u + dv[1] * v, o[2] + du[2] * u + dv[2] * v], n })
  }
  return out
}

/** points along an edge. A zero normal means "always bright", so edges stay crisp whatever the light does. */
const edge = (a: V, b: V, k: number): { p: V; n: V }[] => Array.from({ length: k + 1 }, (_, i) => { const t = i / k; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as V, n: [0, 0, 0] as V } })

const make: Record<Shape, (q: number) => Cloud> = {
  torus: (q) => {
    const list: { p: V; n: V }[] = []
    for (let th = 0; th < TAU; th += 0.07 / q) for (let ph = 0; ph < TAU; ph += 0.03 / q) {
      const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph)
      list.push({ p: [(2 + ct) * cp, st, (2 + ct) * sp], n: [ct * cp, st, ct * sp] })
    }
    return build(list)
  },
  sphere: (q) => {
    const list: { p: V; n: V }[] = []
    for (let la = -Math.PI / 2; la <= Math.PI / 2; la += 0.05 / q) {
      const cl = Math.cos(la), sl = Math.sin(la)
      for (let lo = 0; lo < TAU; lo += (0.05 / q) / Math.max(0.15, cl)) list.push({ p: [1.9 * cl * Math.cos(lo), 1.9 * sl, 1.9 * cl * Math.sin(lo)], n: [cl * Math.cos(lo), sl, cl * Math.sin(lo)] })
    }
    return build(list)
  },
  cube: (q) => {
    const h = 1.5, k = Math.round(34 * q)
    return build([
      ...face([0, 0, h], [h, 0, 0], [0, h, 0], [0, 0, 1], k), ...face([0, 0, -h], [h, 0, 0], [0, h, 0], [0, 0, -1], k),
      ...face([h, 0, 0], [0, 0, h], [0, h, 0], [1, 0, 0], k), ...face([-h, 0, 0], [0, 0, h], [0, h, 0], [-1, 0, 0], k),
      ...face([0, h, 0], [h, 0, 0], [0, 0, h], [0, 1, 0], k), ...face([0, -h, 0], [h, 0, 0], [0, 0, h], [0, -1, 0], k),
      ...[-h, h].flatMap((a) => [-h, h].flatMap((b) => [edge([-h, a, b], [h, a, b], k), edge([a, -h, b], [a, h, b], k), edge([a, b, -h], [a, b, h], k)].flat())),
    ])
  },
  knot: (q) => build(tube((t) => [0.62 * (Math.sin(t) + 2 * Math.sin(2 * t)), 0.62 * (Math.cos(t) - 2 * Math.cos(2 * t)), 0.62 * -Math.sin(3 * t)], 0, TAU, Math.round(420 * q), 0.5, Math.round(16 * q))),
  helix: (q) => {
    const strand = (off: number) => tube((t) => [1.15 * Math.cos(t + off), t * 0.34 - 2.1, 1.15 * Math.sin(t + off)], 0, 12.2, Math.round(260 * q), 0.28, Math.round(10 * q))
    const rungs: { p: V; n: V }[] = []
    for (let t = 0.4; t < 12; t += 0.9) for (let s = -1; s <= 1; s += 0.06 / q) rungs.push({ p: [1.15 * Math.cos(t) * s, t * 0.34 - 2.1, 1.15 * Math.sin(t) * s], n: [Math.cos(t + 1.57), 0.3, Math.sin(t + 1.57)] })
    return build([...strand(0), ...strand(Math.PI), ...rungs])
  },
  pyramid: (q) => {
    const k = Math.round(34 * q)
    const list: { p: V; n: V }[] = []
    const apex: V = [0, 1.9, 0], b = 1.7, y = -1.2
    const corners: V[] = [[-b, y, -b], [b, y, -b], [b, y, b], [-b, y, b]]
    for (let s = 0; s < 4; s++) {
      const a = corners[s], c = corners[(s + 1) % 4]
      const n = norm(cross([c[0] - a[0], c[1] - a[1], c[2] - a[2]], [apex[0] - a[0], apex[1] - a[1], apex[2] - a[2]]))
      for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) {
        const u = i / k, v = j / k, w = 1 - u - v
        list.push({ p: [a[0] * w + c[0] * u + apex[0] * v, a[1] * w + c[1] * u + apex[1] * v, a[2] * w + c[2] * u + apex[2] * v], n: [-n[0], -n[1], -n[2]] })
      }
    }
    list.push(...face([0, y, 0], [b, 0, 0], [0, 0, b], [0, -1, 0], k))
    for (let s = 0; s < 4; s++) list.push(...edge(corners[s], corners[(s + 1) % 4], k), ...edge(corners[s], apex, k))
    return build(list)
  },
}

const clouds = new Map<string, Cloud>()
const cloudOf = (shape: Shape, q: number) => {
  const key = `${shape}:${q}`
  let c = clouds.get(key)
  if (!c) { c = make[shape](q); clouds.set(key, c) }
  return c
}

/** `aspect` is a character cell's width over its height, so round things stay round */
export interface Grid { cols: number; rows: number; aspect: number; lum: Float32Array; z: Float32Array }
export const makeGrid = (cols: number, rows: number, aspect = 0.5): Grid => ({ cols, rows, aspect, lum: new Float32Array(cols * rows).fill(-1), z: new Float32Array(cols * rows) })
export const clearGrid = (g: Grid) => { g.lum.fill(-1); g.z.fill(0) }

const LIGHT = norm([-0.45, 0.7, -0.75])
const D = 6

/**
 * How many points a solid needs so no cell is left empty: the bigger it is on the grid, the more it takes. Steps of a half, so
 * only a few clouds are ever built and kept.
 */
export const density = (size: number) => Math.min(2.5, Math.max(1, Math.round(size / 9) / 2))

/**
 * Draws one solid into the grid. (cx, cy) is its centre in cells, `size` is how many columns its widest reach covers either
 * side of the centre; a, b, c are its turns about the three axes. `dense` overrides how many points are drawn, which otherwise
 * follows `size` (a finer grid has bigger solids in cells, so it needs more points).
 */
export function plot(g: Grid, shape: Shape, cx: number, cy: number, size: number, a: number, b: number, c = 0, dense = density(size)) {
  const cl = cloudOf(shape, dense)
  const S = (size * D) / cl.rad
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c)
  // rotation: about x by a, then y by b, then z by c
  const m00 = cb * cc, m01 = -cb * sc, m02 = sb
  const m10 = ca * sc + sa * sb * cc, m11 = ca * cc - sa * sb * sc, m12 = -sa * cb
  const m20 = sa * sc - ca * sb * cc, m21 = sa * cc + ca * sb * sc, m22 = ca * cb
  const { p, q, n } = cl
  for (let i = 0; i < n; i++) {
    const i3 = i * 3
    const qx = q[i3], qy = q[i3 + 1], qz = q[i3 + 2]
    const flat = qx === 0 && qy === 0 && qz === 0
    // the way a point faces comes first: the half that faces away is dropped before any of the rest is worked out
    const nz = m20 * qx + m21 * qy + m22 * qz
    if (!flat && nz > 0.35) continue
    const x0 = p[i3], y0 = p[i3 + 1], z0 = p[i3 + 2]
    const z = m20 * x0 + m21 * y0 + m22 * z0
    const ooz = 1 / (D + z)
    const xp = Math.round(cx + S * ooz * (m00 * x0 + m01 * y0 + m02 * z0))
    const yp = Math.round(cy - S * ooz * (m10 * x0 + m11 * y0 + m12 * z0) * g.aspect)
    if (xp < 0 || xp >= g.cols || yp < 0 || yp >= g.rows) continue
    const o = xp + yp * g.cols
    if (ooz <= g.z[o]) continue
    g.z[o] = ooz
    if (flat) { g.lum[o] = 1; continue }
    const nx = m00 * qx + m01 * qy + m02 * qz
    const ny = m10 * qx + m11 * qy + m12 * qz
    const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
    // the light, plus a little for how near the point is: a flat face is lit evenly, so nearness is what shows it running away from you
    g.lum[o] = Math.min(0.92, Math.max(0.1, 0.14 + 0.86 * Math.pow(lit * 0.5 + 0.5, 1.3) + 0.16 * (ooz * D - 1)))
  }
}

/** a curve on the light so the lit side, the shaded side and the edge come out as different characters: the form reads as a solid, not a block */
export const glyph = (lum: number) => (lum < 0 ? ' ' : RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(lum, 1.6) * RAMP.length))])

export function gridText(g: Grid): string {
  let s = ''
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) s += glyph(g.lum[c + r * g.cols])
    s += '\n'
  }
  return s
}
