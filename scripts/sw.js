/*
 * Friction's service worker (the source: scripts/prerender.mjs fills in the two lists below and writes it to dist/sw.js).
 *
 * Two jobs:
 *  1. After one visit the app opens with no connection. The timer, the study windows and everything saved in this browser work
 *     offline; stations, lessons and the board still need the network and say so.
 *  2. A repeat visit starts from this device. The app's files are named after their contents, so a file that has been fetched
 *     once never needs fetching again, which matters most on a slow phone on a slow connection.
 *
 * What it keeps: copies of Friction's own public files (the app's pages, scripts, styles, fonts). Nothing of the visitor's, no
 * answers from /api/, nothing from any other site. A request it does not recognise is left to the browser exactly as before.
 * A page is always asked for from the network first, so a new version of the site is picked up on the next visit; the kept copy is
 * only used when the network does not answer.
 */
const CACHE = 'friction-app'
/** the app's own addresses (one page serves them all), kept in step with src/lib/route.ts by the build */
const ROUTES = /*ROUTES*/[]
/** every file of this build under /assets: anything kept from an older build is dropped when this worker takes over */
const ASSETS = new Set(/*ASSETS*/[])
/** how long a page may take from the network before the kept copy is shown instead */
const PATIENCE = 3500

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name)
    const cache = await caches.open(CACHE)
    for (const req of await cache.keys()) {
      const path = new URL(req.url).pathname
      if (path.startsWith('/assets/') && !ASSETS.has(path)) await cache.delete(req)
    }
    await self.clients.claim()
  })())
})

const isRoute = (path) => ROUTES.includes(path.replace(/\/+$/, '') || '/')
/** a plain answer from our own address that did not arrive through a redirect (a browser refuses a redirected copy for a page) */
const good = (res) => res && res.ok && res.type === 'basic' && !res.redirected

/** a file named after its contents: the kept copy if there is one, otherwise the network, and keep what comes back */
async function asset(req) {
  const cache = await caches.open(CACHE)
  // the address is the whole identity of these files, so nothing about the request (its query, the headers a Vary names) changes the answer
  const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true })
  if (hit) return hit
  const res = await fetch(req)
  if (good(res)) cache.put(new URL(req.url).pathname, res.clone()).catch(() => {})
  return res
}

/** an app page: the network first (so the newest version wins), the kept copy when it does not answer in time or at all */
async function page(req) {
  const cache = await caches.open(CACHE)
  const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/'
  const any = { ignoreVary: true }
  const kept = async () => (await cache.match(path, any)) || (await cache.match('/focus', any)) || (await cache.match('/', any)) || null
  const fresh = fetch(req).then((res) => {
    if (good(res)) cache.put(path, res.clone()).catch(() => {})
    return res
  })
  fresh.catch(() => {}) // when the kept copy has already been shown, a late failure is nobody's problem
  const late = new Promise((done) => setTimeout(() => done(null), PATIENCE))
  try {
    const first = await Promise.race([fresh, late])
    if (first) return first
    // slow: show the kept copy if there is one (the network answer, when it comes, is still kept for next time)
    return (await kept()) || (await fresh)
  } catch (err) {
    const copy = await kept()
    if (copy) return copy
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/assets/')) { event.respondWith(asset(req)); return }
  if (req.mode === 'navigate' && isRoute(url.pathname)) { event.respondWith(page(req)); return }
  // everything else (the server under /api/, the blog, the legal pages, icons) goes to the network as it always has
})

/**
 * The first visit is over before this worker is in charge, so the page tells it which of the app's files it has already fetched
 * and they are kept too (from the browser's own cache, at no cost). After that one visit the app can start with no connection.
 */
self.addEventListener('message', (event) => {
  const keep = event.data && event.data.keep
  if (!Array.isArray(keep)) return
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    for (const path of keep.slice(0, 200)) {
      if (typeof path !== 'string') continue
      const ok = path.startsWith('/assets/') ? ASSETS.has(path) : isRoute(path)
      if (!ok || (await cache.match(path, { ignoreVary: true }))) continue
      try { const res = await fetch(path); if (good(res)) await cache.put(path, res) } catch { /* offline already: next time */ }
    }
  })())
})
