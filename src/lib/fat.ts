/**
 * FAT12 and FAT16 volumes, read and written in memory. The DOS window uses it to put files you import on a floppy (A:) or C:, to
 * list and export files, and `scripts/build-dos.mjs` uses it to build the C: drives. Long file names are written the way Windows 95
 * writes them (VFAT entries before a unique 8.3 alias), so FreeDOS with DOSLFN sees "My essay.docx" and MS-DOS 4 sees MYESSA~1.DOC.
 * A write is all or nothing: if a file does not fit, the volume is put back as it was.
 */
export interface Entry { path: string; data?: Uint8Array; dir?: boolean; attr?: number; date?: Date; size?: number }
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

// what a short (8.3) name may hold; lower case is not in it, so a name with lower case gets a long name to keep its case
const SHORT_OK = /^[A-Z0-9!#$%&'()\-@^_`{}~]$/
const DEVICES = new Set(['CON', 'PRN', 'AUX', 'NUL', 'CLOCK$', ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => [`COM${n}`, `LPT${n}`])])

/** a long name as FAT keeps it: no separators or control characters, no trailing dots or spaces, not a device name, 255 at most */
export function longName(name: string): string {
  let n = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').replace(/^ +/, '')
  if (!n || n === '.' || n === '..') n = '_'
  if (DEVICES.has(n.split('.')[0].toUpperCase())) n = `_${n}` // CON.TXT is the screen to DOS, not a file
  if (n.length > 255) { const dot = n.lastIndexOf('.'); const ext = dot > 0 && n.length - dot <= 16 ? n.slice(dot) : ''; n = n.slice(0, 255 - ext.length) + ext }
  return n
}

/** the 11-character short name for a long one, unique in its folder: as it is when it already fits 8.3, else a numeric tail (MYESSA~1.DOC) */
function aliasOf(n: string, taken: Set<string>): string {
  const clean = (x: string) => [...x.toUpperCase().replace(/[ .]/g, '')].map((ch) => (SHORT_OK.test(ch) ? ch : '_')).join('')
  const dot = n.lastIndexOf('.')
  const rawBase = dot > 0 ? n.slice(0, dot) : n.replace(/^\.+/, '')
  const rawExt = dot > 0 ? n.slice(dot + 1) : ''
  const base = clean(rawBase) || '_', ext = clean(rawExt)
  const lossy = n.startsWith('.') || base !== rawBase.toUpperCase() || ext !== rawExt.toUpperCase() || base.length > 8 || ext.length > 3
  const plain = base.padEnd(8) + ext.padEnd(3)
  if (!lossy && !taken.has(plain)) return plain
  const e3 = ext.slice(0, 3).padEnd(3)
  for (let i = 1; i < 1_000_000; i++) {
    const tail = `~${i}`
    const raw = (base.slice(0, 8 - tail.length) + tail).padEnd(8) + e3
    if (!taken.has(raw)) return raw
  }
  throw new Error('Too many files with names like this in one folder')
}
/** the short name a name gets in an empty folder (kept for callers that want the 8.3 form) */
export const shortName = (name: string) => aliasOf(longName(name), new Set())
const display = (raw: string) => { const b = raw.slice(0, 8).trimEnd(), e = raw.slice(8).trimEnd(); return e ? `${b}.${e}` : b }
const needsLong = (n: string, raw: string) => n !== display(raw)

/** the checksum of a short name, carried by each of its long-name entries */
function sumOf(v: Uint8Array, o: number) { let s = 0; for (let i = 0; i < 11; i++) s = ((((s & 1) << 7) | (s >> 1)) + v[o + i]) & 0xff; return s }
const LFN_AT = [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30] // where the 13 UTF-16 units of each long-name entry sit
/** the long-name entries for a name, in the order they go on disk (last part first) */
function lfnEntries(n: string, sum: number): Uint8Array[] {
  const count = Math.ceil(n.length / 13)
  const out: Uint8Array[] = []
  for (let k = count; k >= 1; k--) {
    const e = new Uint8Array(32)
    e[0] = k | (k === count ? 0x40 : 0); e[11] = 0x0f; e[13] = sum
    for (let j = 0; j < 13; j++) {
      const i = (k - 1) * 13 + j
      const u = i < n.length ? n.charCodeAt(i) : i === n.length ? 0 : 0xffff
      e[LFN_AT[j]] = u & 255; e[LFN_AT[j] + 1] = u >> 8
    }
    out.push(e)
  }
  return out
}

/** the 32-byte slots of a directory: the root's fixed area, or a subdirectory's clusters */
function slots(v: Uint8Array, L: Layout, cluster: number): number[] {
  const out: number[] = []
  if (cluster === 0) { for (let i = 0; i < L.rootEntries; i++) out.push(L.rootStart * SECTOR + i * 32); return out }
  for (const c of chain(v, L, cluster)) for (let i = 0; i < (L.spc * SECTOR) / 32; i++) out.push(clusterAt(L, c) + i * 32)
  return out
}
interface Name { raw: string; long?: string; o: number; lfn: number[]; attr: number; first: number; size: number }
/** the live entries of a folder, each with its long name when it has a whole and matching one */
function names(v: Uint8Array, L: Layout, cluster: number): Name[] {
  const out: Name[] = []
  let parts: string[] = [], at: number[] = [], want = 0, sum = -1
  const reset = () => { parts = []; at = []; want = 0; sum = -1 }
  for (const o of slots(v, L, cluster)) {
    if (v[o] === 0) break
    if (v[o] === 0xe5) { reset(); continue }
    if (v[o + 11] === 0x0f) {
      const seq = v[o] & 0x1f
      if (v[o] & 0x40) { reset(); want = seq; sum = v[o + 13] }
      if (!seq || seq !== want || v[o + 13] !== sum) { reset(); continue } // out of order or orphaned: ignored, as DOS does
      let piece = ''
      for (const p of LFN_AT) { const u = u16(v, o + p); if (u === 0 || u === 0xffff) break; piece += String.fromCharCode(u) }
      parts[seq - 1] = piece; at.push(o); want = seq - 1
      continue
    }
    const whole = parts.length > 0 && want === 0 && sum === sumOf(v, o)
    out.push({ raw: String.fromCharCode(...v.subarray(o, o + 11)), long: whole ? parts.join('') : undefined, o, lfn: whole ? at : [], attr: v[o + 11], first: u16(v, o + 26), size: u32(v, o + 28) })
    reset()
  }
  return out
}
const nameOf = (n: Name) => n.long ?? display(n.raw)
/** a run of `count` free slots in a row (long names need several); a subfolder grows a cluster at a time until there is one */
function freeRun(v: Uint8Array, L: Layout, cluster: number, count: number): number[] {
  for (;;) {
    let run: number[] = []
    for (const o of slots(v, L, cluster)) {
      if (v[o] === 0 || v[o] === 0xe5) { run.push(o); if (run.length === count) return run } else run = []
    }
    if (cluster === 0) throw new Error('The root folder is full')
    const all = chain(v, L, cluster)
    const [c] = alloc(v, L, 1)
    setFat(v, L, all[all.length - 1], c)
    v.fill(0, clusterAt(L, c), clusterAt(L, c) + L.spc * SECTOR)
  }
}

/**
 * Add files and folders (folders are made as needed); a file already there under the same name (any case) is replaced. All or
 * nothing: the FATs, the root folder and every folder touched are kept until the end, and a replaced file's clusters are only let
 * go when everything has fitted, so a full disk or a full root folder leaves the volume exactly as it was.
 */
export function writeFiles(v: Uint8Array, entries: Entry[]) {
  const L = layout(v)
  const fatKeep = v.slice(L.fatStart * SECTOR, L.rootStart * SECTOR)
  const rootKeep = v.slice(L.rootStart * SECTOR, L.dataStart * SECTOR)
  const dirKeep = new Map<number, Uint8Array>()
  const keepDir = (cluster: number) => { if (cluster) for (const c of chain(v, L, cluster)) if (!dirKeep.has(c)) dirKeep.set(c, v.slice(clusterAt(L, c), clusterAt(L, c) + L.spc * SECTOR)) }
  const letGo: number[] = []
  const find = (dir: number, n: string) => { const up = n.toUpperCase(); return names(v, L, dir).find((x) => !(x.attr & 0x08) && (nameOf(x).toUpperCase() === up || display(x.raw) === up)) }
  /** write an entry (with its long name if it needs one) into a folder; returns the short entry's offset */
  const place = (dir: number, n: string, attr: number, first: number, size: number, date: Date) => {
    keepDir(dir)
    const taken = new Set(names(v, L, dir).map((x) => x.raw))
    const raw = aliasOf(n, taken)
    const short = new Uint8Array(32)
    short.set(new TextEncoder().encode(raw)); short[11] = attr; w16(short, 26, first); w32(short, 28, size); stamp(short, 0, date)
    const longs = needsLong(n, raw) ? lfnEntries(n, sumOf(short, 0)) : []
    const run = freeRun(v, L, dir, longs.length + 1)
    keepDir(dir) // it may have grown
    longs.forEach((e, i) => v.set(e, run[i]))
    v.set(short, run[run.length - 1])
    return run[run.length - 1]
  }
  const dirOf = (parts: string[]): number => {
    let cur = 0
    for (const p of parts) {
      const n = longName(p)
      const hit = find(cur, n)
      if (hit && hit.attr & 0x10) { cur = hit.first; continue }
      if (hit) throw new Error(`${n} is a file, so it cannot be a folder`)
      const [c] = alloc(v, L, 1)
      const base = clusterAt(L, c)
      v.fill(0, base, base + L.spc * SECTOR)
      const now = new Date()
      v.set(new TextEncoder().encode('.          '), base); v[base + 11] = 0x10; w16(v, base + 26, c); stamp(v, base, now)
      v.set(new TextEncoder().encode('..         '), base + 32); v[base + 43] = 0x10; w16(v, base + 58, cur); stamp(v, base + 32, now)
      place(cur, n, 0x10, c, 0, now)
      cur = c
    }
    return cur
  }
  try {
    for (const e of entries) {
      const parts = e.path.split(/[\\/]+/).filter(Boolean)
      if (!parts.length) continue
      if ((e.attr ?? 0) & 0x08) { // the volume label: in the root, only one, and in a namespace of its own (a folder may share its name)
        for (const x of names(v, L, 0)) if (x.attr & 0x08) v[x.o] = 0xe5
        const label = new Uint8Array(32)
        label.set(new TextEncoder().encode(parts.join(' ').toUpperCase().replace(/[^A-Z0-9 !#$%&'()\-@^_`{}~]/g, '_').padEnd(11).slice(0, 11)))
        label[11] = 0x08; stamp(label, 0, e.date ?? new Date())
        v.set(label, freeRun(v, L, 0, 1)[0])
        continue
      }
      if (e.dir) { dirOf(parts); continue }
      const dir = dirOf(parts.slice(0, -1))
      const n = longName(parts[parts.length - 1])
      const old = find(dir, n)
      if (old && old.attr & 0x10) throw new Error(`${n} is a folder`)
      if (old) { keepDir(dir); letGo.push(...chain(v, L, old.first)); v[old.o] = 0xe5; for (const o of old.lfn) v[o] = 0xe5 }
      const data = e.data ?? new Uint8Array(0)
      const bytes = L.spc * SECTOR
      const cl = data.length ? alloc(v, L, Math.ceil(data.length / bytes)) : []
      cl.forEach((c, i) => { v.fill(0, clusterAt(L, c), clusterAt(L, c) + bytes); v.set(data.subarray(i * bytes, (i + 1) * bytes), clusterAt(L, c)) })
      place(dir, n, e.attr ?? 0x20, cl[0] ?? 0, data.length, e.date ?? new Date())
    }
    for (const c of letGo) setFat(v, L, c, 0)
  } catch (err) {
    v.set(fatKeep, L.fatStart * SECTOR)
    v.set(rootKeep, L.rootStart * SECTOR)
    for (const [c, b] of dirKeep) v.set(b, clusterAt(L, c))
    throw err
  }
}

/**
 * Every file and folder on a volume under its long name when it has one: with each file's contents, or with `withData` false only
 * its size (a big disk of your own can hold thousands of files, and listing them should not copy them all). `max` stops early.
 */
export function list(v: Uint8Array, withData = true, max = Infinity): Entry[] {
  const L = layout(v)
  const out: Entry[] = []
  const walk = (cluster: number, prefix: string, depth: number) => {
    if (depth > 16) return
    for (const n of names(v, L, cluster)) {
      if (out.length >= max) return
      if (n.attr & 0x08) continue // the volume label
      const name = nameOf(n)
      if (name === '.' || name === '..') continue
      const path = prefix ? `${prefix}/${name}` : name
      if (n.attr & 0x10) { out.push({ path, dir: true, attr: n.attr, date: when(v, n.o) }); walk(n.first, path, depth + 1); continue }
      out.push({ path, attr: n.attr, date: when(v, n.o), size: n.size, ...(withData ? { data: readChain(v, L, n.first, n.size) } : {}) })
    }
  }
  walk(0, '', 0)
  return out
}
function readChain(v: Uint8Array, L: Layout, first: number, size: number): Uint8Array {
  const data = new Uint8Array(size)
  let at = 0
  for (const c of chain(v, L, first)) { if (at >= size) break; const take = Math.min(L.spc * SECTOR, size - at); data.set(v.subarray(clusterAt(L, c), clusterAt(L, c) + take), at); at += take }
  return data
}
/** one file's contents by its path (long or short names, any case), or null */
export function read(v: Uint8Array, path: string): Uint8Array | null {
  const L = layout(v)
  let dir = 0
  const parts = path.split(/[\\/]+/).filter(Boolean)
  for (let i = 0; i < parts.length; i++) {
    const up = parts[i].toUpperCase()
    const hit = names(v, L, dir).find((x) => !(x.attr & 0x08) && (nameOf(x).toUpperCase() === up || display(x.raw) === up))
    if (!hit) return null
    if (i === parts.length - 1) return hit.attr & 0x10 ? null : readChain(v, L, hit.first, hit.size)
    if (!(hit.attr & 0x10)) return null
    dir = hit.first
  }
  return null
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

/** what file system a disk image holds, so the window can say why it cannot list one */
export function fsOf(disk: Uint8Array): 'fat' | 'fat32' | 'ntfs' | 'iso' | 'unknown' {
  if (volumeOf(disk)) return 'fat'
  if (disk.length > 0x8006 && String.fromCharCode(...disk.subarray(0x8001, 0x8006)) === 'CD001') return 'iso'
  const fs32 = (o: number) => String.fromCharCode(...disk.subarray(o + 82, o + 87)) === 'FAT32'
  if (disk.length >= SECTOR && fs32(0)) return 'fat32'
  if (disk.length >= SECTOR && String.fromCharCode(...disk.subarray(3, 7)) === 'NTFS') return 'ntfs'
  for (let i = 0; i < 4 && disk.length >= SECTOR; i++) {
    const o = 446 + i * 16, type = disk[o + 4], start = u32(disk, o + 8)
    if ([0x0b, 0x0c].includes(type)) return 'fat32'
    if (type === 0x07) return 'ntfs'
    if (start && (start + 1) * SECTOR <= disk.length && fs32(start * SECTOR)) return 'fat32'
  }
  return 'unknown'
}

/** a 1.44 MB floppy with these files on it; `boot` gives it a boot sector (its code says "Non-System disk" if booted) */
export function floppy(entries: Entry[], boot?: Uint8Array, label = 'TRANSFER'): Uint8Array {
  const v = format({ totalSectors: 2880, sectorsPerCluster: 1, rootEntries: 224, media: 0xf0, spt: 18, heads: 2, hidden: 0, label, drive: 0 }, boot)
  writeFiles(v, entries)
  return v
}

/** a hard disk image: an MBR with one FAT16 partition from LBA 63, `cylinders` of 16 heads and 63 sectors */
export function hardDisk(cylinders: number, mbr: Uint8Array, boot: Uint8Array | undefined, label: string): { disk: Uint8Array; volume: Uint8Array } {
  const heads = 16, spt = 63
  const sectors = cylinders * heads * spt
  const disk = new Uint8Array(sectors * SECTOR)
  disk.set(mbr.subarray(0, 446))
  const start = spt, size = sectors - spt
  const o = 446
  disk[o] = 0x80 // active
  disk[o + 1] = 1; disk[o + 2] = 1; disk[o + 3] = 0 // CHS of the start: cylinder 0, head 1, sector 1
  disk[o + 4] = size < 65536 ? 0x04 : 0x06
  const endCyl = Math.min(cylinders, 1024) - 1
  disk[o + 5] = heads - 1; disk[o + 6] = (spt & 63) | ((endCyl >> 2) & 0xc0); disk[o + 7] = endCyl & 255
  w32(disk, o + 8, start); w32(disk, o + 12, size)
  disk[510] = 0x55; disk[511] = 0xaa
  let spc = 4
  while (size / spc > 65524) spc *= 2 // FAT16 holds at most 65,524 clusters
  const vol = format({ totalSectors: size, sectorsPerCluster: spc, rootEntries: 512, media: 0xf8, spt, heads, hidden: start, label, drive: 0x80, bootable: true }, boot)
  disk.set(vol, start * SECTOR)
  return { disk, volume: disk.subarray(start * SECTOR, (start + size) * SECTOR) }
}
