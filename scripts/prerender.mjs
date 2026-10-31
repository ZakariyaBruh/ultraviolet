// After `vite build`: write one copy of index.html for each public screen with that screen's own <head> (title, description, canonical,
// Open Graph, Twitter card, JSON-LD), so crawlers and link previews that do not run JavaScript see the right page. The body is untouched:
// the app starts and takes over as usual. Titles must be 50-60 characters and descriptions 140-160, or the build stops.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SITE = 'https://frictionx.vercel.app'
const seo = JSON.parse(readFileSync('src/lib/seo.json', 'utf8'))
const html = readFileSync('dist/index.html', 'utf8')
const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

for (const [route, m] of Object.entries(seo)) {
  if (!m.h1 || !m.lead || !m.points?.length || !m.more || !m.name) throw new Error(`seo.json ${route}: needs h1, lead, points, more and name`)
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

/** the readable text of a screen, as plain HTML a crawler can read without running the app (the app replaces it as soon as it starts) */
const ABOUT = 'Friction is a free focus timer. There is no account, and everything you make stays in your own browser. It uses AI in only three labelled places: demos for lessons without a built-in one, an optional Ask AI window, and a check that helps the Browser block games and short-form social media.'
const about = JSON.parse(readFileSync(new URL('../src/lib/about.json', import.meta.url), 'utf8'))
const whyHtml = `<h2>${esc(about.heading)}</h2><p>${esc(about.intro)}</p>${about.items.map((i) => `<h3>${esc(i.title)}</h3><p>${esc(i.text)}</p>`).join('')}`
const body = (route, m) => {
  const links = Object.entries(seo).filter(([r]) => r !== route).map(([r, x]) => `<li><a href="${r}">${esc(x.name)}</a>: ${esc(x.description.split('. ')[0].replace(/\.$/, ''))}.</li>`).join('')
  return `<main class="seo"><p class="k">Friction</p><h1>${esc(m.h1)}</h1><p>${esc(m.lead)}</p><h2>What you can do here</h2><ul>${m.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><p>${esc(m.more)}</p><h2>About Friction</h2><p>${esc(ABOUT)}</p>${whyHtml}<h2>Explore Friction</h2><ul>${links}</ul></main>`
}
const SEO_STYLE = '<style>.seo{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.seo{box-sizing:border-box;max-width:42rem;margin:0 auto;padding:3rem 1.25rem 4rem;color:#f3f1ea;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}.seo .k{margin:0 0 .5rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#ffd23f;font-size:.8rem}.seo h1{margin:0 0 1rem;font-size:clamp(1.8rem,5vw,2.6rem);line-height:1.1}.seo h3{margin:1.25rem 0 .25rem;font-size:1rem}.seo h2{margin:2rem 0 .5rem;font-size:1.15rem}.seo a{color:#ffd23f}.seo li{margin:.35rem 0}body{background:#05070c}</style>'

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
  out = out.replace('</head>', `${head}\n    ${SEO_STYLE}\n  </head>`).replace('<div id="root"></div>', `<div id="root">${body(route, m)}</div>`)
  if (route === '/') writeFileSync('dist/index.html', out)
  else { mkdirSync(`dist${route}`, { recursive: true }); writeFileSync(`dist${route}/index.html`, out) }
  n++
}
// the sitemap comes from the same list, so a screen cannot be in one and not the other
const day = new Date().toISOString().slice(0, 10)
const rank = (r) => (r === '/' ? '1.0' : r === '/focus' ? '0.9' : ['/radio', '/tv', '/learn'].includes(r) ? '0.8' : ['/podcasts', '/music', '/news'].includes(r) ? '0.7' : '0.6')
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(seo).map((r) => `  <url>\n    <loc>${SITE}${r}</loc>\n    <lastmod>${day}</lastmod>\n    <changefreq>${r === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${rank(r)}</priority>\n  </url>`).join('\n')}\n</urlset>\n`)
console.log(`prerendered the head of ${n} screens`)
