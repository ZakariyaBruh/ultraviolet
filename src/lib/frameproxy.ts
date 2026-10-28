import corsfix from 'corsfix'
import { verdict } from '@/lib/blocklist'

/**
 * Page scripts run in a sealed frame with an empty origin, so a request they make to another site is refused by CORS. This is the
 * answer: the frame's fetch and XMLHttpRequest are replaced (`FRAME_SHIM`, written into the page before its own scripts) by calls that
 * post the request to the Browser window, which makes it through Corsfix's free proxy (KillCORS is the backup) (the corsfix SDK, no key) from the app's own
 * origin and posts the answer back. The shim also gives pages an empty cookie jar and in-memory storage, because a sealed frame
 * throws when a page reads them and many pages crash on that. Every address passes the blocklist and the private-network check first. No cookies are sent
 * and none come back. The proxy is a third party: it sees what a page's scripts ask for, and it has its own free-tier limit.
 */
export const FRAME_SHIM = `(function(){var P=parent,n=0,w={};
try{Object.defineProperty(document,'cookie',{get:function(){return''},set:function(){}})}catch(e){}
['localStorage','sessionStorage'].forEach(function(k){try{void window[k]}catch(e){var m={},S={getItem:function(a){return a in m?m[a]:null},setItem:function(a,b){m[a]=String(b)},removeItem:function(a){delete m[a]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null}};Object.defineProperty(S,'length',{get:function(){return Object.keys(m).length}});try{Object.defineProperty(window,k,{value:S,configurable:true})}catch(x){}}});
addEventListener('message',function(e){if(e.source!==P)return;var d=e.data;if(!d||d.fxr==null)return;var c=w[d.fxr];if(!c)return;delete w[d.fxr];d.err?c.rej(new TypeError('Failed to fetch')):c.res(d)});
function call(url,o){return new Promise(function(res,rej){var id=++n;w[id]={res:res,rej:rej};P.postMessage({friction:1,fx:id,url:url,method:o.method,headers:o.headers,body:o.body},'*')})}
var F=window.fetch;
window.fetch=function(i,init){try{var r=new Request(i,init),u=new URL(r.url,document.baseURI);if(!/^https?:$/.test(u.protocol))return F.apply(this,arguments);
return r.arrayBuffer().then(function(buf){var h={};r.headers.forEach(function(v,k){h[k]=v});return call(u.href,{method:r.method,headers:h,body:/^(GET|HEAD)$/.test(r.method)?null:buf})}).then(function(d){return new Response([101,204,205,304].indexOf(d.status)>-1?null:d.body,{status:d.status,statusText:d.statusText||'',headers:d.headers})})}catch(e){return F.apply(this,arguments)}};
function X(){this.readyState=0;this.status=0;this.statusText='';this.responseText='';this.response=null;this.responseURL='';this.responseType='';this.timeout=0;this.withCredentials=false;this._h={};this._l={};this.upload={addEventListener:function(){}}}
X.UNSENT=0;X.OPENED=1;X.HEADERS_RECEIVED=2;X.LOADING=3;X.DONE=4;var p=X.prototype;
p.open=function(m,u){this._m=m;this._u=u;this.readyState=1;this._f('readystatechange')};
p.setRequestHeader=function(k,v){this._h[k]=v};
p.getResponseHeader=function(k){return(this._rh&&this._rh[String(k).toLowerCase()])||null};
p.getAllResponseHeaders=function(){var s='';for(var k in this._rh)s+=k+': '+this._rh[k]+'\\r\\n';return s};
p.overrideMimeType=function(){};p.abort=function(){this._x=1};
p.addEventListener=function(t,f){(this._l[t]=this._l[t]||[]).push(f)};
p.removeEventListener=function(t,f){this._l[t]=(this._l[t]||[]).filter(function(g){return g!==f})};
p._f=function(t){var e={type:t,target:this},h=this['on'+t],s=this;if(h)try{h.call(s,e)}catch(x){}(this._l[t]||[]).forEach(function(f){try{f.call(s,e)}catch(x){}})};
p.send=function(b){var s=this,u=new URL(s._u,document.baseURI);if(typeof b==='object'&&b&&!(b instanceof ArrayBuffer))b=String(b);
call(u.href,{method:s._m||'GET',headers:s._h,body:b==null||/^(GET|HEAD)$/i.test(s._m)?null:b}).then(function(d){if(s._x)return;s._rh=d.headers;s.status=d.status;s.statusText=d.statusText||'';s.responseURL=d.url;var t=new TextDecoder().decode(d.body);s.readyState=2;s._f('readystatechange');s.readyState=4;
s.responseText=(s.responseType===''||s.responseType==='text')?t:'';
s.response=s.responseType==='arraybuffer'?d.body:s.responseType==='json'?(function(){try{return JSON.parse(t)}catch(e){return null}})():s.responseType==='blob'?new Blob([d.body]):t;
s._f('readystatechange');s._f('load');s._f('loadend')},function(){s.readyState=4;s._f('readystatechange');s._f('error');s._f('loadend')})};
window.XMLHttpRequest=X})();`

const BAD_HEADER = /^(origin|referer|cookie|host|content-length|user-agent|accept-encoding|connection)$/i
const MAX = 8_000_000

/** answers one request from the frame; the reply is what the shim hands back to the page */
export async function frameRequest(d: { url?: unknown; method?: unknown; headers?: unknown; body?: unknown }): Promise<{ ok: true; status: number; statusText: string; headers: Record<string, string>; body: ArrayBuffer; url: string } | { ok: false; limit: boolean }> {
  const url = typeof d.url === 'string' ? d.url : ''
  const v = verdict(url)
  const host = v.ok ? v.url.hostname : ''
  if (!v.ok || !host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith('.local') || host.endsWith('.internal')) return { ok: false, limit: false }
  const headers: Record<string, string> = {}
  if (d.headers && typeof d.headers === 'object') for (const [k, val] of Object.entries(d.headers as Record<string, unknown>)) if (typeof val === 'string' && !BAD_HEADER.test(k)) headers[k] = val
  const method = typeof d.method === 'string' ? d.method.toUpperCase() : 'GET'
  const body = d.body instanceof ArrayBuffer || typeof d.body === 'string' ? (d.body as BodyInit) : undefined
  const target = v.url.toString()
  const init = { method, headers, body: /^(GET|HEAD)$/.test(method) ? undefined : body }
  let limit = false
  // Corsfix first; if it refuses or fails (its free limit, or it is down) KillCORS, which has no stated limit, answers instead
  for (const via of ['corsfix', 'killcors'] as const) {
    try {
      const r = via === 'corsfix'
        ? await corsfix.fetch(target, { ...init, signal: AbortSignal.timeout(20000) })
        : await fetch(`https://proxy.killcors.com?url=${encodeURIComponent(target)}`, { ...init, signal: AbortSignal.timeout(20000) })
      // a refusal from the proxy itself (as opposed to from the site) is not an answer: the next proxy is tried
      if (via === 'corsfix' && r.status >= 400 && (await r.clone().text().catch(() => '')).includes('corsfix_error')) { limit = r.status === 429; continue }
      const out = await answer(r, target)
      if (out) return out
    } catch (e) { if (via === 'corsfix') limit = (e as { code?: string })?.code === 'rate_limited' || (e as { status?: number })?.status === 429 }
  }
  return { ok: false, limit }
}

async function answer(r: Response, target: string) {
  {
    const buf = await r.arrayBuffer()
    if (buf.byteLength > MAX) return null
    const out: Record<string, string> = {}
    r.headers.forEach((val, k) => { if (!/^(set-cookie|content-encoding|content-length)$/i.test(k)) out[k] = val })
    return { ok: true as const, status: r.status, statusText: r.statusText, headers: out, body: buf, url: target }
  }
}
