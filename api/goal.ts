/**
 * How many people support Friction, for the goal bar on the Support tab. Friction keeps no record of who paid (Whop is the seller), so the number is
 * set by hand as the environment variable SUPPORTER_COUNT on Vercel, read from Whop's own dashboard. It is one number, no names, cached for ten minutes.
 */
export default {
  async fetch(request: Request) {
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return new Response('not here', { status: 403 })
    const n = Math.max(0, Math.min(1_000_000, Math.floor(Number(process.env.SUPPORTER_COUNT) || 0)))
    return new Response(JSON.stringify({ n }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
  },
}
