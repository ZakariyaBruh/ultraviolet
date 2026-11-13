import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

const SRC = path.resolve(import.meta.dirname, 'src')

/** Every file under src that the app can reach from src/main.tsx by following imports, plain or `import()`. */
function reachable(): Set<string> {
  const seen = new Set<string>()
  const tries = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '/index.ts', '/index.tsx']
  const find = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null
    if (!base) return null // a package, not one of ours
    for (const t of tries) { const f = base + t; if (existsSync(f) && statSync(f).isFile()) return f }
    return null
  }
  const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g
  const walk = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    if (!/\.(tsx?|jsx?|mjs)$/.test(file)) return
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) { const next = find(file, m[2]); if (next) walk(next) }
  }
  walk(path.join(SRC, 'main.tsx'))
  return seen
}

/**
 * Tailwind writes a rule for every class name it finds in src, whether or not the file it found it in is used. All 131 EasyUI
 * components are installed (CLAUDE.md) and about a hundred of them are not on any screen yet; their class names were more than half
 * of the stylesheet every visitor downloads. For a build, this leaves out of Tailwind's scan the component files that nothing in
 * the app imports. Start using one and it is imported, so it is scanned again by itself: there is no list to keep.
 * (`npm run dev` scans everything, as before.)
 *
 * The check at the end is the safety net: the list comes from reading import lines, and if that ever misses an import the bundler
 * follows, the build stops and says which file, rather than shipping a component with no styles.
 */
function leaveOutUnusedComponents(): Plugin {
  const dirs = ['components/ui', 'components/icons'].map((d) => path.join(SRC, d))
  let left: string[] = []
  return {
    name: 'friction:leave-out-unused-components',
    apply: 'build',
    enforce: 'pre',
    buildStart() {
      const used = reachable()
      left = dirs.flatMap((d) => (existsSync(d) ? readdirSync(d).filter((f) => /\.(tsx?|jsx?)$/.test(f)).map((f) => path.join(d, f)) : [])).filter((f) => !used.has(f))
      this.info(`left ${left.length} unused component files out of the stylesheet scan`)
    },
    transform(code, id) {
      if (id.split('?')[0] !== path.join(SRC, 'index.css') || !left.length) return
      const not = left.map((f) => `@source not "./${path.relative(SRC, f).split(path.sep).join('/')}";`).join('\n')
      // after the first line (the tailwind import), which has to stay first
      const cut = code.indexOf('\n') + 1
      return { code: code.slice(0, cut) + not + '\n' + code.slice(cut), map: null }
    },
    generateBundle(_, bundle) {
      const out = new Set(left)
      for (const c of Object.values(bundle)) {
        if (c.type !== 'chunk') continue
        for (const id of Object.keys(c.modules)) {
          if (out.has(id.split('?')[0])) this.error(`${path.relative(import.meta.dirname, id)} is in the app but was left out of the stylesheet scan. The import reader in vite.config.ts (reachable) missed how it is imported: teach it that form.`)
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), leaveOutUnusedComponents(), tailwindcss()],
  resolve: { alias: { '@': SRC } },
  build: {
    // which files each screen needs, so scripts/prerender.mjs can ask for them in the page itself (.vite/manifest.json; it is not served)
    manifest: true,
    // Fonts are never inlined into a stylesheet. A face is cut into pieces by script (Latin, Cyrillic, Japanese ...) so that a browser
    // fetches only the pieces a page uses; inlining the small pieces sent all of them to everyone (67 KB for the Paper face alone).
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    rolldownOptions: {
      output: {
        /**
         * How the app is cut into files. Each screen and each heavy extra is its own file already (`part()` in
         * components/app/Part.tsx); this decides where the code they share goes, so that a first visit asks for a handful of
         * files and not dozens of tiny ones.
         *  - react and motion: libraries that change far less often than the app, so they stay cached across updates.
         *  - core: everything else the first paint needs (the store, the frame, the player), as one file.
         *  - shared: small things (an icon, a helper) used by three or more screens, as one file, instead of one request each.
         */
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
            { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/, tags: ['$initial'], priority: 30 },
            { name: 'core', tags: ['$initial'], priority: 20 },
            { name: 'shared', minShareCount: 3, maxModuleSize: 6 * 1024, priority: 10 },
          ],
        },
      },
    },
  },
})
