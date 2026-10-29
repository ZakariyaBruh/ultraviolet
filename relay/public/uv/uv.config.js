/*global Ultraviolet*/
self.__uv$config = {
  prefix: '/service/',
  bare: '/bare/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/uv/uv.handler.js',
  client: '/uv/uv.client.js',
  bundle: '/uv/uv.bundle.js',
  config: '/uv/uv.config.js',
  sw: '/uv/uv.sw.js',
}
// In a page (not in the worker, which takes the pass from its own address) the pass is whatever go.html left in storage, so that
// WebSockets the page opens reach the relay with it. Runs before the page's scripts, so storage is still the real one.
;(function () { try { var t = self.localStorage && self.localStorage.getItem('friction:pass'); if (t) self.__uv$config.bare = '/bare/' + t + '/' } catch (e) { /* no storage: only the worker's requests carry the pass */ } })()
