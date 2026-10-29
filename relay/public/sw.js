/* Ultraviolet's service worker, with absolute paths. It rewrites every request a proxied page makes into a call to /bare/<pass>/ ,
   where the pass comes from this script's own address (?t=...), so the worker needs no storage and a new pass is a new worker. */
importScripts('/uv/uv.bundle.js')
importScripts('/uv/uv.config.js')
const pass = new URL(self.location.href).searchParams.get('t')
if (pass) self.__uv$config.bare = '/bare/' + pass + '/'
importScripts(__uv$config.sw)
const uv = new UVServiceWorker()
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => event.respondWith(event.request.url.startsWith(location.origin + __uv$config.prefix) ? uv.fetch(event) : fetch(event.request)))
