// Builds the C: drive of the Code window's DOS: MS-DOS 4.00 (Microsoft's open-source release, MIT licence, as compiled by the
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

const gz = gzipSync(disk, { level: 9 })
const tag = createHash('sha256').update(disk).digest('hex').slice(0, 10)
for (const f of readdirSync(OUT)) if (/^msdos4-c\..*\.img\.gz$/.test(f)) rmSync(join(OUT, f))
const name = `msdos4-c.${tag}.img.gz`
writeFileSync(join(OUT, name), gz)
writeFileSync(join(OUT, 'seabios.bin'), readFileSync(C('seabios.bin')))
writeFileSync(join(OUT, 'vgabios.bin'), readFileSync(C('vgabios.bin')))
// the sources of the GPL programs on the disk, served next to it
writeFileSync(join(OUT, 'src/mTCP-src_2026-10-10.zip'), readFileSync(C('mtcp-src.zip')))
writeFileSync(join(OUT, 'src/crynwr-sources.zip'), unzip(C('crynwr.zip'), 'SOURCE/CRYNWR/SOURCES.ZIP'))
writeFileSync(join(OUT, 'src/ctmouse-sources.zip'), unzip(C('ctmouse.zip'), 'SOURCE/CTMOUSE/SOURCES.ZIP'))
writeFileSync(join(OUT, 'src/edit-sources.zip'), unzip(C('edit.zip'), 'SOURCE/EDIT/SOURCES.ZIP'))
writeFileSync(join(OUT, 'src/microweb-2.1-source.zip'), readFileSync(C('microweb-src.zip')))
// the page that lists them is /dos/src, written with the other site pages by scripts/legal.mjs
writeFileSync(join(ROOT, 'src/lib/dos.json'), JSON.stringify({ disk: name, size: disk.length, irq: Number(IRQ) }, null, 1) + '\n')
console.log(`dos disk: ${name}, ${(disk.length / 1048576).toFixed(1)} MB, ${(gz.length / 1048576).toFixed(2)} MB gzipped, ${files.length} files, ${(F.free(volume) / 1048576).toFixed(1)} MB free`)
