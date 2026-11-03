import seo from '@/lib/seo.json'
import { hrefFor, type Route } from '@/lib/route'

const SITE = 'https://frictionx.vercel.app'

type Meta = { title: string; description: string }

const pages = seo as Record<string, Meta>

function meta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function canonical(href: string | null) {
  const el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!href) { el?.remove(); return }
  const link = el ?? document.head.appendChild(document.createElement('link'))
  link.rel = 'canonical'
  link.href = href
}

function jsonLd(graph: unknown) {
  let el = document.getElementById('friction-ld') as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.id = 'friction-ld'
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
}

const appNode = (description: string) => ({
  '@type': ['WebApplication', 'SoftwareApplication'],
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

/** Title, description, canonical, social tags and JSON-LD for the screen the person is on. */
export function applyHead(route: Route) {
  if (route === 'missing') {
    document.title = 'Page not found | Friction'
    meta('name', 'description', 'That address is not a page on Friction.')
    meta('name', 'robots', 'noindex, nofollow')
    canonical(null)
    document.getElementById('friction-ld')?.remove()
    return
  }
  const path = hrefFor(route)
  const m = pages[path]
  const title = m?.title ?? `${route[0].toUpperCase()}${route.slice(1)} · Friction`
  const description = m?.description ?? ''
  document.title = title
  if (description) meta('name', 'description', description)
  const noindex = route === 'settings' || route === 'insights' || route === 'debrief'
  meta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
  const url = `${SITE}${path}`
  canonical(url)
  meta('property', 'og:type', 'website')
  meta('property', 'og:site_name', 'Friction')
  meta('property', 'og:title', title)
  meta('property', 'og:description', description)
  meta('property', 'og:url', url)
  meta('property', 'og:image', `${SITE}/og.png`)
  meta('property', 'og:image:alt', 'Friction, the free focus timer that counts every drift.')
  meta('name', 'twitter:card', 'summary_large_image')
  meta('name', 'twitter:title', title)
  meta('name', 'twitter:description', description)
  meta('name', 'twitter:image', `${SITE}/og.png`)
  if (!m) { document.getElementById('friction-ld')?.remove(); return }
  const graph = route === 'home'
    ? [
        { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'Friction', url: `${SITE}/`, inLanguage: 'en' },
        appNode(m.description),
      ]
    : [{
        '@type': 'WebPage',
        '@id': `${url}#page`,
        name: m.title,
        description: m.description,
        url,
        isPartOf: { '@id': `${SITE}/#site` },
        about: { '@id': `${SITE}/#app` },
        inLanguage: 'en',
      }]
  jsonLd(graph)
}
