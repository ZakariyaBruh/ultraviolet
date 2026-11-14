import { markSupporter } from './supporter'

/**
 * Sign in with Whop: lets a supporter switch the supporter flag on in a browser that has never seen the thank-you page (a new device, cleared
 * storage). It is Whop's OAuth with PKCE; `api/whop.ts` does the one server step and keeps nothing. See that file for the whole picture.
 * Friction never learns who the person is: the answer is just yes or no.
 */
const K = 'friction:whop-signin'
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const rand = (n: number) => b64(crypto.getRandomValues(new Uint8Array(n)))
const here = () => `${location.origin}/support`

/** is sign-in set up on the server (an app id has been given)? */
export async function whopSigninReady(): Promise<{ client: string; scope: string } | null> {
  try {
    const r = await fetch('/api/whop')
    if (!r.ok) return null
    const j = (await r.json()) as { on?: boolean; client?: string; scope?: string }
    return j.on && j.client ? { client: j.client, scope: j.scope || 'openid member:basic:read' } : null
  } catch { return null }
}

/** send the person to Whop; they come back to the Support screen with ?code=&state= */
export async function startWhopSignin(): Promise<boolean> {
  const cfg = await whopSigninReady()
  if (!cfg) return false
  const verifier = rand(48), state = rand(16), nonce = rand(16)
  const challenge = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  try { sessionStorage.setItem(K, JSON.stringify({ verifier, state, t: Date.now() })) } catch { return false }
  const u = new URL('https://api.whop.com/oauth/authorize')
  u.search = new URLSearchParams({ response_type: 'code', client_id: cfg.client, redirect_uri: here(), scope: cfg.scope, state, nonce, code_challenge: challenge, code_challenge_method: 'S256' }).toString()
  location.assign(u.toString())
  return true
}

export type SigninResult = 'none' | 'supporter' | 'no-membership' | 'cancelled' | 'failed' | 'scope'

/** called on the Support screen: if the address carries Whop's answer, finish the sign-in and clear the address */
export async function finishWhopSignin(): Promise<SigninResult> {
  const p = new URLSearchParams(location.search)
  if (!p.has('state') || (!p.has('code') && !p.has('error'))) return 'none'
  const code = p.get('code'), state = p.get('state'), err = p.get('error')
  history.replaceState(null, '', location.pathname)
  let saved: { verifier?: string; state?: string; t?: number } | null = null
  try { saved = JSON.parse(sessionStorage.getItem(K) || 'null'); sessionStorage.removeItem(K) } catch { /* blocked */ }
  if (!saved || saved.state !== state || !saved.verifier || Date.now() - (saved.t || 0) > 15 * 60_000) return 'failed'
  if (err || !code) return err === 'access_denied' ? 'cancelled' : 'failed'
  try {
    const r = await fetch('/api/whop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, verifier: saved.verifier, redirect: here() }) })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; supporter?: boolean; error?: string }
    if (j.error === 'scope') return 'scope'
    if (!r.ok || !j.ok) return 'failed'
    if (!j.supporter) return 'no-membership'
    markSupporter()
    return 'supporter'
  } catch { return 'failed' }
}
