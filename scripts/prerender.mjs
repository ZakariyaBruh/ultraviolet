// After `vite build`: write one copy of index.html for each public screen with that screen's own <head>
// (title, description, canonical, Open Graph, Twitter card, JSON-LD). The body stays the app shell.
// Nothing is clipped to 1px or otherwise hidden for crawlers. Titles must be 50-60 characters and
// descriptions 140-160, or the build stops. Unknown addresses are dist/404.html.
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

const appNode = (description) => ({
  '@type': 'WebApplication',
  '@id': `${SITE}/#app`,
  name: 'Friction',
  url: `${SITE}/`,
  description,
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires JavaScript',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  image: `${SITE}/og.png`,
})

const ld = (route, m) => {
  const url = SITE + (route === '/' ? '/' : route)
  const graph = route === '/'
    ? [
        { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'Friction', url: `${SITE}/`, inLanguage: 'en' },
        appNode(m.description),
      ]
    : [{ '@type': 'WebPage', '@id': `${url}#page`, name: m.title, description: m.description, url, isPartOf: { '@id': `${SITE}/#site` }, about: { '@id': `${SITE}/#app` }, inLanguage: 'en' }]
  return `<script id="friction-ld" type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`
}

const headFor = (route, m, robots) => {
  const url = SITE + (route === '/' ? '/' : route)
  const lines = [
    robots ? `<meta name="robots" content="${robots}" />` : `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Friction" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Friction, the free focus timer that counts every drift." />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${SITE}/og.png" />`,
    ld(route, m),
  ]
  return lines.map((l) => `    ${l}`).join('\n')
}

const page = (source, title, description, extraHead) => source
  .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`)
  .replace(/<link rel="canonical"[^>]*>\s*/g, '')
  .replace(/<meta name="robots"[^>]*>\s*/g, '')
  .replace(/<meta property="og:[^>]*>\s*/g, '')
  .replace(/<meta name="twitter:[^>]*>\s*/g, '')
  .replace(/<script id="friction-ld"[\s\S]*?<\/script>\s*/g, '')
  .replace('</head>', `${extraHead}\n  </head>`)

// Plain readable HTML for each public screen, put inside #root. React replaces it the moment the app
// starts (createRoot.render), and the inline `js` class keeps it from showing in the meantime, so people
// with scripts see the app exactly as before. It is the same thing a <noscript> block would show, in a
// form every crawler reads: a real h1 and a few short, true paragraphs. Nothing is clipped to 1px.
const HOW = [
  ['How does it work?', 'Pick a focus block between 10 and 90 minutes and press Lock in. The clock runs while the tab is in front of you. Each time you switch to another tab, Friction counts it as a drift.'],
  ['What can I keep on while I work?', 'Internet radio and live TV are built in. There is also a calculator, a unit converter and a scratch board you can open on the focus screen.'],
  ['Can I focus with friends?', 'Yes. Make a focus room, share the code, and lock in together.'],
  ['Does it cost anything?', 'No. Friction is free and there is no account to make.'],
  ['Where is my data kept?', 'In your own browser. Your sessions and settings stay on your device, and one button erases all of it.'],
]
const body = (route, m) => {
  const links = Object.entries(seo).filter(([r]) => r !== route).map(([r, x]) => `<li><a href="${r}">${esc(x.name)}</a></li>`).join('')
  const faq = route === '/' ? `<h2>Timer that counts how often you leave your work.</h2>${HOW.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}` : ''
  return `<main class="pre"><h1>${esc(m.h1)}</h1><p>${esc(m.lead)}</p><ul>${m.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${faq}<p>${esc(m.more)}</p><nav aria-label="Pages"><ul>${links}</ul></nav></main>`
}
const PRE_HEAD = `<script>document.documentElement.classList.add('js')</script>\n    <style>.js .pre{display:none}.pre{max-width:42rem;margin:0 auto;padding:3rem 1.25rem;color:#f3f1ea;font:16px/1.6 system-ui,sans-serif}.pre a{color:#ffd23f}</style>`

let n = 0
for (const [route, m] of Object.entries(seo)) {
  const out = page(html, m.title, m.description, `${headFor(route, m)}\n    ${PRE_HEAD}`)
    .replace('<div id="root"></div>', `<div id="root">${body(route, m)}</div>`)
  if (route === '/') writeFileSync('dist/index.html', out)
  else { mkdirSync(`dist${route}`, { recursive: true }); writeFileSync(`dist${route}/index.html`, out) }
  n++
}

// screens that only ever show your own numbers: real files, so a refresh works, and noindex
const privateRoutes = {
  '/settings': 'Settings · Friction',
  '/insights': 'Insights · Friction',
  '/debrief': 'Debrief · Friction',
}
for (const [route, title] of Object.entries(privateRoutes)) {
  const description = 'Your own numbers, stored in this browser.'
  const extra = [
    `<meta name="robots" content="noindex, nofollow" />`,
    `<link rel="canonical" href="${SITE}${route}" />`,
  ].map((l) => `    ${l}`).join('\n')
  mkdirSync(`dist${route}`, { recursive: true })
  writeFileSync(`dist${route}/index.html`, page(html, title, description, extra))
}

const missing = page(
  html,
  'Page not found | Friction',
  'That address is not a page on Friction.',
  '    <meta name="robots" content="noindex, nofollow" />',
)
writeFileSync('dist/404.html', missing)

const day = new Date().toISOString().slice(0, 10)
const rank = (r) => (r === '/' ? '1.0' : r === '/focus' ? '0.9' : r === '/privacy' ? '0.3' : ['/radio', '/tv', '/learn'].includes(r) ? '0.8' : ['/podcasts', '/music', '/news'].includes(r) ? '0.7' : '0.6')
const urls = Object.keys(seo)
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((r) => `  <url>\n    <loc>${SITE}${r === '/' ? '/' : r}</loc>\n    <lastmod>${day}</lastmod>\n    <changefreq>${r === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${rank(r)}</priority>\n  </url>`).join('\n')}\n</urlset>\n`)
console.log(`prerendered the head of ${n} screens`)
