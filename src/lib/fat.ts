/**
 * FAT12 and FAT16 volumes, read and written in memory. The DOS window uses it to put files you import on a floppy (A:), to list and
 * export files from A: or C:, and `scripts/build-dos.mjs` uses it to build the C: drive. 8.3 names only, as MS-DOS 4 knows them.
 */
export interface Entry { path: string; data?: Uint8Array; dir?: boolean; attr?: number; date?: Date }
export interface Geometry {
  totalSectors: number
  sectorsPerCluster: number
  rootEntries: number
  media: number
  spt: number
  heads: number
  hidden: number
  reserved?: number
  label?: string
  /** the drive number in the boot sector: 0 for a floppy, 0x80 for a hard disk */
  drive?: number
  /** a system disk: IO.SYS and MSDOS.SYS must be the first two root entries, so the volume label entry is left for later */
  bootable?: boolean
}

const SECTOR = 512
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
const w16 = (b: Uint8Array, o: number, v: number) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255 }
const w32 = (b: Uint8Array, o: number, v: number) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = (v >>> 24) & 255 }

interface Layout { spc: number; reserved: number; fats: number; rootEntries: number; spf: number; total: number; fatStart: number; rootStart: number; dataStart: number; clusters: number; fat16: boolean }

function layout(v: Uint8Array): Layout {
  if (u16(v, 11) !== SECTOR) throw new Error('Not a FAT volume (sector size)')
  const spc = v[13], reserved = u16(v, 14), fats = v[16], rootEntries = u16(v, 17)
  const total = u16(v, 19) || u32(v, 32), spf = u16(v, 22)
  if (!spc || !fats || !spf || !total) throw new Error('Not a FAT12 or FAT16 volume')
  const fatStart = reserved, rootStart = reserved + fats * spf
  const dataStart = rootStart + Math.ceil((rootEntries * 32) / SECTOR)
  const clusters = Math.floor((total - dataStart) / spc)
  return { spc, reserved, fats, rootEntries, spf, total, fatStart, rootStart, dataStart, clusters, fat16: clusters >= 4085 }
}

/** the size of each FAT for a geometry, worked out the way FORMAT does it */
function fatSectors(g: Geometry, fat16: boolean) {
  const reserved = g.reserved ?? 1
  const rootSectors = Math.ceil((g.rootEntries * 32) / SECTOR)
  let spf = 1
  for (;;) {
    const clusters = Math.floor((g.totalSectors - reserved - 2 * spf - rootSectors) / g.sectorsPerCluster)
    const need = Math.ceil(((clusters + 2) * (fat16 ? 2 : 1.5)) / SECTOR)
    if (need <= spf) return spf
    spf = need
  }
}

/** a new, empty volume; `boot` is a boot sector to start from (its code is kept, its BPB is rewritten) */
export function format(g: Geometry, boot?: Uint8Array): Uint8Array {
  const v = new Uint8Array(g.totalSectors * SECTOR)
  if (boot) v.set(boot.subarray(0, SECTOR))
  else { v[0] = 0xeb; v[1] = 0x3c; v[2] = 0x90; v.set(new TextEncoder().encode('FRICTION'), 3); v[62] = 0xcd; v[63] = 0x18 } // no boot code: INT 18h
  const reserved = g.reserved ?? 1
  const rootSectors = Math.ceil((g.rootEntries * 32) / SECTOR)
  const guess = Math.floor((g.totalSectors - reserved - rootSectors) / g.sectorsPerCluster)
  const fat16 = guess >= 4085
  const spf = fatSectors(g, fat16)
  w16(v, 11, SECTOR); v[13] = g.sectorsPerCluster; w16(v, 14, reserved); v[16] = 2; w16(v, 17, g.rootEntries)
  if (g.totalSectors < 65536) { w16(v, 19, g.totalSectors); w32(v, 32, 0) } else { w16(v, 19, 0); w32(v, 32, g.totalSectors) }
  v[21] = g.media; w16(v, 22, spf); w16(v, 24, g.spt); w16(v, 26, g.heads); w32(v, 28, g.hidden)
  // the extended BPB of MS-DOS 4: drive, signature, serial, label and type
  v[36] = g.drive ?? 0; v[37] = 0; v[38] = 0x29; w32(v, 39, (Date.now() & 0xffffffff) >>> 0)
  const label = (g.label ?? 'NO NAME').toUpperCase().padEnd(11).slice(0, 11)
  v.set(new TextEncoder().encode(label), 43)
  v.set(new TextEncoder().encode(fat16 ? 'FAT16   ' : 'FAT12   '), 54)
  v[510] = 0x55; v[511] = 0xaa
  const L = layout(v)
  // the first two FAT entries: the media byte and end-of-chain
  for (let f = 0; f < L.fats; f++) {
    const o = (L.fatStart + f * L.spf) * SECTOR
    v[o] = g.media; v[o + 1] = 0xff; v[o + 2] = 0xff
    if (L.fat16) v[o + 3] = 0xff
  }
  if (g.label && !g.bootable) {
    const o = L.rootStart * SECTOR
    v.set(new TextEncoder().encode(label), o)
    v[o + 11] = 0x08
    stamp(v, o, new Date())
  }
  return v
}

function getFat(v: Uint8Array, L: Layout, n: number): number {
  const o = L.fatStart * SECTOR
  if (L.fat16) return u16(v, o + n * 2)
  const x = u16(v, o + Math.floor(n * 1.5))
  return n & 1 ? x >> 4 : x & 0xfff
}
function setFat(v: Uint8Array, L: Layout, n: number, val: number) {
  for (let f = 0; f < L.fats; f++) {
    const o = (L.fatStart + f * L.spf) * SECTOR
    if (L.fat16) { w16(v, o + n * 2, val); continue }
    const at = o + Math.floor(n * 1.5)
    const x = u16(v, at)
    w16(v, at, n & 1 ? (x & 0x000f) | (val << 4) : (x & 0xf000) | (val & 0xfff))
  }
}
const EOC = (L: Layout) => (L.fat16 ? 0xffff : 0xfff)
const isEnd = (L: Layout, c: number) => c >= (L.fat16 ? 0xfff8 : 0xff8) || c < 2
const clusterAt = (L: Layout, c: number) => (L.dataStart + (c - 2) * L.spc) * SECTOR

function chain(v: Uint8Array, L: Layout, first: number): number[] {
  const out: number[] = []
  for (let c = first; !isEnd(L, c) && out.length <= L.clusters; c = getFat(v, L, c)) out.push(c)
  return out
}
function alloc(v: Uint8Array, L: Layout, count: number): number[] {
  const got: number[] = []
  for (let c = 2; c < L.clusters + 2 && got.length < count; c++) if (getFat(v, L, c) === 0) got.push(c)
  if (got.length < count) throw new Error('The disk is full')
  got.forEach((c, i) => setFat(v, L, c, i + 1 < got.length ? got[i + 1] : EOC(L)))
  return got
}

function stamp(v: Uint8Array, o: number, d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  w16(v, o + 22, time); w16(v, o + 24, date)
}
const when = (v: Uint8Array, o: number) => { const t = u16(v, o + 22), d = u16(v, o + 24); return new Date(1980 + (d >> 9), ((d >> 5) & 15) - 1, d & 31, t >> 11, (t >> 5) & 63, (t & 31) * 2) }

/** a name as MS-DOS 4 stores it: 8 + 3, upper case, no characters it refuses */
export function shortName(name: string): string {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9!#$%&'()\-@^_`{}~]/g, '_')
  const dot = name.lastIndexOf('.')
  const base = clean(dot > 0 ? name.slice(0, dot) : name).slice(0, 8) || '_'
  const ext = dot > 0 ? clean(name.slice(dot + 1)).slice(0, 3) : ''
  return base.padEnd(8) + ext.padEnd(3)
}
const display = (raw: string) => { const b = raw.slice(0, 8).trimEnd(), e = raw.slice(8).trimEnd(); return e ? `${b}.${e}` : b }

/** the 32-byte slots of a directory: the root's fixed area, or a subdirectory's clusters */
function slots(v: Uint8Array, L: Layout, cluster: number): number[] {
  const out: number[] = []
  if (cluster === 0) { for (let i = 0; i < L.rootEntries; i++) out.push(L.rootStart * SECTOR + i * 32); return out }
  for (const c of chain(v, L, cluster)) for (let i = 0; i < (L.spc * SECTOR) / 32; i++) out.push(clusterAt(L, c) + i * 32)
  return out
}
function names(v: Uint8Array, L: Layout, cluster: number) {
  const out: { raw: string; o: number; attr: number; first: number; size: number }[] = []
  for (const o of slots(v, L, cluster)) {
    if (v[o] === 0) break
    if (v[o] === 0xe5 || v[o + 11] === 0x0f) continue
    out.push({ raw: String.fromCharCode(...v.subarray(o, o + 11)), o, attr: v[o + 11], first: u16(v, o + 26), size: u32(v, o + 28) })
  }
  return out
}
function freeSlot(v: Uint8Array, L: Layout, cluster: number): number {
  for (const o of slots(v, L, cluster)) if (v[o] === 0 || v[o] === 0xe5) return o
  if (cluster === 0) throw new Error('The root folder is full')
  // grow the folder by one cluster
  const all = chain(v, L, cluster)
  const [c] = alloc(v, L, 1)
  setFat(v, L, all[all.length - 1], c)
  v.fill(0, clusterAt(L, c), clusterAt(L, c) + L.spc * SECTOR)
  return clusterAt(L, c)
}

/** add files and folders (made as needed); a file that is already there is replaced */
export function writeFiles(v: Uint8Array, entries: Entry[]) {
  const L = layout(v)
  const dirOf = (parts: string[]): number => {
    let cur = 0
    for (const p of parts) {
      const raw = shortName(p)
      const hit = names(v, L, cur).find((n) => n.raw === raw && n.attr & 0x10)
      if (hit) { cur = hit.first; continue }
      const o = freeSlot(v, L, cur)
      const [c] = alloc(v, L, 1)
      const base = clusterAt(L, c)
      v.fill(0, base, base + L.spc * SECTOR)
      const now = new Date()
      v.set(new TextEncoder().encode(raw), o); v[o + 11] = 0x10; w16(v, o + 26, c); w32(v, o + 28, 0); stamp(v, o, now)
      v.set(new TextEncoder().encode('.          '), base); v[base + 11] = 0x10; w16(v, base + 26, c); stamp(v, base, now)
      v.set(new TextEncoder().encode('..         '), base + 32); v[base + 43] = 0x10; w16(v, base + 58, cur); stamp(v, base + 32, now)
      cur = c
    }
    return cur
  }
  for (const e of entries) {
    const parts = e.path.split(/[\\/]+/).filter(Boolean)
    if (!parts.length) continue
    if (e.dir) { dirOf(parts); continue }
    const dir = dirOf(parts.slice(0, -1))
    const raw = shortName(parts[parts.length - 1])
    const old = names(v, L, dir).find((n) => n.raw === raw && !(n.attr & 0x18))
    if (old) { for (const c of chain(v, L, old.first)) setFat(v, L, c, 0); v[old.o] = 0xe5 }
    const data = e.data ?? new Uint8Array(0)
    const need = Math.ceil(data.length / (L.spc * SECTOR))
    const cl = need ? alloc(v, L, need) : []
    cl.forEach((c, i) => { const part = data.subarray(i * L.spc * SECTOR, (i + 1) * L.spc * SECTOR); v.fill(0, clusterAt(L, c), clusterAt(L, c) + L.spc * SECTOR); v.set(part, clusterAt(L, c)) })
    const o = freeSlot(v, L, dir)
    v.fill(0, o, o + 32)
    v.set(new TextEncoder().encode(raw), o); v[o + 11] = e.attr ?? 0x20; w16(v, o + 26, cl[0] ?? 0); w32(v, o + 28, data.length); stamp(v, o, e.date ?? new Date())
  }
}

/** every file and folder on a volume, with its contents */
export function list(v: Uint8Array): Entry[] {
  const L = layout(v)
  const out: Entry[] = []
  const walk = (cluster: number, prefix: string, depth: number) => {
    if (depth > 16) return
    for (const n of names(v, L, cluster)) {
      if (n.attr & 0x08) continue // the volume label
      const name = display(n.raw)
      if (name === '.' || name === '..') continue
      const path = prefix ? `${prefix}/${name}` : name
      if (n.attr & 0x10) { out.push({ path, dir: true, attr: n.attr, date: when(v, n.o) }); walk(n.first, path, depth + 1); continue }
      const data = new Uint8Array(n.size)
      let at = 0
      for (const c of chain(v, L, n.first)) { if (at >= n.size) break; const take = Math.min(L.spc * SECTOR, n.size - at); data.set(v.subarray(clusterAt(L, c), clusterAt(L, c) + take), at); at += take }
      out.push({ path, data, attr: n.attr, date: when(v, n.o) })
    }
  }
  walk(0, '', 0)
  return out
}

/** room left on a volume, in bytes */
export function free(v: Uint8Array): number {
  const L = layout(v)
  let n = 0
  for (let c = 2; c < L.clusters + 2; c++) if (getFat(v, L, c) === 0) n++
  return n * L.spc * SECTOR
}

/** the first FAT12 or FAT16 partition of a hard disk image (or the whole image, if it is a bare volume like a floppy) */
export function volumeOf(disk: Uint8Array): Uint8Array | null {
  if (disk.length < SECTOR || disk[510] !== 0x55 || disk[511] !== 0xaa) return null
  try { layout(disk); if (disk[0] === 0xeb || disk[0] === 0xe9) return disk } catch { /* not a bare volume: look for a partition table */ }
  for (let i = 0; i < 4; i++) {
    const o = 446 + i * 16, type = disk[o + 4], start = u32(disk, o + 8), size = u32(disk, o + 12)
    if ([0x01, 0x04, 0x06, 0x0e].includes(type) && start && size && (start + size) * SECTOR <= disk.length) {
      const vol = disk.subarray(start * SECTOR, (start + size) * SECTOR)
      try { layout(vol); return vol } catch { /* next */ }
    }
  }
  return null
}

/** a 1.44 MB floppy with these files on it; `boot` gives it a boot sector (its code says "Non-System disk" if booted) */
export function floppy(entries: Entry[], boot?: Uint8Array, label = 'TRANSFER'): Uint8Array {
  const v = format({ totalSectors: 2880, sectorsPerCluster: 1, rootEntries: 224, media: 0xf0, spt: 18, heads: 2, hidden: 0, label, drive: 0 }, boot)
  writeFiles(v, entries)
  return v
}

/** a hard disk image: an MBR with one FAT16 partition from LBA 63, `cylinders` of 16 heads and 63 sectors */
export function hardDisk(cylinders: number, mbr: Uint8Array, boot: Uint8Array, label: string): { disk: Uint8Array; volume: Uint8Array } {
  const heads = 16, spt = 63
  const sectors = cylinders * heads * spt
  const disk = new Uint8Array(sectors * SECTOR)
  disk.set(mbr.subarray(0, 446))
  const start = spt, size = sectors - spt
  const o = 446
  disk[o] = 0x80 // active
  disk[o + 1] = 1; disk[o + 2] = 1; disk[o + 3] = 0 // CHS of the start: cylinder 0, head 1, sector 1
  disk[o + 4] = size < 65536 ? 0x04 : 0x06
  const endCyl = cylinders - 1
  disk[o + 5] = heads - 1; disk[o + 6] = (spt & 63) | ((endCyl >> 2) & 0xc0); disk[o + 7] = endCyl & 255
  w32(disk, o + 8, start); w32(disk, o + 12, size)
  disk[510] = 0x55; disk[511] = 0xaa
  const spc = size > 65536 * 2 ? 8 : 4
  const vol = format({ totalSectors: size, sectorsPerCluster: spc, rootEntries: 512, media: 0xf8, spt, heads, hidden: start, label, drive: 0x80, bootable: true }, boot)
  disk.set(vol, start * SECTOR)
  return { disk, volume: disk.subarray(start * SECTOR, (start + size) * SECTOR) }
}
