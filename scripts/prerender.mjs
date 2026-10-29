// After `vite build`: write one copy of index.html for each public screen with that screen's own <head> (title, description, canonical,
// Open Graph, Twitter card, JSON-LD), so crawlers and link previews that do not run JavaScript see the right page. The body is untouched:
// the app starts and takes over as usual. Titles must be 50-60 characters and descriptions 140-160, or the build stops.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SITE = 'https://frictionx.vercel.app'
const seo = JSON.parse(readFileSync('src/lib/seo.json', 'utf8'))
const html = readFileSync('dist/index.html', 'utf8')
const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

for (const [route, m] of Object.entries(seo)) {
  if (m.title.length < 50 || m.title.length > 60) throw new Error(`seo.json ${route}: title is ${m.title.length} characters, it should be 50-60`)
  if (m.description.length < 140 || m.description.length > 160) throw new Error(`seo.json ${route}: description is ${m.description.length} characters, it should be 140-160`)
}

const ld = (route, m) => {
  const url = SITE + route
  const graph = route === '/'
    ? [
        { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'Friction', url: `${SITE}/`, inLanguage: 'en' },
        { '@type': 'WebApplication', '@id': `${SITE}/#app`, name: 'Friction', url: `${SITE}/`, description: m.description, applicationCategory: 'ProductivityApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, image: `${SITE}/og.png` },
      ]
    : [{ '@type': 'WebPage', '@id': `${url}#page`, name: m.title, description: m.description, url, isPartOf: { '@id': `${SITE}/#site` }, about: { '@id': `${SITE}/#app` }, inLanguage: 'en' }]
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`
}

let n = 0
for (const [route, m] of Object.entries(seo)) {
  const url = SITE + (route === '/' ? '/' : route)
  let out = html
    .replace(/<title>.*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(m.description)}" />`)
    .replace(/<link rel="canonical"[^>]*>\s*/g, '')
    .replace(/<meta property="og:[^>]*>\s*/g, '').replace(/<meta name="twitter:[^>]*>\s*/g, '')
  const head = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Friction" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Friction: one screen, no scrolling, every time you leave is counted." />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${SITE}/og.png" />`,
    ld(route, m),
  ].map((l) => `    ${l}`).join('\n')
  out = out.replace('</head>', `${head}\n  </head>`)
  if (route === '/') writeFileSync('dist/index.html', out)
  else { mkdirSync(`dist${route}`, { recursive: true }); writeFileSync(`dist${route}/index.html`, out) }
  n++
}
// the sitemap comes from the same list, so a screen cannot be in one and not the other
const day = new Date().toISOString().slice(0, 10)
const rank = (r) => (r === '/' ? '1.0' : r === '/focus' ? '0.9' : ['/radio', '/tv', '/learn'].includes(r) ? '0.8' : ['/podcasts', '/music', '/news'].includes(r) ? '0.7' : '0.6')
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(seo).map((r) => `  <url>\n    <loc>${SITE}${r}</loc>\n    <lastmod>${day}</lastmod>\n    <changefreq>${r === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${rank(r)}</priority>\n  </url>`).join('\n')}\n</urlset>\n`)
console.log(`prerendered the head of ${n} screens`)
