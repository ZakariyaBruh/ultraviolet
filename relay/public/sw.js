/* Scramjet 2's service worker. It only forwards: a page's requests under the proxy prefix go to the controller in go.html, which rewrites them and sends them over the transport. */
importScripts('/controller/controller.sw.js')
addEventListener('fetch', (event) => {
  const c = self.$scramjetController
  if (c && c.shouldRoute(event)) event.respondWith(c.route(event))
})
