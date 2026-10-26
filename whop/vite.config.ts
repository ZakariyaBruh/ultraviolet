import { cloudflare } from '@cloudflare/vite-plugin'
import { whop } from '@whop/cli/vite'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// The page for every address the static files do not cover. build.mjs builds the app into dist/client first.
const html = readFileSync(new URL('./dist/client/index.html', import.meta.url), 'utf8')

export default defineConfig({
  plugins: [whop(), cloudflare({ viteEnvironment: { name: 'ssr' } })],
  define: { __INDEX_HTML__: JSON.stringify(html) },
  environments: { ssr: { build: { outDir: 'dist/server' } } },
  build: { emptyOutDir: false },
})
