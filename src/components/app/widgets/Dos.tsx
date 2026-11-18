import { ClipboardCopy, Download, HardDrive, Keyboard, Maximize2, MousePointer2, Pause, Play, Power, RotateCcw, Save, Upload, Wifi, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as RKE, type PointerEvent as RPE } from 'react'
import { V86, type V86Options } from 'v86'
import { del, get, set } from 'idb-keyval'
import DOS from '@/lib/dos.json'
import RT from '@/lib/rt.json'
import { floppy, free, fsOf, hardDisk, list, read, volumeOf, writeFiles, type Entry } from '@/lib/fat'
import { guardedFetch } from '@/lib/dosnet'
import { fx_say } from '@/lib/actions'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { key } from './Window'

/**
 * A PC in the Code window: v86 (copy.sh/v86) in this browser, nothing on a server. Three systems:
 *   FreeDOS 1.3, the default: its kernel answers programs as DOS 7.10 (the MS-DOS inside Windows 98, which Microsoft never released,
 *     so it cannot be built in), DOSLFN gives long file names, FDNPKG installs programs from the FreeDOS repositories over HTTP.
 *   MS-DOS 4.00, Microsoft's open-source release (MIT).
 *   Your own disks: a hard disk, a floppy and a CD image of your own (Windows 95 or 98, a boot floppy), or a blank hard disk to
 *     install your own MS-DOS 7 onto with SYS C:.
 * Both C: drives are built by `scripts/build-dos.mjs`. The NE2000 card is wired to v86's fetch adapter; every request passes
 * `lib/dosnet.ts` (the blocklist, no private networks, KillCORS). What a system's disks hold is kept in IndexedDB, packed, when
 * you power off or press Keep.
 */
type Builtin = 'freedos' | 'msdos4'
type Sys = Builtin | 'own'
type Slot = 'hda' | 'fda' | 'cdrom'
type Disk = { name: string; buf: ArrayBuffer }
type Own = { hda?: Disk; fda?: Disk; cdrom?: Disk; boot: Slot; mem: number }
type KeptOwn = { hda?: { name: string; blob: Blob }; fda?: { name: string; blob: Blob }; boot?: Slot; mem?: number }
const BUILT: Record<Builtin, { name: string; tag: string; key: string; disk: string; size: number; gz: number; blurb: string }> = {
  freedos: { name: 'FreeDOS 1.3', tag: 'DOS 7.10', key: 'dos:c:freedos:v1', ...DOS.systems.freedos, blurb: 'Answers programs as DOS 7.10, the MS-DOS inside Windows 98. Long file names, and INSTALL adds programs from the FreeDOS collection.' },
  msdos4: { name: 'MS-DOS 4.00', tag: 'Microsoft', key: 'dos:c:v1', ...DOS.systems.msdos4, blurb: 'Microsoft\'s own MS-DOS, from its open-source release (MIT).' },
}
const OWN_KEY = 'dos:own:v1'
const SYS_KEY = 'friction:dos-system'
const NO_OWN: Own = { boot: 'fda', mem: 64 }
const BLANKS = [64, 128, 256, 504] // MB; 504 is the most a BIOS reaches by cylinders, heads and sectors
const MEMS = [32, 64, 128, 256]
// v86's boot order: the first device is the lowest hex digit (1 floppy, 2 hard disk, 3 CD)
const ORDER = (n: number) => n as unknown as V86Options['boot_order']
const FLOPPY_MAX = 2_949_120 // the largest floppy image (2.88 MB)
const DISK_MAX = 1024 * 1048576
const mb = (n: number) => `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`
const readSys = (): Sys => { try { const v = localStorage.getItem(SYS_KEY); return v === 'msdos4' || v === 'own' ? v : 'freedos' } catch { return 'freedos' } }

// PC scancodes (set 1) for KeyboardEvent.code; the extended keys are 0xE0nn
const SC: Record<string, number> = {
  Escape: 0x01, Digit1: 0x02, Digit2: 0x03, Digit3: 0x04, Digit4: 0x05, Digit5: 0x06, Digit6: 0x07, Digit7: 0x08, Digit8: 0x09, Digit9: 0x0a, Digit0: 0x0b,
  Minus: 0x0c, Equal: 0x0d, Backspace: 0x0e, Tab: 0x0f, KeyQ: 0x10, KeyW: 0x11, KeyE: 0x12, KeyR: 0x13, KeyT: 0x14, KeyY: 0x15, KeyU: 0x16, KeyI: 0x17,
  KeyO: 0x18, KeyP: 0x19, BracketLeft: 0x1a, BracketRight: 0x1b, Enter: 0x1c, ControlLeft: 0x1d, KeyA: 0x1e, KeyS: 0x1f, KeyD: 0x20, KeyF: 0x21,
  KeyG: 0x22, KeyH: 0x23, KeyJ: 0x24, KeyK: 0x25, KeyL: 0x26, Semicolon: 0x27, Quote: 0x28, Backquote: 0x29, ShiftLeft: 0x2a, Backslash: 0x2b,
  KeyZ: 0x2c, KeyX: 0x2d, KeyC: 0x2e, KeyV: 0x2f, KeyB: 0x30, KeyN: 0x31, KeyM: 0x32, Comma: 0x33, Period: 0x34, Slash: 0x35, ShiftRight: 0x36,
  NumpadMultiply: 0x37, AltLeft: 0x38, Space: 0x39, CapsLock: 0x3a, F1: 0x3b, F2: 0x3c, F3: 0x3d, F4: 0x3e, F5: 0x3f, F6: 0x40, F7: 0x41, F8: 0x42,
  F9: 0x43, F10: 0x44, NumLock: 0x45, ScrollLock: 0x46, Numpad7: 0x47, Numpad8: 0x48, Numpad9: 0x49, NumpadSubtract: 0x4a, Numpad4: 0x4b, Numpad5: 0x4c,
  Numpad6: 0x4d, NumpadAdd: 0x4e, Numpad1: 0x4f, Numpad2: 0x50, Numpad3: 0x51, Numpad0: 0x52, NumpadDecimal: 0x53, IntlBackslash: 0x56, F11: 0x57, F12: 0x58,
  NumpadEnter: 0xe01c, ControlRight: 0xe01d, NumpadDivide: 0xe035, AltRight: 0xe038, Home: 0xe047, ArrowUp: 0xe048, PageUp: 0xe049, ArrowLeft: 0xe04b,
  ArrowRight: 0xe04d, End: 0xe04f, ArrowDown: 0xe050, PageDown: 0xe051, Insert: 0xe052, Delete: 0xe053, MetaLeft: 0xe05b, MetaRight: 0xe05c, ContextMenu: 0xe05d,
}
const make = (c: number) => (c > 0xff ? [0xe0, c & 0xff] : [c])
const brk = (c: number) => (c > 0xff ? [0xe0, (c & 0xff) | 0x80] : [c | 0x80])
// the US key for each printable character, and whether it needs Shift
const US: Record<string, [string, boolean]> = {
  ' ': ['Space', false], '-': ['Minus', false], '_': ['Minus', true], '=': ['Equal', false], '+': ['Equal', true], '[': ['BracketLeft', false], '{': ['BracketLeft', true],
  ']': ['BracketRight', false], '}': ['BracketRight', true], ';': ['Semicolon', false], ':': ['Semicolon', true], "'": ['Quote', false], '"': ['Quote', true],
  '`': ['Backquote', false], '~': ['Backquote', true], '\\': ['Backslash', false], '|': ['Backslash', true], ',': ['Comma', false], '<': ['Comma', true],
  '.': ['Period', false], '>': ['Period', true], '/': ['Slash', false], '?': ['Slash', true],
}
for (const ch of 'abcdefghijklmnopqrstuvwxyz') { US[ch] = [`Key${ch.toUpperCase()}`, false]; US[ch.toUpperCase()] = [`Key${ch.toUpperCase()}`, true] }
'1234567890'.split('').forEach((d, i) => { US[d] = [`Digit${d}`, false]; US['!@#$%^&*()'[i]] = [`Digit${d}`, true] })
// the touch keys: what they send, and what they say
const PAD: { k: string; label: string; aria?: string }[] = [
  { k: 'Escape', label: 'Esc' }, { k: 'Tab', label: 'Tab' }, { k: 'ControlLeft', label: 'Ctrl' }, { k: 'AltLeft', label: 'Alt' }, { k: 'Enter', label: 'Enter' },
  { k: 'Backspace', label: '⌫', aria: 'Backspace' }, { k: 'ArrowUp', label: '↑', aria: 'Up' }, { k: 'ArrowDown', label: '↓', aria: 'Down' }, { k: 'ArrowLeft', label: '←', aria: 'Left' },
  { k: 'ArrowRight', label: '→', aria: 'Right' }, { k: 'Delete', label: 'Del' }, { k: 'Insert', label: 'Ins' }, { k: 'Home', label: 'Home' }, { k: 'End', label: 'End' },
  { k: 'PageUp', label: 'PgUp' }, { k: 'PageDown', label: 'PgDn' },
  ...Array.from({ length: 12 }, (_, i) => ({ k: `F${i + 1}`, label: `F${i + 1}` })),
]

interface Emu {
  bus: { register: (name: string, fn: (...a: never[]) => void, ctx: unknown) => void; send: (name: string, data: unknown) => void }
  network_adapter?: { fetch: (url: string, opts: RequestInit) => Promise<Response> }
  screen_adapter?: { get_text_screen: () => string[] }
}
type Phase = 'off' | 'loading' | 'on' | 'paused'

async function bytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.arrayBuffer()
}
/** a gzipped file, unpacked in the browser (or as it came, if it was not packed, or the server already unpacked it) */
async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}
/** packed for keeping: a disk is mostly empty, so a 64 MB C: keeps in a few MB */
async function pack(buf: ArrayBuffer): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return new Blob([buf])
  return new Response(new Blob([buf]).stream().pipeThrough(new CompressionStream('gzip'))).blob()
}
const download = (data: BlobPart, name: string) => {
  const url = URL.createObjectURL(new Blob([data]))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
/** why a disk of your own cannot take files, in words */
const whyNot = (buf: ArrayBuffer) => {
  const f = fsOf(new Uint8Array(buf))
  return f === 'fat32' ? 'It is FAT32, which this cannot write.' : f === 'ntfs' ? 'It is NTFS, which this cannot write.' : 'It has no FAT partition yet: FDISK and FORMAT it in DOS first.'
}

export function Dos() {
  const [phase, setPhase] = useState<Phase>('off')
  const [note, setNote] = useState('')
  const [keys, setKeys] = useState(() => matchMedia('(pointer: coarse)').matches)
  const [mouse, setMouse] = useState(false)
  const [net, setNet] = useState(true)
  const [mods, setMods] = useState<{ ctrl: boolean; alt: boolean }>({ ctrl: false, alt: false })
  const [panel, setPanel] = useState<null | 'files' | 'disks' | 'import'>(null)
  const [sys, setSysState] = useState<Sys>(readSys)
  const [own, setOwnState] = useState<Own>(NO_OWN)
  const [focused, setFocused] = useState(false)
  const [pending, setPending] = useState<Entry[]>([])
  const [sure, setSure] = useState<null | 'reset' | 'blank'>(null)
  const [blankMb, setBlankMb] = useState(128)
  const [busy, setBusy] = useState(false)
  const [, redraw] = useState(0) // the drives change in place; this redraws the file lists
  const minimized = useStore((s) => !!s.widgets.min?.includes('code'))
  const screen = useRef<HTMLDivElement>(null)
  const typer = useRef<HTMLTextAreaElement>(null)
  const emu = useRef<V86 | null>(null)
  const cBufs = useRef<Record<Builtin, ArrayBuffer | null>>({ freedos: null, msdos4: null })
  const aBuf = useRef<ArrayBuffer | null>(null)
  const bootSector = useRef<Uint8Array | null>(null)
  const sysRef = useRef(sys)
  const ownRef = useRef(own)
  const netOn = useRef(true)
  const autoPaused = useRef(false)
  const queue = useRef<string>('')
  const typing = useRef(0)
  const touch = useRef(new Map<number, { x: number; y: number; t: number; moved: number }>())
  const fileIn = useRef<HTMLInputElement>(null)
  const diskIn = useRef<HTMLInputElement>(null)
  netOn.current = net
  const setOwn = (o: Own) => { ownRef.current = o; setOwnState(o) }
  const setSys = (s: Sys) => { sysRef.current = s; setSysState(s); try { localStorage.setItem(SYS_KEY, s) } catch { /* not kept */ } }

  const raw = () => emu.current as unknown as Emu | null
  const sendCodes = (codes: number[]) => emu.current?.keyboard_send_scancodes(codes)
  const tap = (code: string) => {
    const c = SC[code]
    if (!c) return
    const pre: number[] = [], post: number[] = []
    if (mods.ctrl && code !== 'ControlLeft') { pre.push(...make(SC.ControlLeft)); post.unshift(...brk(SC.ControlLeft)) }
    if (mods.alt && code !== 'AltLeft') { pre.push(...make(SC.AltLeft)); post.unshift(...brk(SC.AltLeft)) }
    if (code === 'ControlLeft') { setMods((m) => ({ ...m, ctrl: !m.ctrl })); return }
    if (code === 'AltLeft') { setMods((m) => ({ ...m, alt: !m.alt })); return }
    sendCodes([...pre, ...make(c), ...brk(c), ...post])
    if (mods.ctrl || mods.alt) setMods({ ctrl: false, alt: false })
  }
  // typed or pasted text goes in a few characters at a time: the PC's keyboard buffer holds 15
  const typeText = (s: string) => {
    queue.current += s.replace(/\r\n?/g, '\n')
    if (typing.current) return
    const pump = () => {
      const chunk = queue.current.slice(0, 6)
      queue.current = queue.current.slice(6)
      // v86's own text sender needs its keyboard adapter, which is off here, so each character becomes the US key that types it
      const codes: number[] = []
      for (const ch of chunk) {
        const k = ch === '\n' ? ['Enter', false] as [string, boolean] : ch === '\t' ? ['Tab', false] as [string, boolean] : US[ch]
        const c = k && SC[k[0]]
        if (!c) continue
        if (k[1]) codes.push(0x2a)
        codes.push(...make(c), ...brk(c))
        if (k[1]) codes.push(0xaa)
      }
      if (codes.length) sendCodes(codes)
      typing.current = queue.current ? window.setTimeout(pump, 90) : 0
    }
    pump()
  }

  // your own disks from an earlier visit
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const k = await get<KeptOwn>(OWN_KEY)
        if (!k || !live) return
        const o: Own = { boot: k.boot === 'hda' || k.boot === 'cdrom' ? k.boot : 'fda', mem: MEMS.includes(k.mem ?? 0) ? k.mem! : 64 }
        for (const s of ['hda', 'fda'] as const) { const d = k[s]; if (d?.blob) o[s] = { name: String(d.name).slice(0, 80), buf: await gunzip(await d.blob.arrayBuffer()) } }
        if (live) setOwn(o)
      } catch { /* storage blocked */ }
    })()
    return () => { live = false }
  }, [])
  const hasOwn = !!(own.hda || own.fda || own.cdrom)

  /** a built-in system's C:: the copy kept in this browser, or the original */
  const loadC = async (s: Builtin): Promise<ArrayBuffer> => {
    const b = BUILT[s]
    try {
      const saved = await get<Blob>(b.key)
      if (saved) { const buf = await gunzip(await saved.arrayBuffer()); if (buf.byteLength === b.size) return buf }
    } catch { /* storage blocked: start from the original */ }
    setNote(`Fetching ${b.name} (${mb(b.gz)} the first time)`)
    return gunzip(await bytes(`/dos/${b.disk}`))
  }
  /** keep what this system's disks hold now, packed, in this browser */
  const keep = async (quiet = false) => {
    const s = sysRef.current
    try {
      if (s === 'own') {
        const o = ownRef.current
        if (!o.hda && !o.fda) { await del(OWN_KEY); return }
        const k: KeptOwn = { boot: o.boot, mem: o.mem }
        if (o.hda) k.hda = { name: o.hda.name, blob: await pack(o.hda.buf) }
        if (o.fda) k.fda = { name: o.fda.name, blob: await pack(o.fda.buf) }
        await set(OWN_KEY, k)
      } else {
        const b = cBufs.current[s]
        if (!b) return
        await set(BUILT[s].key, await pack(b))
      }
      if (!quiet) fx_say({ title: s === 'own' ? 'Your disks are kept in this browser' : 'C: kept in this browser', variant: 'success' })
    } catch { if (!quiet) fx_say({ title: 'Could not keep it', description: 'This browser refused the storage, or it is full.', variant: 'warning' }) }
  }

  // every web request from DOS: the blocklist, no private networks, then KillCORS (a page may not read most sites directly)
  const guarded = guardedFetch({ on: () => netOn.current })
  /** where your own disks start from: the one chosen if it is there, else the first that is */
  const startFrom = (o: Own): Slot => ([o.boot, 'fda', 'hda', 'cdrom'] as Slot[]).find((x) => !!o[x]) ?? 'fda'

  const start = async () => {
    if (emu.current || !screen.current) return
    const s = sysRef.current, o = ownRef.current
    if (s === 'own' && !o.hda && !o.fda && !o.cdrom) { setPanel('disks'); setNote('Load a disk image or make a blank hard disk first.'); return }
    setPhase('loading'); setNote('Starting')
    try {
      const [bios, vga] = await Promise.all([bytes('/dos/seabios.bin'), bytes('/dos/vgabios.bin')])
      bootSector.current ??= new Uint8Array(await bytes('/dos/boot-floppy.bin'))
      aBuf.current ??= floppy([], bootSector.current).slice().buffer
      const cfg: V86Options = {
        wasm_path: `/rt/${RT.v86}`,
        bios: { buffer: bios }, vga_bios: { buffer: vga },
        memory_size: (s === 'own' ? o.mem : 32) << 20, vga_memory_size: 8 << 20,
        screen: { container: screen.current, use_graphical_text: true },
        disable_keyboard: true, disable_mouse: true, autostart: true, acpi: false,
        net_device: { type: 'ne2k', relay_url: 'fetch' },
      }
      if (s === 'own') {
        if (o.hda) cfg.hda = { buffer: o.hda.buf }
        cfg.fda = { buffer: o.fda?.buf ?? aBuf.current }
        if (o.cdrom) cfg.cdrom = { buffer: o.cdrom.buf }
        const from = startFrom(o)
        cfg.boot_order = ORDER(from === 'hda' ? 0x312 : from === 'cdrom' ? 0x123 : 0x321)
      } else {
        cBufs.current[s] ??= await loadC(s)
        cfg.hda = { buffer: cBufs.current[s]! }
        cfg.fda = { buffer: aBuf.current }
        cfg.boot_order = ORDER(0x312)
      }
      if (sysRef.current !== s) { setPhase('off'); setNote(''); return } // the system changed while it loaded
      const e = new V86(cfg)
      emu.current = e
      e.add_listener('emulator-ready', () => {
        const r = e as unknown as Emu
        if (r.network_adapter) r.network_adapter.fetch = guarded
        // v86's fetch adapter keeps a view of a reused packet buffer when a request's headers come in two pieces (mTCP sends them
        // that way), so the next packet overwrote them; each piece is handed on as a copy
        r.bus.register('tcp-connection', ((conn: { emit: (ev: string, ...a: unknown[]) => void }) => {
          const P = Object.getPrototypeOf(conn) as { emit: (ev: string, ...a: unknown[]) => void; __copied?: boolean }
          if (P.__copied) return
          const emit = P.emit
          P.emit = function (this: unknown, ev: string, ...a: unknown[]) { if (ev === 'data' && a[0] instanceof Uint8Array) a[0] = a[0].slice(); return emit.call(this, ev, ...a) }
          P.__copied = true
        }) as never, null)
        setPhase('on'); setNote('')
        screen.current?.focus({ preventScroll: true })
      })
    } catch (err) {
      emu.current = null
      setPhase('off'); setNote(err instanceof Error ? `It did not start: ${err.message}` : 'It did not start.')
    }
  }
  const stop = async (keepIt = true) => {
    const e = emu.current
    if (!e) return
    emu.current = null
    clearTimeout(typing.current); queue.current = ''
    try { await e.destroy() } catch { /* already gone */ }
    setPhase('off'); setMods({ ctrl: false, alt: false })
    if (keepIt) await keep(true)
    redraw((n) => n + 1)
  }
  const pause = () => {
    const e = emu.current
    if (!e) return
    if (e.is_running()) { void e.stop(); setPhase('paused') } else { void e.run(); setPhase('on') }
  }
  useEffect(() => () => { void stop() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- powered off with the window, disks kept

  // put away while it cannot be seen: a hidden tab or a window in the tray uses no processor
  useEffect(() => {
    const check = () => {
      const e = emu.current
      if (!e) return
      const away = document.hidden || minimized
      if (away && e.is_running()) { void e.stop(); autoPaused.current = true }
      else if (!away && autoPaused.current) { autoPaused.current = false; void e.run() }
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [minimized])

  /** switch systems: the one running is powered off (its disks kept) and the new one started if a system was running */
  const pickSys = async (s: Sys) => {
    if (s === sysRef.current || busy) return
    const running = !!emu.current
    setBusy(true)
    await stop()
    setSys(s); setNote(''); setSure(null)
    setBusy(false)
    if (running && (s !== 'own' || ownRef.current.hda || ownRef.current.fda || ownRef.current.cdrom)) void start()
  }

  // the keyboard: only while the screen has the focus, so the rest of the page keeps its keys. A printable character is sent as the
  // US key that types it (DOS has a US keyboard), with Shift added or let go as that character needs, so any layout types what it
  // shows; everything else (arrows, F keys, Ctrl and Alt chords) is the physical key, pressed and released as you do.
  const held = useRef(new Set<string>())
  const pressed = useRef(new Map<string, { sc: number; pre: number[]; post: number[] }>())
  const shiftDown = () => held.current.has('ShiftLeft') || held.current.has('ShiftRight')
  const down = (ev: RKE<HTMLDivElement>) => {
    if (ev.key === 'Escape' && ev.shiftKey) { ev.currentTarget.blur(); return } // Shift + Esc leaves the screen
    if (!emu.current) return
    const phys = SC[ev.code]
    if (/^(Shift|Control|Alt)/.test(ev.code)) { if (!phys) return; ev.preventDefault(); ev.stopPropagation(); held.current.add(ev.code); sendCodes(make(phys)); return }
    const us = ev.key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey ? US[ev.key] : undefined
    const sc = us ? SC[us[0]] : phys
    if (!sc) return
    ev.preventDefault(); ev.stopPropagation()
    if (ev.repeat && pressed.current.has(ev.code)) { sendCodes(make(sc)); return }
    const pre: number[] = [], post: number[] = []
    if (us && us[1] && !shiftDown()) { pre.push(0x2a); post.push(0xaa) } // a character that needs Shift
    if (us && !us[1] && shiftDown()) { pre.push(0xaa); post.push(0x2a) } // one that must not have it
    if (!us && ev.shiftKey && !shiftDown()) { pre.push(0x2a); post.push(0xaa) }
    if (!us && ev.ctrlKey && !held.current.has('ControlLeft') && !held.current.has('ControlRight')) { pre.push(0x1d); post.push(0x9d) }
    if (!us && ev.altKey && !held.current.has('AltLeft') && !held.current.has('AltRight')) { pre.push(0x38); post.push(0xb8) }
    pressed.current.set(ev.code, { sc, pre, post })
    sendCodes([...pre, ...make(sc)])
  }
  const up = (ev: RKE<HTMLDivElement>) => {
    if (!emu.current) return
    if (/^(Shift|Control|Alt)/.test(ev.code)) { const c = SC[ev.code]; if (!c) return; ev.preventDefault(); ev.stopPropagation(); held.current.delete(ev.code); sendCodes(brk(c)); return }
    const k = pressed.current.get(ev.code)
    if (!k) return
    ev.preventDefault(); ev.stopPropagation()
    pressed.current.delete(ev.code)
    sendCodes([...brk(k.sc), ...k.post])
  }
  // leaving the screen lets go of every key, so nothing sticks down in DOS
  const release = () => {
    const codes: number[] = []
    for (const k of pressed.current.values()) codes.push(...brk(k.sc), ...k.post)
    for (const h of held.current) { const c = SC[h]; if (c) codes.push(...brk(c)) }
    pressed.current.clear(); held.current.clear()
    if (codes.length) sendCodes(codes)
  }
  const paste = (ev: React.ClipboardEvent<HTMLDivElement>) => { const t = ev.clipboardData.getData('text'); if (t) { ev.preventDefault(); typeText(t) } }

  // the mouse: a pointer lock on a computer, the screen as a trackpad on a touch screen
  const buttons = useRef([false, false, false])
  const sendButtons = () => raw()?.bus.send('mouse-click', [...buttons.current])
  const lastTouch = useRef(false)
  const kbd = useRef<HTMLTextAreaElement>(null) // an invisible box inside the screen: the device keyboard types into it, so nothing scrolls away to reach it
  const boxProps = {
    autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, rows: 1,
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter') { e.preventDefault(); tap('Enter') } else if (e.key === 'Backspace' && !e.currentTarget.value) { e.preventDefault(); tap('Backspace') } },
    onInput: (e: React.FormEvent<HTMLTextAreaElement>) => { const v = e.currentTarget.value; if (v) { typeText(v); e.currentTarget.value = '' } },
  } as const
  const pDown = (ev: RPE<HTMLDivElement>) => {
    // a finger or pen on the screen brings up the device's keyboard (the box below takes it; iPadOS says it has a fine pointer, so the
    // keys are not on by default there)
    if (ev.pointerType !== 'mouse' && !mouse && emu.current) { setKeys(true); lastTouch.current = true } else lastTouch.current = false
    if (!mouse || !emu.current) return
    if (ev.pointerType === 'mouse') {
      if (document.pointerLockElement !== ev.currentTarget) { void ev.currentTarget.requestPointerLock?.(); return }
      buttons.current[ev.button === 2 ? 2 : ev.button === 1 ? 1 : 0] = true; sendButtons()
      return
    }
    ev.currentTarget.setPointerCapture(ev.pointerId)
    touch.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0 })
  }
  const pMove = (ev: RPE<HTMLDivElement>) => {
    if (!mouse || !emu.current) return
    if (ev.pointerType === 'mouse') { if (document.pointerLockElement === ev.currentTarget) raw()?.bus.send('mouse-delta', [ev.movementX, -ev.movementY]); return }
    const p = touch.current.get(ev.pointerId)
    if (!p || touch.current.size > 1) return
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y
    p.x = ev.clientX; p.y = ev.clientY; p.moved += Math.abs(dx) + Math.abs(dy)
    raw()?.bus.send('mouse-delta', [Math.round(dx * 1.6), -Math.round(dy * 1.6)])
  }
  const pUp = (ev: RPE<HTMLDivElement>) => {
    if (!mouse || !emu.current) return
    if (ev.pointerType === 'mouse') { if (document.pointerLockElement === ev.currentTarget) { buttons.current[ev.button === 2 ? 2 : ev.button === 1 ? 1 : 0] = false; sendButtons() } return }
    const p = touch.current.get(ev.pointerId)
    const fingers = touch.current.size
    touch.current.delete(ev.pointerId)
    if (!p || p.moved > 12 || performance.now() - p.t > 350) return
    // a tap clicks; a tap with two fingers clicks the right button
    const b = fingers > 1 ? 2 : 0
    buttons.current[b] = true; sendButtons()
    setTimeout(() => { buttons.current[b] = false; sendButtons() }, 60)
  }
  const wheel = (ev: React.WheelEvent<HTMLDivElement>) => { if (mouse && document.pointerLockElement === ev.currentTarget) raw()?.bus.send('mouse-wheel', [Math.sign(ev.deltaY), 0]) }

  // files in: a floppy in A: when they fit, otherwise C:\IMPORT of the hard disk the PC has
  const hdaView = (): Uint8Array | null => {
    const s = sysRef.current
    const buf = s === 'own' ? ownRef.current.hda?.buf : cBufs.current[s]
    return buf ? volumeOf(new Uint8Array(buf)) : null
  }
  const aEntries = (): Entry[] => { try { return aBuf.current ? list(new Uint8Array(aBuf.current), false, 2000).filter((e) => !e.dir) : [] } catch { return [] } }
  const pickFiles = async (ev: ChangeEvent<HTMLInputElement>) => {
    const fs = [...(ev.target.files ?? [])]
    ev.target.value = ''
    if (!fs.length) return
    const got: Entry[] = await Promise.all(fs.map(async (f) => ({ path: f.name, data: new Uint8Array(await f.arrayBuffer()), date: new Date(f.lastModified) })))
    setPending(got); setPanel('import')
  }
  const toA = async () => {
    try {
      const next = floppy([...(aBuf.current ? list(new Uint8Array(aBuf.current)).filter((e) => !e.dir) : []), ...pending], bootSector.current ?? undefined).slice().buffer
      aBuf.current = next
      if (emu.current) await emu.current.set_fda({ buffer: next })
      fx_say({ title: `${pending.length} file${pending.length === 1 ? '' : 's'} on A:`, description: 'COPY A:*.* C:\\ copies them to C:.', variant: 'success' })
      setPending([]); setPanel(null)
    } catch (err) { fx_say({ title: 'Could not put them on A:', description: err instanceof Error ? `${err.message}. A floppy holds 1.4 MB; use C: instead.` : undefined, variant: 'warning' }) }
  }
  const toC = async () => {
    const running = !!emu.current
    if (running) await stop()
    const s = sysRef.current
    if (s !== 'own') cBufs.current[s] ??= await loadC(s)
    const buf = s === 'own' ? ownRef.current.hda?.buf : cBufs.current[s]
    const vol = buf ? volumeOf(new Uint8Array(buf)) : null
    if (!buf || !vol) { fx_say({ title: 'No drive C: to put them on', description: buf ? whyNot(buf) : 'Load or make a hard disk first.', variant: 'warning' }); if (running) void start(); return }
    try {
      writeFiles(vol, pending.map((e) => ({ ...e, path: `IMPORT/${e.path}` })))
      await keep(true)
      fx_say({ title: `${pending.length} file${pending.length === 1 ? '' : 's'} in C:\\IMPORT`, variant: 'success' })
      setPending([]); setPanel(null)
    } catch (err) { fx_say({ title: 'Could not put them on C:', description: `${err instanceof Error ? err.message : 'Error'}. ${(free(vol) / 1048576).toFixed(1)} MB free.`, variant: 'warning' }) }
    if (running) void start()
  }

  // your own disks: a Windows 95 or 98 install you have a licence for, a boot floppy with your own MS-DOS 7, a CD, or a blank disk
  const loadOwn = async (ev: ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    if (f.size > DISK_MAX) { fx_say({ title: 'Too big', description: 'Up to 1 GB.', variant: 'warning' }); return }
    let buf = await f.arrayBuffer()
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (buf.byteLength > 512 && new TextDecoder().decode(new Uint8Array(buf, buf.byteLength - 512, 8)) === 'conectix') buf = buf.slice(0, buf.byteLength - 512) // a .vhd footer
    const kind: Slot = ext === 'iso' ? 'cdrom' : buf.byteLength <= FLOPPY_MAX ? 'fda' : 'hda'
    await stop()
    const o: Own = { ...ownRef.current, [kind]: { name: f.name.slice(0, 80), buf }, boot: kind }
    setOwn(o); setSys('own'); setSure(null); setPanel('disks')
    await keep(true)
    fx_say({ title: `${f.name} loaded as ${kind === 'hda' ? 'the hard disk' : kind === 'fda' ? 'the floppy' : 'the CD'}`, description: 'Power on to boot it.' })
  }
  const makeBlank = async () => {
    if (ownRef.current.hda && sure !== 'blank') { setSure('blank'); setTimeout(() => setSure(null), 3000); return }
    setSure(null)
    await stop()
    try {
      const mbr = new Uint8Array(await bytes('/dos/mbr.bin'))
      const { disk } = hardDisk(Math.round((blankMb * 1048576) / (16 * 63 * 512)), mbr, undefined, 'NO NAME')
      const o: Own = { ...ownRef.current, hda: { name: `blank-${blankMb}MB.img`, buf: disk.buffer as ArrayBuffer }, boot: ownRef.current.fda ? 'fda' : 'hda' }
      setOwn(o); setSys('own')
      await keep(true)
      fx_say({ title: `Blank ${blankMb} MB hard disk made`, description: 'Boot your MS-DOS floppy, then run FDISK, FORMAT C: /S or SYS C:.' })
    } catch { fx_say({ title: 'Could not make the disk', variant: 'warning' }) }
  }
  const drop = async (s: Slot) => {
    await stop()
    const o = { ...ownRef.current }
    delete o[s]
    if (!o[o.boot]) o.boot = startFrom(o)
    setOwn(o); await keep(true)
  }
  const setBoot = (b: Slot) => { setOwn({ ...ownRef.current, boot: b }); void keep(true) }
  const setMem = (m: number) => { setOwn({ ...ownRef.current, mem: m }); void keep(true) }
  const resetC = async () => {
    if (sys === 'own') {
      if (sure !== 'reset') { setSure('reset'); setTimeout(() => setSure(null), 3000); return }
      setSure(null); await stop(false); setOwn(NO_OWN)
      try { await del(OWN_KEY) } catch { /* nothing kept */ }
      fx_say({ title: 'Your disks are gone' }); return
    }
    if (sure !== 'reset') { setSure('reset'); setTimeout(() => setSure(null), 3000); return }
    setSure(null)
    await stop(false)
    try { await del(BUILT[sys].key) } catch { /* nothing kept */ }
    cBufs.current[sys] = null
    fx_say({ title: 'C: is back to how it came' })
  }

  const ctrlAltDel = () => sendCodes([0x1d, 0x38, 0xe0, 0x53, 0xe0, 0xd3, 0xb8, 0x9d])
  const copyText = () => {
    const t = raw()?.screen_adapter?.get_text_screen().map((l) => l.trimEnd()).join('\n').replace(/\n+$/, '')
    if (!t) return
    void navigator.clipboard?.writeText(t).then(() => fx_say({ title: 'Screen text copied', variant: 'success' }))
  }
  const full = () => { const el = screen.current?.parentElement; if (el && !document.fullscreenElement) void el.requestFullscreen?.() }
  const saveFile = (v: Uint8Array | null, path: string) => { const d = v && read(v, path); if (d) download(d.slice(), path.split('/').pop()!) }

  const on = phase === 'on' || phase === 'paused'
  const btn = cn(key, 'size-11 shrink-0 md:size-9')
  const title = sys === 'own' ? 'your disks' : BUILT[sys].name
  const hv = panel === 'files' ? hdaView() : null
  const cList: Entry[] = hv ? list(hv, false, 2000).filter((e) => !e.dir) : []
  const ownHda = ownRef.current.hda?.buf
  const seg = 'h-11 border px-3 text-[13px] md:h-9'

  return (
    <div className="grid gap-2">
      <div role="radiogroup" aria-label="System" className="flex flex-wrap">
        {(['freedos', 'msdos4', 'own'] as Sys[]).map((s, i) => (
          <button key={s} role="radio" aria-checked={sys === s} disabled={busy} onClick={() => void pickSys(s)} className={cn(seg, i > 0 && '-ml-px', sys === s ? 'border-signal bg-signal text-on-signal' : 'border-ink/25 text-ink-2 hover:text-ink')}>
            {s === 'own' ? 'Your disks' : BUILT[s].name}{s !== 'own' && <span className="ml-1.5 text-[11px] opacity-70">{BUILT[s].tag}</span>}
          </button>
        ))}
      </div>
      <div className="relative bg-black">
        <textarea ref={kbd} aria-label="Type to the PC" tabIndex={-1} {...boxProps} style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, fontSize: 16, border: 0, padding: 0, resize: 'none', pointerEvents: 'none' }} />
        <div
          ref={screen} tabIndex={0} role="application" aria-roledescription="PC screen"
          aria-label={on ? `${title} screen. Type here; Shift and Escape leaves it.` : `${title} screen, powered off`}
          onKeyDown={down} onKeyUp={up} onPaste={paste} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); release() }}
          onClick={() => { if (lastTouch.current) kbd.current?.focus({ preventScroll: true }) }} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={(e) => touch.current.delete(e.pointerId)} onWheel={wheel}
          onContextMenu={(e) => mouse && e.preventDefault()} data-no-drag data-fill style={{ '--fill': keys ? '16rem' : '13rem', touchAction: mouse ? 'none' : 'manipulation' } as React.CSSProperties}
          className={cn('dos-screen mx-auto aspect-[4/3] h-[min(46vh,25rem)] max-w-full outline-none', focused && 'ring-2 ring-signal')}
        >
          <div style={{ whiteSpace: 'pre', font: '14px monospace', lineHeight: '14px' }} />
          <canvas />
        </div>
        {!on && (
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-4 text-center">
            {phase === 'loading'
              ? <p className="hud !text-ink" role="status">{note || 'Starting'}</p>
              : <>
                  <button onClick={() => void start()} className="inline-flex h-12 items-center gap-2 bg-signal px-6 font-semibold text-on-signal"><Power className="size-4" />{sys === 'own' ? (hasOwn ? 'Boot your disks' : 'Set up your disks') : `Power on ${BUILT[sys].name}`}</button>
                  <p className="max-w-[44ch] text-[12px] leading-[1.45] text-ink-3" role="status">{note || (sys === 'own' ? 'A Windows 95 or 98 install, an MS-DOS 7 boot floppy or a CD you have a licence for.' : BUILT[sys].blurb)}</p>
                </>}
          </div>
        )}
        {on && !focused && !mouse && <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-0.5 text-[11px] text-ink-2">Tap or click the screen to type</p>}
      </div>

      {on && (
        <div className={keys ? 'grid gap-1' : 'sr-only'}>
          <div data-no-drag tabIndex={0} role="region" aria-label="DOS keys" className="scroll-x flex gap-1">
            <button onClick={() => typer.current?.focus()} className={cn(key, 'h-11 shrink-0 gap-1.5 px-3 text-[13px]')}><Keyboard className="size-4" />Type</button>
            {PAD.map((p) => (
              <button key={p.k} onClick={() => tap(p.k)} aria-label={p.aria} aria-pressed={p.k === 'ControlLeft' ? mods.ctrl : p.k === 'AltLeft' ? mods.alt : undefined}
                className={cn(key, 'h-11 min-w-11 shrink-0 px-2 font-mono text-[13px]', ((p.k === 'ControlLeft' && mods.ctrl) || (p.k === 'AltLeft' && mods.alt)) && 'border-signal bg-signal text-on-signal')}>{p.label}</button>
            ))}
          </div>
          {/* the phone's own keyboard types into this, and what it types goes to DOS */}
          <textarea
            ref={typer} aria-label="Type to the PC" {...boxProps}
            className="h-11 w-full resize-none border border-ink/25 bg-transparent px-2 py-2 font-mono text-[16px] text-ink placeholder:text-ink-3 focus:border-signal" placeholder="Type here and it goes to DOS"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {on
          ? <button onClick={() => void stop()} aria-label="Power off (disks are kept)" title="Power off (disks are kept)" className={btn}><Power className="size-4" /></button>
          : <button onClick={() => void start()} disabled={phase === 'loading'} aria-label="Power on" title="Power on" className={cn(btn, 'disabled:opacity-40')}><Play className="size-4" /></button>}
        <button onClick={pause} disabled={!on} aria-label={phase === 'paused' ? 'Carry on' : 'Pause'} title={phase === 'paused' ? 'Carry on' : 'Pause'} className={cn(btn, 'disabled:opacity-40')}>{phase === 'paused' ? <Play className="size-4" /> : <Pause className="size-4" />}</button>
        <button onClick={ctrlAltDel} disabled={!on} aria-label="Restart (Ctrl, Alt, Del)" title="Restart (Ctrl+Alt+Del)" className={cn(btn, 'disabled:opacity-40')}><RotateCcw className="size-4" /></button>
        <button onClick={() => setKeys((k) => !k)} aria-pressed={keys} aria-label="On-screen keys" title="On-screen keys" className={cn(btn, keys && 'border-signal')}><Keyboard className="size-4" /></button>
        <button onClick={() => setMouse((m) => !m)} aria-pressed={mouse} aria-label={mouse ? 'Mouse on: the screen moves the DOS mouse' : 'Use the screen as the DOS mouse'} title="Mouse" className={cn(btn, mouse && 'border-signal')}><MousePointer2 className="size-4" /></button>
        <button onClick={() => setNet((n) => !n)} aria-pressed={net} aria-label={net ? 'Network on. Turn it off' : 'Network off. Turn it on'} title={net ? 'Network on' : 'Network off'} className={cn(btn, net && 'border-signal')}>{net ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}</button>
        <span className="mx-0.5 h-6 w-px bg-ink/15" aria-hidden />
        <button onClick={() => fileIn.current?.click()} aria-label="Import files to DOS" title="Import files" className={btn}><Upload className="size-4" /></button>
        <button onClick={() => setPanel(panel === 'files' ? null : 'files')} aria-pressed={panel === 'files'} aria-label="Export files from DOS" title="Export files" className={cn(btn, panel === 'files' && 'border-signal')}><Download className="size-4" /></button>
        <button onClick={() => setPanel(panel === 'disks' ? null : 'disks')} aria-pressed={panel === 'disks'} aria-label="Disks: your own images" title="Disks" className={cn(btn, panel === 'disks' && 'border-signal')}><HardDrive className="size-4" /></button>
        <button onClick={() => void keep()} disabled={sys === 'own' && !hasOwn} aria-label="Keep the disks in this browser now" title="Keep disks now" className={cn(btn, 'disabled:opacity-40')}><Save className="size-4" /></button>
        <button onClick={copyText} disabled={!on} aria-label="Copy the text on the screen" title="Copy screen text" className={cn(btn, 'disabled:opacity-40')}><ClipboardCopy className="size-4" /></button>
        <button onClick={full} disabled={!on} aria-label="Full screen" title="Full screen" className={cn(btn, 'disabled:opacity-40')}><Maximize2 className="size-4" /></button>
        <input ref={fileIn} type="file" multiple hidden onChange={(e) => void pickFiles(e)} />
        <input ref={diskIn} type="file" hidden accept=".img,.ima,.vhd,.iso,.dsk,.bin,.vfd,.flp,.vmdk" onChange={(e) => void loadOwn(e)} />
      </div>

      {panel === 'import' && pending.length > 0 && (
        <div className="grid gap-2 border border-ink/20 p-2">
          <p className="text-[13px] text-ink">{pending.length} file{pending.length === 1 ? '' : 's'}, {(pending.reduce((n, e) => n + (e.data?.length ?? 0), 0) / 1024).toFixed(0)} KB. {sys === 'freedos' ? 'Long names work.' : 'Long names get 8.3 short names too.'}</p>
          <div className="flex flex-wrap gap-1">
            {!(sys === 'own' && ownRef.current.fda) && <button onClick={() => void toA()} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal md:h-9">Put on A: (floppy)</button>}
            {(sys !== 'own' || ownRef.current.hda) && <button onClick={() => void toC()} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>Put in C:\IMPORT{on ? ' (restarts)' : ''}</button>}
            <button onClick={() => { setPending([]); setPanel(null) }} aria-label="Cancel" className={btn}><X className="size-4" /></button>
          </div>
        </div>
      )}

      {panel === 'files' && (
        <div className="grid gap-1 border border-ink/20 p-2">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="hud">Files</p>
            <div className="flex flex-wrap gap-1">
              {aBuf.current && <button onClick={() => download(aBuf.current!.slice(0), 'friction-a.img')} className={cn(key, 'h-11 px-3 text-[12px] md:h-8')}>A: as an image</button>}
              {(sys === 'own' ? ownHda : cBufs.current[sys]) && <button onClick={() => download(((sys === 'own' ? ownHda : cBufs.current[sys]) as ArrayBuffer).slice(0), sys === 'own' ? ownRef.current.hda!.name : `${sys}-c.img`)} className={cn(key, 'h-11 px-3 text-[12px] md:h-8')}>C: as an image</button>}
            </div>
          </div>
          <div data-no-drag tabIndex={0} role="region" aria-label="Files on A: and C:" className="scroll-y max-h-44">
            <h4 className="hud mt-1">A:</h4>
            {aEntries().length === 0 ? <p className="text-[12px] text-ink-3">Nothing here.</p> : (
              <ul className="grid">{aEntries().map((e) => <li key={e.path}><button onClick={() => saveFile(new Uint8Array(aBuf.current!), e.path)} className="flex min-h-9 w-full items-center justify-between gap-2 border-b border-ink/10 px-1 text-left text-[12.5px] hover:bg-ink/5"><span className="truncate">{'A:\\' + e.path.replace(/\//g, '\\')}</span><span className="fig shrink-0 text-ink-3">{(e.size ?? 0).toLocaleString('en-US')}</span></button></li>)}</ul>
            )}
            <h4 className="hud mt-1">C:</h4>
            {!hv ? <p className="text-[12px] text-ink-3">{sys === 'own' ? (ownHda ? whyNot(ownHda) : 'No hard disk loaded.') : 'Power on once to load it.'}</p>
              : cList.length === 0 ? <p className="text-[12px] text-ink-3">Nothing here.</p> : (
                <ul className="grid">{cList.map((e) => <li key={e.path}><button onClick={() => saveFile(hv, e.path)} className="flex min-h-9 w-full items-center justify-between gap-2 border-b border-ink/10 px-1 text-left text-[12.5px] hover:bg-ink/5"><span className="truncate">{'C:\\' + e.path.replace(/\//g, '\\')}</span><span className="fig shrink-0 text-ink-3">{(e.size ?? 0).toLocaleString('en-US')}</span></button></li>)}</ul>
              )}
            {cList.length >= 2000 && <p className="text-[12px] text-ink-3">The first 2,000 files.</p>}
          </div>
          <p className="text-[12px] text-ink-3">Tap a file to save it to your device. What DOS has open now may not be written yet: Power off first for a whole copy.</p>
        </div>
      )}

      {panel === 'disks' && (
        <div className="grid gap-2 border border-ink/20 p-2 text-[13px] leading-[1.45] text-ink-2">
          <p>{sys === 'own' ? 'Your disks stay in this browser, packed, when you power off. Windows 95 or 98 needs a licence you own.' : 'Switch to Your disks to boot an image of your own, or to make a blank hard disk and put your own MS-DOS 7 on it.'}</p>
          <div className="flex flex-wrap items-center gap-1">
            <button onClick={() => diskIn.current?.click()} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal md:h-9">Load an image</button>
            <label className="flex items-center gap-1 text-[12px]">Blank disk
              <select value={blankMb} onChange={(e) => setBlankMb(Number(e.target.value))} className="h-11 border border-ink/25 bg-transparent px-2 text-[13px] text-ink md:h-9">{BLANKS.map((n) => <option key={n} value={n} className="bg-surface text-ink">{n} MB</option>)}</select>
            </label>
            <button onClick={() => void makeBlank()} className={cn(key, 'h-11 px-3 text-[13px] md:h-9', sure === 'blank' && 'border-signal text-signal')}>{sure === 'blank' ? 'Sure? It replaces your disk' : 'Make it'}</button>
          </div>
          {sys === 'own' && (
            <div className="grid gap-1">
              {(['hda', 'fda', 'cdrom'] as Slot[]).map((s) => ownRef.current[s] && (
                <div key={s} className="flex items-center gap-2 border-b border-ink/10 pb-1">
                  <span className="fig w-16 shrink-0 text-ink-3">{s === 'hda' ? 'Hard disk' : s === 'fda' ? 'Floppy' : 'CD'}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{ownRef.current[s]!.name} <span className="text-ink-3">{mb(ownRef.current[s]!.buf.byteLength)}</span></span>
                  <button onClick={() => void drop(s)} aria-label={`Remove ${ownRef.current[s]!.name}`} className="grid size-11 place-items-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <label className="flex items-center gap-1">Boot from
                  <select value={startFrom(own)} onChange={(e) => setBoot(e.target.value as Slot)} className="h-11 border border-ink/25 bg-transparent px-2 text-[13px] text-ink md:h-9">{(['fda', 'hda', 'cdrom'] as Slot[]).filter((s) => own[s]).map((s) => <option key={s} value={s} className="bg-surface text-ink">{s === 'hda' ? 'Hard disk' : s === 'fda' ? 'Floppy' : 'CD'}</option>)}</select>
                </label>
                <label className="flex items-center gap-1">Memory
                  <select value={own.mem} onChange={(e) => setMem(Number(e.target.value))} className="h-11 border border-ink/25 bg-transparent px-2 text-[13px] text-ink md:h-9">{MEMS.map((m) => <option key={m} value={m} className="bg-surface text-ink">{m} MB</option>)}</select>
                </label>
              </div>
              <p className="text-[12px] text-ink-3">MS-DOS 7 from your own floppy: load its image, make a blank disk, boot the floppy, then SYS C: (or FDISK, FORMAT C: /S). A disk bigger than the 504 MB the BIOS reaches is not supported.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            <button onClick={() => void resetC()} className={cn(key, 'h-11 px-3 text-[13px] md:h-9', sure === 'reset' && 'border-signal text-signal')}>{sure === 'reset' ? 'Sure? It wipes it' : sys === 'own' ? 'Remove all my disks' : 'Reset C: to how it came'}</button>
          </div>
        </div>
      )}

      <p className="text-[12px] leading-[1.4] text-ink-3">
        {sys === 'freedos' ? 'FreeDOS 1.3 (GPL), which answers as DOS 7.10, in v86, in this browser. Type HELP in DOS.' : sys === 'msdos4' ? 'MS-DOS 4.00 from Microsoft\'s open-source release (MIT) in v86, in this browser. Type HELP in DOS.' : 'Your disks in v86, in this browser.'} Web requests from DOS go through KillCORS, a public relay, and Friction's blocklist. Disks are kept here when you power off.{' '}
        <a href="/dos/src/" className="underline">Sources</a>
      </p>
    </div>
  )
}
