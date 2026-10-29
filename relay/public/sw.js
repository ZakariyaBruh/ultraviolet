/* Scramjet's service worker: it turns a page's requests into streams that bare-mux sends to the relay's Wisp socket. */
importScripts('/scram/scramjet.all.js')
const { ScramjetServiceWorker } = $scramjetLoadWorker()
const scramjet = new ScramjetServiceWorker()
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    await scramjet.loadConfig()
    return scramjet.route(event) ? scramjet.fetch(event) : fetch(event.request)
  })())
})
