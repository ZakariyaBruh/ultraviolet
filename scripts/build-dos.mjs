// Builds the two C: drives of the Code window's PC. FreeDOS 1.3 (GPL; its kernel answers programs as DOS 7.10, the version of
// MS-DOS inside Windows 98, which Microsoft has never released) from the FreeDOS 1.3 repository packages, with the boot code of the
// FreeDOS 1.3 Lite image. And MS-DOS 4.00 (Microsoft's open-source release, MIT licence, as compiled by the
// Internet Archive's "MSDOS 4.00-builds" from github.com/microsoft/MS-DOS with Neozeed's fixes), an NE2000 packet driver and mTCP
// for the network (HTTP goes out through the browser's own fetch, see components/app/widgets/Dos.tsx), CuteMouse, FreeDOS EDIT,
// Info-ZIP UnZip and the MicroWeb browser. Everything on it is free to share; the licences are on the disk (C:\LICENSE) and the
// sources of the GPL programs are served next to it (public/dos/src).
//
// Run by hand when one of those changes (it needs the network): node scripts/build-dos.mjs. The result is committed, so a normal
// build does not need any of these sites.
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname
const CACHE = join(ROOT, '.cache/dos')
const OUT = join(ROOT, 'public/dos')
mkdirSync(CACHE, { recursive: true })
mkdirSync(join(OUT, 'src'), { recursive: true })

const FREEDOS = 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.3'
const GET = {
  'v4builds.zip': 'https://archive.org/download/dos4-april2024/v4.0-builds.zip',
  'crynwr.zip': `${FREEDOS}/net/crynwr.zip`,
  'ctmouse.zip': `${FREEDOS}/base/ctmouse.zip`,
  'edit.zip': `${FREEDOS}/base/edit.zip`,
  'unzip.zip': `${FREEDOS}/archiver/unzip.zip`,
  'mtcp.zip': 'http://www.brutman.com/mTCP/download/mTCP_2026-10-10.zip',
  'mtcp-src.zip': 'http://www.brutman.com/mTCP/download/mTCP-src_2026-10-10.zip',
  'microweb.zip': 'http://www.brutman.com/mTCP/download/MicroWeb_2.1.zip',
  'microweb-src.zip': 'https://github.com/jhhoward/MicroWeb/archive/refs/tags/v2.1.zip',
  'fd13-lite.zip': 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/distributions/1.3/official/FD13-LiteUSB.zip',
  ...Object.fromEntries(Object.entries({
    kernel: 'base', freecom: 'base', himemx: 'base', edit: 'base', attrib: 'base', choice: 'base', deltree: 'base', find: 'base', mem: 'base',
    more: 'base', move: 'base', sort: 'base', tree: 'base', xcopy: 'base', fc: 'base', label: 'base', mode: 'base', format: 'base', fdisk: 'base',
    debug: 'base', ctmouse: 'base', doslfn: 'drivers', unzip: 'archiver', zip: 'archiver', fdnpkg: 'util', cwsdpmi: 'util',
  }).map(([pkg, repo]) => [`fd-${pkg}.zip`, `https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.3/${repo}/${pkg}.zip`])),
  'seabios.bin': 'https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin',
  'vgabios.bin': 'https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin',
}
for (const [name, url] of Object.entries(GET)) {
  const to = join(CACHE, name)
  if (existsSync(to)) continue
  console.log('fetching', url)
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  writeFileSync(to, Buffer.from(await r.arrayBuffer()))
}

// the FAT library the app uses, bundled for node
const { outputFiles } = await build({ entryPoints: [join(ROOT, 'src/lib/fat.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const F = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

// zip entries with python's zipfile (always there on the build machine; node has no unzip of its own)
const unzip = (zip, inner) => execFileSync('python3', ['-c', 'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))', zip, inner], { maxBuffer: 64 << 20 })
const unzipNested = (zip, mid, inner, bytes) => execFileSync('python3', ['-c', 'import sys,zipfile,io;z=zipfile.ZipFile(io.BytesIO(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2])));f=z.open(sys.argv[3]);sys.stdout.buffer.write(f.read(int(sys.argv[4])))', zip, mid, inner, String(bytes)], { maxBuffer: 64 << 20 })
const C = (n) => join(CACHE, n)

const BUILD = 'v4.0-builds/april2024/26'
const floppyImg = new Uint8Array(unzip(C('v4builds.zip'), `${BUILD}/bootdisk144/msdos4-26april2024.img`))
const vhd = new Uint8Array(unzipNested(C('v4builds.zip'), `${BUILD}/86Box_socket7_machine/DOS4 From Scratch april262024.zip`, 'DOS4 From Scratch april262024/IDE/489mb/C.vhd', 63 * 512 + 512))
const mbr = vhd.subarray(0, 512)
const hddBoot = vhd.subarray(63 * 512, 64 * 512)
if (String.fromCharCode(...hddBoot.subarray(3, 11)) !== 'MSDOS4.0') throw new Error('unexpected boot sector')
writeFileSync(join(OUT, 'boot-floppy.bin'), floppyImg.subarray(0, 512)) // the floppy boot sector: the transfer disk A: is made with it
writeFileSync(join(OUT, 'mbr.bin'), mbr) // the MBR of MS-DOS 4.00 (MIT), for the blank hard disks the window makes

const dosFiles = F.list(floppyImg).filter((e) => !e.dir)
const fromFloppy = (n) => dosFiles.find((e) => e.path === n).data
const enc = (s) => new TextEncoder().encode(s.replace(/\r?\n/g, '\r\n'))

const IRQ = process.env.DOS_IRQ || '10'
const files = []
const add = (path, data, attr) => files.push({ path, data, attr })
// IO.SYS and MSDOS.SYS go first, so they are the first two root entries and IO.SYS starts at the first data cluster, as the boot sector wants
add('IO.SYS', fromFloppy('IO.SYS'), 0x27)
add('MSDOS.SYS', fromFloppy('MSDOS.SYS'), 0x27)
add('COMMAND.COM', fromFloppy('COMMAND.COM'))
add('CONFIG.SYS', enc(`BREAK=ON
FILES=30
BUFFERS=20
LASTDRIVE=Z
DEVICE=C:\\DOS\\ANSI.SYS
SHELL=C:\\COMMAND.COM C:\\ /E:1024 /P
`))
add('AUTOEXEC.BAT', enc(`@ECHO OFF
PROMPT $P$G
PATH C:\\DOS;C:\\NET;C:\\TOOLS;C:\\WEB;C:\\
SET MTCPCFG=C:\\NET\\MTCP.CFG
SET TEMP=C:\\TEMP
SET TZ=UTC0
CTMOUSE >NUL
NE2000 0x60 ${IRQ} 0x300 >NUL
IF ERRORLEVEL 1 GOTO NONET
DHCP -timeout 5 -retries 2 >NUL
IF ERRORLEVEL 1 GOTO NONET
ECHO Network: on. HTTP goes out through your browser.
GOTO DONE
:NONET
ECHO Network: off.
:DONE
ECHO.
ECHO MS-DOS 4.00, Microsoft's open source release. Type HELP for what is here.
ECHO.
`))
add('HELP.BAT', enc(`@ECHO OFF
ECHO.
ECHO  DIR, CD, COPY, TYPE, DEL, MD, XCOPY, MEM   the usual MS-DOS 4 commands
ECHO  EDIT FILE.TXT        a text editor (FreeDOS EDIT)
ECHO  EDLIN FILE.TXT       the editor MS-DOS 4 came with
ECHO  DEBUG                assemble and run machine code
ECHO  UNZIP FILE.ZIP       unpack a zip you imported
ECHO.
ECHO  HTGET -o PAGE.HTM http://example.com/    fetch a file from the web
ECHO  CURL http://example.com/                 the same, shown on screen
ECHO  MICROWEB http://en.wikipedia.org/        a graphical web browser
ECHO  PING 192.168.86.1                        check the network card
ECHO.
ECHO  A: is the transfer floppy. Import puts files on it; COPY A:*.* C:\\
ECHO  Export in the window saves files from A: or C: to your device.
ECHO  Only HTTP works from DOS (the browser turns it into HTTPS for you).
ECHO  FTP, Telnet and IRC need raw sockets, which a web page cannot open.
ECHO.
`))
add('CURL.BAT', enc(`@ECHO OFF
IF "%1"=="" GOTO USE
HTGET -quiet %1 %2 %3 %4 %5
GOTO END
:USE
ECHO Usage: CURL http://address/ [-o FILE]
:END
`))
add('README.TXT', enc(`FRICTION DOS
============

This disk runs MS-DOS 4.00, from the source code Microsoft and IBM released
under the MIT licence in April 2024 (github.com/microsoft/MS-DOS), compiled by
the Internet Archive item "MSDOS 4.00-builds" with fixes by Neozeed.

It runs in your browser in v86 (copy.sh/v86, BSD licence). Nothing runs on a
server. The network card is an NE2000; its HTTP requests are turned into the
browser's own fetch() and go out through KillCORS (proxy.killcors.com), a free
public CORS relay, because a web page may not read most sites directly.
Blocked kinds of site (games, short video) are refused, as in Friction's Browser.

What else is here, and its licence:
  C:\\NET\\NE2000.COM   Crynwr packet driver               GPL
  C:\\NET\\*.EXE        mTCP by Michael Brutman            GPL 3
  C:\\TOOLS\\CTMOUSE    CuteMouse                          GPL
  C:\\TOOLS\\EDIT       FreeDOS EDIT                       GPL 2
  C:\\TOOLS\\UNZIP      Info-ZIP UnZip                     Info-ZIP licence
  C:\\WEB\\MICROWEB     MicroWeb by James Howard           GPL 2
The licence texts are in C:\\LICENSE. The source code of each GPL program is at
https://www.frictionx.app/dos/src/ and at its home page:
  mTCP       http://www.brutman.com/mTCP/
  MicroWeb   https://github.com/jhhoward/MicroWeb
  FreeDOS    https://www.ibiblio.org/pub/micro/pc-stuff/freedos/
`))

for (const e of dosFiles) {
  if (['IO.SYS', 'MSDOS.SYS', 'COMMAND.COM'].includes(e.path) || e.path.startsWith('SELECT')) continue
  add(`DOS/${e.path}`, e.data)
}
add('TEMP', undefined); files[files.length - 1].dir = true

const pick = (zip, inner, to) => add(to, new Uint8Array(unzip(C(zip), inner)))
pick('crynwr.zip', 'DRIVERS/CRYNWR/NE2000.COM', 'NET/NE2000.COM')
for (const x of ['dhcp.exe', 'htget.exe', 'ping.exe', 'dnstest.exe', 'pkttool.exe']) pick('mtcp.zip', x, `NET/${x.toUpperCase()}`)
add('NET/MTCP.CFG', enc(`PACKETINT 0x60
HOSTNAME FRICTION
`))
pick('ctmouse.zip', 'BIN/CTMOUSE.EXE', 'TOOLS/CTMOUSE.EXE')
pick('edit.zip', 'BIN/EDIT.EXE', 'TOOLS/EDIT.EXE')
pick('edit.zip', 'BIN/EDIT.HLP', 'TOOLS/EDIT.HLP')
pick('unzip.zip', 'BIN/UNZIP.EXE', 'TOOLS/UNZIP.EXE')
for (const x of ['MICROWEB.EXE', 'DEFAULT.DAT', 'EGA.DAT', 'CGA.DAT', 'LOWRES.DAT']) pick('microweb.zip', `MicroWeb_2.1/${x}`, `WEB/${x}`)

const MIT = `MS-DOS v1.25, v2.0 and v4.0 source code and binaries
Copyright (c) Microsoft Corporation. MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in the
Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`
add('LICENSE/MSDOS.TXT', enc(MIT))
pick('mtcp.zip', 'COPYING.TXT', 'LICENSE/GPL3.TXT')
pick('crynwr.zip', 'DOC/CRYNWR/GPL.DOC', 'LICENSE/CRYNWR.TXT')
pick('edit.zip', 'DOC/EDIT/COPYING', 'LICENSE/GPL2.TXT')
pick('unzip.zip', 'DOC/UNZIP/LICENSE', 'LICENSE/INFOZIP.TXT')

// 64 cylinders of 16 heads and 63 sectors: 31.5 MB, one FAT16 partition from sector 63
const { disk, volume } = F.hardDisk(64, mbr, hddBoot, 'FRICTION')
F.writeFiles(volume, [...files, { path: 'FRICTION', attr: 0x08 }]) // the volume label, after the system files
const check = F.list(volume)
if (check[0].path !== 'IO.SYS' || check[1].path !== 'MSDOS.SYS') throw new Error('system files are not first')

// ───────── FreeDOS 1.3 ─────────
const zipList = (zip) => JSON.parse(execFileSync('python3', ['-c', 'import sys,zipfile,json;print(json.dumps([i.filename for i in zipfile.ZipFile(sys.argv[1]).infolist() if not i.filename.endswith("/")]))', zip]).toString())
const liteImg = new Uint8Array(unzip(C('fd13-lite.zip'), 'FD13LITE.img'))
const fdMbr = liteImg.subarray(0, 512)
const fdBoot = liteImg.subarray(63 * 512, 64 * 512)
if (String.fromCharCode(...fdBoot.subarray(3, 11)) !== 'FRDOS5.1' || !String.fromCharCode(...fdBoot).includes('KERNEL  SYS')) throw new Error('unexpected FreeDOS boot sector')

const fd = []
const fdAdd = (path, data, attr) => fd.push({ path, data, attr })
const PKGS = ['kernel', 'freecom', 'himemx', 'edit', 'attrib', 'choice', 'deltree', 'find', 'mem', 'more', 'move', 'sort', 'tree', 'xcopy', 'fc', 'label', 'mode', 'format', 'fdisk', 'debug', 'ctmouse', 'doslfn', 'unzip', 'zip', 'fdnpkg', 'cwsdpmi']
const SKIP = /^BIN\/(KERNL86N?\.SYS|FREECOM\/|FDNPKG\.CFG$|KERNL386\.SYS$|COMMAND\.COM$)/i
const licences = new Map()
for (const pkg of PKGS) {
  const zip = C(`fd-${pkg}.zip`)
  for (const name of zipList(zip)) {
    if (/^BIN\//i.test(name) && !SKIP.test(name)) fdAdd(`FREEDOS/BIN/${name.slice(4)}`, new Uint8Array(unzip(zip, name)))
    else if (/^NLS\/[^/]+\.EN$/i.test(name)) fdAdd(`FREEDOS/NLS/${name.slice(4)}`, new Uint8Array(unzip(zip, name)))
    else if (/^DOC\/[^/]+\/(COPYING|LICENSE|LICENSE\.TXT|GPL\.TXT|COPYING\.TXT)$/i.test(name)) {
      const text = unzip(zip, name).toString('latin1')
      const key = text.replace(/\s+/g, ' ').slice(0, 400)
      if (!licences.has(key)) licences.set(key, { name: pkg, text })
    }
  }
}
fdAdd('KERNEL.SYS', new Uint8Array(unzip(C('fd-kernel.zip'), 'BIN/KERNL386.SYS')), 0x27)
fdAdd('COMMAND.COM', new Uint8Array(unzip(C('fd-freecom.zip'), 'BIN/COMMAND.COM')))
// FDNPKG installs from the FreeDOS 1.3 repositories over HTTP; the games and emulator repositories are left out, as Friction's Browser leaves out games
const cfg = unzip(C('fd-fdnpkg.zip'), 'BIN/FDNPKG.CFG').toString('latin1').split(/\r?\n/).filter((l) => !/^REPO .*\/(games|emulator)\s*$/i.test(l)).join('\r\n')
fdAdd('FREEDOS/BIN/FDNPKG.CFG', new TextEncoder().encode(cfg))
fdAdd('FDCONFIG.SYS', enc(`!COUNTRY=001,437:C:\\FREEDOS\\BIN\\COUNTRY.SYS
!LASTDRIVE=Z
!BUFFERS=20
!FILES=40
DOS=HIGH
DEVICE=C:\\FREEDOS\\BIN\\HIMEMX.EXE
SHELL=C:\\COMMAND.COM C:\\ /E:2048 /P=C:\\AUTOEXEC.BAT
`))
fdAdd('AUTOEXEC.BAT', enc(`@ECHO OFF
SET DOSDIR=C:\\FREEDOS
SET PATH=C:\\FREEDOS\\BIN;C:\\NET;C:\\WEB;C:\\
SET NLSPATH=C:\\FREEDOS\\NLS
SET LANG=EN
SET TZ=UTC
SET TEMP=C:\\TEMP
SET TMP=C:\\TEMP
SET MTCPCFG=C:\\NET\\MTCP.CFG
SET WATTCP.CFG=C:\\NET
SET DIRCMD=/OGN /LFN
PROMPT $P$G
ALIAS CURL=HTGET -quiet
ALIAS INSTALL=FDNPKG INSTALL
CTMOUSE >NUL
DOSLFN >NUL
NE2000 0x60 ${IRQ} 0x300 >NUL
IF ERRORLEVEL 1 GOTO NONET
DHCP -timeout 5 -retries 2 >NUL
IF ERRORLEVEL 1 GOTO NONET
ECHO Network: on. HTTP goes out through your browser.
GOTO DONE
:NONET
ECHO Network: off.
:DONE
ECHO.
ECHO FreeDOS 1.3. It answers programs as DOS 7.10, with long file names.
ECHO Type HELP for what is here, INSTALL to add a program.
ECHO.
`))
fdAdd('HELP.BAT', enc(`@ECHO OFF
ECHO.
ECHO  DIR, CD, COPY, TYPE, DEL, MD, MOVE, XCOPY, DELTREE, TREE, MEM
ECHO  VER /R               the DOS version programs are told (7.10)
ECHO  EDIT FILE.TXT        a text editor
ECHO  DEBUG                assemble and run machine code
ECHO  ZIP, UNZIP           pack and unpack zip files
ECHO  "My long name.txt"   long file names work (DOSLFN is loaded)
ECHO.
ECHO  INSTALL name         add a program from the FreeDOS collection
ECHO  FDNPKG SEARCH word   find one (try: FDNPKG SEARCH editor)
ECHO  FDNPKG REMOVE name   take one off
ECHO    Some to try: LYNX, LINKS, DILLO (web browsers), GOPHERUS,
ECHO    NASM, FBC (FreeBASIC), FPC (Free Pascal), OPENGEM (a desktop)
ECHO.
ECHO  HTGET -o PAGE.HTM http://example.com/    fetch a file from the web
ECHO  CURL http://example.com/                 the same, shown on screen
ECHO  MICROWEB http://en.wikipedia.org/        a graphical web browser
ECHO.
ECHO  A: is the transfer floppy. Import puts files on it or in C:\\IMPORT.
ECHO  Only HTTP works from DOS (the browser turns it into HTTPS for you).
ECHO.
`))
// CURL and INSTALL are aliases set in AUTOEXEC.BAT: FreeCOM splits a batch file's arguments at "/", which breaks a URL
fdAdd('README.TXT', enc(`FRICTION DOS: FREEDOS 1.3
=========================

FreeDOS 1.3 (freedos.org, GNU GPL). Its kernel tells programs it is DOS 7.10,
the version of MS-DOS inside Windows 98, so programs written for MS-DOS 7 run.
Microsoft has never released MS-DOS 7, so it cannot be put on this disk. If you
own a Windows 95 or 98 boot disk, the Disks panel can boot it and give it a
blank hard disk to install onto.

It runs in your browser in v86 (copy.sh/v86, BSD licence). Nothing runs on a
server. The network card is an NE2000; its HTTP requests become the browser's
own fetch() and go out through KillCORS (proxy.killcors.com), a free public
relay. Blocked kinds of site (games, short video) are refused, as in Friction's
Browser, and the FreeDOS games and emulator collections are left out of FDNPKG.

What is here, and its licence:
  C:\\KERNEL.SYS, C:\\COMMAND.COM, C:\\FREEDOS\\BIN   FreeDOS 1.3 packages, GPL
    (kernel, FreeCOM, HIMEMX, EDIT, DOSLFN, FDNPKG, CWSDPMI and the base tools)
  C:\\NET\\NE2000.COM   Crynwr packet driver               GPL
  C:\\NET\\*.EXE        mTCP by Michael Brutman            GPL 3
  C:\\WEB\\MICROWEB     MicroWeb by James Howard           GPL 2
  ZIP and UNZIP          Info-ZIP                           Info-ZIP licence
The licence texts are in C:\\LICENSE. The source code of every program on this
disk is at https://www.frictionx.app/dos/src/
`))
fdAdd('TEMP', undefined); fd[fd.length - 1].dir = true
fdAdd('IMPORT', undefined); fd[fd.length - 1].dir = true
for (const f of files.filter((f) => /^(NET|WEB)\//.test(f.path))) fdAdd(f.path, f.data)
// FDNPKG's own TCP stack (Watt-32) gets no answer from v86's DHCP, so it is given v86's fixed addresses (mTCP's DHCP gets the same)
fdAdd('NET/WATTCP.CFG', enc(`my_ip = 192.168.86.100
netmask = 255.255.255.0
gateway = 192.168.86.1
nameserver = 192.168.86.1
hostname = friction
`))
for (const f of files.filter((f) => /^LICENSE\/(GPL3|CRYNWR|GPL2|INFOZIP)/.test(f.path))) fdAdd(f.path, f.data)
let n = 0
for (const { name, text } of licences.values()) if (!/GNU GENERAL PUBLIC LICENSE\s+Version 2/i.test(text) && !/GNU GENERAL PUBLIC LICENSE\s+Version 3/i.test(text)) fdAdd(`LICENSE/FD-${String(++n).padStart(2, '0')}.TXT`, enc(`From the FreeDOS package ${name}:\n\n${text}`))

// 130 cylinders of 16 heads and 63 sectors: 64 MB, room to install programs; mostly empty, so it downloads small
const fdDisk = F.hardDisk(130, fdMbr, fdBoot, 'FREEDOS')
F.writeFiles(fdDisk.volume, [...fd, { path: 'FREEDOS', attr: 0x08 }])

// ───────── write them out ─────────
const save = (prefix, d) => {
  const gz = gzipSync(d, { level: 9 })
  const tag = createHash('sha256').update(d).digest('hex').slice(0, 10)
  for (const f of readdirSync(OUT)) if (new RegExp(`^${prefix}-c\\..*\\.img\\.gz$`).test(f)) rmSync(join(OUT, f))
  const name = `${prefix}-c.${tag}.img.gz`
  writeFileSync(join(OUT, name), gz)
  console.log(`${prefix}: ${name}, ${(d.length / 1048576).toFixed(1)} MB, ${(gz.length / 1048576).toFixed(2)} MB gzipped, ${(F.free(F.volumeOf(d)) / 1048576).toFixed(1)} MB free`)
  return { disk: name, size: d.length, gz: gz.length }
}
const systems = { freedos: save('freedos', fdDisk.disk), msdos4: save('msdos4', disk) }
writeFileSync(join(OUT, 'seabios.bin'), readFileSync(C('seabios.bin')))
writeFileSync(join(OUT, 'vgabios.bin'), readFileSync(C('vgabios.bin')))
// the sources of the GPL programs on the disks, served next to them
writeFileSync(join(OUT, 'src/mTCP-src_2026-10-10.zip'), readFileSync(C('mtcp-src.zip')))
writeFileSync(join(OUT, 'src/crynwr-sources.zip'), unzip(C('crynwr.zip'), 'SOURCE/CRYNWR/SOURCES.ZIP'))
writeFileSync(join(OUT, 'src/ctmouse-sources.zip'), unzip(C('ctmouse.zip'), 'SOURCE/CTMOUSE/SOURCES.ZIP'))
writeFileSync(join(OUT, 'src/edit-sources.zip'), unzip(C('edit.zip'), 'SOURCE/EDIT/SOURCES.ZIP'))
writeFileSync(join(OUT, 'src/microweb-2.1-source.zip'), readFileSync(C('microweb-src.zip')))
// FreeDOS: each package's own SOURCE folder (and its description), one zip for all of them
execFileSync('python3', ['-c', `
import sys, zipfile
out = zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_STORED)
for z in sys.argv[2:]:
    src = zipfile.ZipFile(z)
    pkg = z.split('fd-')[-1][:-4]
    for i in src.infolist():
        if i.filename.upper().startswith(('SOURCE/', 'APPINFO/')) and not i.filename.endswith('/'):
            out.writestr(pkg + '/' + i.filename, src.read(i.filename))
out.close()
`, join(OUT, 'src/freedos-1.3-sources.zip'), ...PKGS.map((p) => C(`fd-${p}.zip`))])
// the page that lists them is /dos/src, written with the other site pages by scripts/legal.mjs
writeFileSync(join(ROOT, 'src/lib/dos.json'), JSON.stringify({ irq: Number(IRQ), systems }, null, 1) + '\n')
