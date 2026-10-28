/**
 * Friction alts: small, native stand-ins for popular sites that cannot work in the Browser without the metered cloud browser
 * (script apps like Google Maps and Translate, or sites that turn our server away like Stack Overflow). Each one asks a free public
 * API that needs no key and sends CORS headers, straight from the person's browser, and shows plain rows. No scroll feed, nothing
 * stored, only the words typed are sent. Sites that already read fine in the Browser (Wikipedia, GitHub, Hacker News, Project
 * Gutenberg, the Bible Gateway and the like) deliberately have no alt. Add one by adding an `Alt` to `ALTS`.
 */
export type Row = { title: string; text?: string; link?: string; image?: string; swatch?: string }
export type Option = { label: string; choices: [value: string, label: string][] }
export type Alt = {
  id: string
  name: string
  /** the site people would otherwise go to, in a few words */
  stands: string
  /** what the box asks for; null when the alt needs no words and shows its answer straight away */
  ask: string | null
  ideas: string[]
  option?: Option
  /** host names (or host/path starts) this alt stands in for, so the Issues panel can offer it */
  sites: string[]
  run: (q: string, opt: string) => Promise<{ rows: Row[]; note?: string }>
}

const get = async (url: string, again = true): Promise<any> => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!r.ok && again && r.status >= 500) return get(url, false)
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}
const plain = (html: unknown) => {
  const t = document.createElement('textarea')
  t.innerHTML = String(html ?? '').replace(/<[^>]*>/g, ' ')
  return t.value.replace(/\s+/g, ' ').trim()
}
const num = (n: unknown, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : '–')
const enc = encodeURIComponent
const NO = 'Nothing found. Try other words.'

type Place = { name: string; where: string; lat: number; lon: number; tz: string }
async function place(q: string): Promise<Place> {
  const d = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(q)}&count=1&language=en&format=json`)
  const p = d.results?.[0]
  if (!p) throw new Error(NO)
  return { name: p.name, where: [p.admin1, p.country].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude, tz: p.timezone }
}

const WEATHER: Record<number, string> = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' }
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

const LANGS: [string, string][] = [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['ru', 'Russian'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['zh-CN', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['tr', 'Turkish'], ['pl', 'Polish'], ['sv', 'Swedish']]
const COUNTRIES: [string, string][] = [['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['IE', 'Ireland'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['IN', 'India'], ['JP', 'Japan'], ['KR', 'South Korea'], ['ZA', 'South Africa'], ['NG', 'Nigeria'], ['EG', 'Egypt'], ['SA', 'Saudi Arabia'], ['TR', 'Turkey']]

export const ALTS: Alt[] = [
  {
    id: 'maps', name: 'Maps', stands: 'Google Maps', ask: 'A place or address', ideas: ['Eiffel Tower', 'Kyoto', 'Cape Town'],
    sites: ['maps.google.com', 'google.com/maps', 'openstreetmap.org', 'mapquest.com', 'waze.com'],
    async run(q) {
      const d = await get(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${enc(q)}`)
      const z = 14
      return {
        rows: d.map((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const lat = Number(p.lat), lon = Number(p.lon)
          const x = Math.floor(((lon + 180) / 360) * 2 ** z)
          const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z)
          return { title: String(p.display_name).split(',')[0], text: `${p.display_name}\n${lat.toFixed(4)}, ${lon.toFixed(4)} · ${String(p.type).replace(/_/g, ' ')}`, image: `https://tile.openstreetmap.org/${z}/${x}/${y}.png` }
        }),
        note: 'Map data from OpenStreetMap contributors.',
      }
    },
  },
  {
    id: 'translate', name: 'Translate', stands: 'Google Translate', ask: 'Text to translate (any language)', ideas: ['Where is the library?', 'Good morning'],
    option: { label: 'Into', choices: LANGS }, sites: ['translate.google.com', 'deepl.com', 'bing.com/translator'],
    async run(q, opt) {
      const d = await get(`https://api.mymemory.translated.net/get?q=${enc(q.slice(0, 480))}&langpair=Autodetect|${opt || 'en'}`)
      const best = d.responseData?.translatedText
      if (!best || d.responseStatus === 403 || /INVALID|MYMEMORY WARNING/i.test(String(best))) throw new Error('That could not be translated. Try shorter text or another language.')
      const others = (Array.isArray(d.matches) ? d.matches : []).map((m: any) => String(m.translation)).filter((t: string, i: number, a: string[]) => t !== best && a.indexOf(t) === i).slice(0, 3) // eslint-disable-line @typescript-eslint/no-explicit-any
      return { rows: [{ title: plain(best), text: others.length ? `Other ways: ${others.map(plain).join(' · ')}` : undefined }], note: 'Machine translation (MyMemory). Check anything important.' }
    },
  },
  {
    id: 'papers', name: 'Papers', stands: 'Google Scholar', ask: 'A topic or paper title', ideas: ['sleep and memory', 'attention span', 'transformers'],
    sites: ['scholar.google.com', 'semanticscholar.org', 'researchgate.net'],
    async run(q) {
      const d = await get(`https://api.crossref.org/works?rows=8&select=title,author,DOI,issued,container-title,is-referenced-by-count&query=${enc(q)}`)
      return {
        rows: (d.message?.items ?? []).filter((w: any) => w.title?.[0]).map((w: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          title: plain(w.title[0]),
          text: [(w.author ?? []).slice(0, 4).map((a: any) => [a.given, a.family].filter(Boolean).join(' ')).join(', '), w['container-title']?.[0], w.issued?.['date-parts']?.[0]?.[0], `cited ${num(w['is-referenced-by-count'])} times`].filter(Boolean).join(' · '), // eslint-disable-line @typescript-eslint/no-explicit-any
          link: w.DOI ? `https://doi.org/${w.DOI}` : undefined,
        })),
        note: 'From Crossref. Many papers sit behind a publisher’s page.',
      }
    },
  },
  {
    id: 'weather', name: 'Weather', stands: 'Weather.com', ask: 'A town or city', ideas: ['London', 'Lagos', 'Mumbai'],
    option: { label: 'Units', choices: [['celsius', '°C'], ['fahrenheit', '°F']] }, sites: ['weather.com', 'accuweather.com', 'wunderground.com', 'windy.com'],
    async run(q, opt) {
      const p = await place(q)
      const u = opt === 'fahrenheit' ? '°F' : '°C'
      const d = await get(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&temperature_unit=${opt || 'celsius'}&timezone=auto&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=6`)
      const c = d.current
      const rows: Row[] = [{ title: `${p.name}: ${num(c.temperature_2m)}${u}, ${WEATHER[c.weather_code] ?? 'Unknown'}`, text: `${p.where}\nFeels like ${num(c.apparent_temperature)}${u} · wind ${num(c.wind_speed_10m)} km/h · humidity ${num(c.relative_humidity_2m)}%` }]
      d.daily.time.forEach((t: string, i: number) => rows.push({ title: `${day(t)}: ${num(d.daily.temperature_2m_max[i])}${u} / ${num(d.daily.temperature_2m_min[i])}${u}`, text: `${WEATHER[d.daily.weather_code[i]] ?? ''} · rain chance ${num(d.daily.precipitation_probability_max[i])}%` }))
      return { rows, note: 'Forecast from Open-Meteo.' }
    },
  },
  {
    id: 'qa', name: 'Q&A', stands: 'Stack Overflow', ask: 'A programming question', ideas: ['sort an array', 'git undo commit', 'css center a div'],
    sites: ['stackoverflow.com', 'stackexchange.com'],
    async run(q) {
      const d = await get(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&pagesize=10&site=stackoverflow&q=${enc(q)}`)
      return {
        rows: (d.items ?? []).map((i: any) => ({ title: plain(i.title), text: `${num(i.score)} votes · ${num(i.answer_count)} answers${i.is_answered ? ' · answered' : ''}${i.accepted_answer_id ? ' · accepted answer' : ''} · ${(i.tags ?? []).slice(0, 4).join(', ')}`, link: i.link })), // eslint-disable-line @typescript-eslint/no-explicit-any
        note: 'Question list from the Stack Exchange API. The question pages themselves turn this Browser away, so they open in your own browser.',
      }
    },
  },
  {
    id: 'dictionary', name: 'Dictionary', stands: 'Dictionary.com', ask: 'A word', ideas: ['serendipity', 'ephemeral', 'gist'],
    sites: ['dictionary.com', 'merriam-webster.com', 'dictionary.cambridge.org'],
    async run(q) {
      const d = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(q.trim().split(/\s+/)[0])}`)
      if (!Array.isArray(d)) throw new Error(NO)
      const rows: Row[] = []
      for (const e of d.slice(0, 2)) {
        const ph = e.phonetic || e.phonetics?.find((p: any) => p.text)?.text // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const m of e.meanings ?? []) rows.push({ title: `${e.word}${ph && !rows.length ? `  ${ph}` : ''} · ${m.partOfSpeech}`, text: (m.definitions ?? []).slice(0, 3).map((x: any, i: number) => `${i + 1}. ${x.definition}${x.example ? ` “${x.example}”` : ''}`).join('\n') }) // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      return { rows }
    },
  },
  {
    id: 'thesaurus', name: 'Thesaurus', stands: 'Thesaurus.com', ask: 'A word', ideas: ['happy', 'big', 'quickly'], sites: ['thesaurus.com'],
    async run(q) {
      const w = enc(q.trim())
      const [syn, ant, rel] = await Promise.all([get(`https://api.datamuse.com/words?rel_syn=${w}&max=24`), get(`https://api.datamuse.com/words?rel_ant=${w}&max=12`), get(`https://api.datamuse.com/words?ml=${w}&max=18`)])
      const list = (a: any[]) => a.map((x) => x.word).join(' · ') // eslint-disable-line @typescript-eslint/no-explicit-any
      const rows = [syn.length && { title: 'Same meaning', text: list(syn) }, ant.length && { title: 'Opposite', text: list(ant) }, rel.length && { title: 'Related', text: list(rel) }].filter(Boolean) as Row[]
      return { rows, note: 'Word lists from Datamuse.' }
    },
  },
  {
    id: 'rhymes', name: 'Rhymes', stands: 'RhymeZone', ask: 'A word', ideas: ['light', 'river', 'dream'], sites: ['rhymezone.com', 'rhymer.com'],
    async run(q) {
      const w = enc(q.trim())
      const [r, n] = await Promise.all([get(`https://api.datamuse.com/words?rel_rhy=${w}&max=40`), get(`https://api.datamuse.com/words?rel_nry=${w}&max=30`)])
      const list = (a: any[]) => a.map((x) => x.word).join(' · ') // eslint-disable-line @typescript-eslint/no-explicit-any
      return { rows: [r.length && { title: 'Rhymes', text: list(r) }, n.length && { title: 'Near rhymes', text: list(n) }].filter(Boolean) as Row[], note: 'Word lists from Datamuse.' }
    },
  },
  {
    id: 'archive', name: 'Archive', stands: 'Internet Archive', ask: 'Books, films, audio, old pages', ideas: ['Apollo 11', 'public domain cartoons', 'field recordings'], sites: ['archive.org'],
    option: { label: 'Kind', choices: [['', 'Anything'], ['texts', 'Books'], ['movies', 'Video'], ['audio', 'Audio'], ['image', 'Images']] },
    async run(q, opt) {
      const query = `(${q}) AND NOT collection:(nsfw)${opt ? ` AND mediatype:${opt}` : ''}`
      const d = await get(`https://archive.org/advancedsearch.php?q=${enc(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=mediatype&fl[]=year&rows=12&sort[]=downloads+desc&output=json`)
      return {
        rows: (d.response?.docs ?? []).map((i: any) => ({ title: plain(i.title), text: [i.mediatype, Array.isArray(i.creator) ? i.creator[0] : i.creator, i.year].filter(Boolean).join(' · '), image: `https://archive.org/services/img/${i.identifier}`, link: `https://archive.org/download/${i.identifier}/` })), // eslint-disable-line @typescript-eslint/no-explicit-any
        note: 'The Archive’s own pages need scripts, so each result opens its list of files.',
      }
    },
  },
  {
    id: 'packages', name: 'Packages', stands: 'npm', ask: 'A JavaScript package', ideas: ['react', 'date', 'markdown'], sites: ['npmjs.com'],
    async run(q) {
      const d = await get(`https://registry.npmjs.org/-/v1/search?size=10&text=${enc(q)}`)
      return { rows: (d.objects ?? []).map((o: any) => ({ title: `${o.package.name} ${o.package.version}`, text: `${o.package.description ?? ''}\n${num(o.downloads?.weekly)} downloads a week`.trim(), link: (o.package.links?.repository ?? o.package.links?.homepage)?.replace(/^git\+/, '').replace(/\.git$/, '') })) } // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  },
  {
    id: 'currency', name: 'Currency', stands: 'XE', ask: 'An amount, like 100 usd to eur', ideas: ['100 usd to eur', '50 gbp to jpy', '1 eur'], sites: ['xe.com', 'x-rates.com', 'oanda.com'],
    async run(q) {
      const m = q.toLowerCase().match(/([\d.,]+)?\s*([a-z]{3})\s*(?:to|in|into|->|=|>)?\s*([a-z]{3}(?:\s*,?\s*[a-z]{3})*)?/)
      if (!m) throw new Error('Try “100 usd to eur”.')
      const amount = Number((m[1] ?? '1').replace(/,/g, '')) || 1
      const from = m[2].toUpperCase()
      const to = (m[3] ?? 'USD EUR GBP JPY INR CNY').toUpperCase().split(/[\s,]+/).filter((c) => c !== from).join(',')
      const d = await get(`https://api.frankfurter.dev/v1/latest?amount=${amount}&base=${from}&symbols=${to}`)
      return { rows: Object.entries(d.rates as Record<string, number>).map(([c, v]) => ({ title: `${num(amount, 2)} ${from} = ${num(v, 2)} ${c}` })), note: `European Central Bank rates for ${d.date}. They are reference rates, not what a bank will give you.` }
    },
  },
  {
    id: 'time', name: 'World time', stands: 'Time.is', ask: 'A town or city', ideas: ['Tokyo', 'Nairobi', 'São Paulo'], sites: ['time.is', 'timeanddate.com', 'worldtimebuddy.com'],
    async run(q) {
      const p = await place(q)
      const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, { timeZone: p.tz, ...o }).format(new Date())
      const off = f({ timeZoneName: 'longOffset' }).split(' ').pop() ?? ''
      const m = off.match(/([+-])(\d\d):(\d\d)/)
      const diff = ((m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0) + new Date().getTimezoneOffset()) / 60
      return { rows: [{ title: `${p.name}: ${f({ hour: '2-digit', minute: '2-digit' })}`, text: `${f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n${p.where}\n${p.tz} · ${off}\n${diff === 0 ? 'Same time as you' : `${Math.abs(diff)} hours ${diff > 0 ? 'ahead of' : 'behind'} you`}` }] }
    },
  },
  {
    id: 'recipes', name: 'Recipes', stands: 'Allrecipes', ask: 'A dish or ingredient', ideas: ['pasta', 'chicken', 'lentil'], sites: ['allrecipes.com', 'epicurious.com', 'tasty.co'],
    async run(q) {
      const d = await get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${enc(q)}`)
      return {
        rows: (d.meals ?? []).slice(0, 6).map((m: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const ing = Array.from({ length: 20 }, (_, i) => [m[`strMeasure${i + 1}`], m[`strIngredient${i + 1}`]].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')).filter(Boolean)
          return { title: m.strMeal, text: `${m.strCategory} · ${m.strArea}\n\n${ing.join(', ')}\n\n${String(m.strInstructions ?? '').replace(/\r?\n+/g, '\n')}`, image: m.strMealThumb, link: m.strSource || undefined }
        }),
        note: 'Recipes from TheMealDB.',
      }
    },
  },
  {
    id: 'tv', name: 'TV shows', stands: 'IMDb', ask: 'A show', ideas: ['the office', 'planet earth', 'sherlock'], sites: ['imdb.com', 'rottentomatoes.com'],
    async run(q) {
      const d = await get(`https://api.tvmaze.com/search/shows?q=${enc(q)}`)
      return {
        rows: d.slice(0, 8).map(({ show: s }: any) => ({ title: `${s.name}${s.premiered ? ` (${s.premiered.slice(0, 4)})` : ''}`, text: [s.network?.name ?? s.webChannel?.name, (s.genres ?? []).join(', '), s.rating?.average ? `rated ${s.rating.average}/10` : '', s.status].filter(Boolean).join(' · ') + `\n${plain(s.summary)}`, image: s.image?.medium?.replace('http://', 'https://'), link: s.url })), // eslint-disable-line @typescript-eslint/no-explicit-any
        note: 'Shows from TVmaze. Films are not in this list.',
      }
    },
  },
  {
    id: 'photos', name: 'Photos', stands: 'Unsplash', ask: 'What to look for', ideas: ['northern lights', 'street market', 'old library'], sites: ['unsplash.com', 'pexels.com', 'images.google.com', 'pixabay.com'],
    async run(q) {
      const d = await get(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${enc(`filetype:bitmap ${q}`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=360&format=json&origin=*`)
      if (d.error) throw new Error('The photo library is busy. Try again in a moment.')
      const pages = Object.values(d.query?.pages ?? {}).sort((a: any, b: any) => a.index - b.index) as any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      return { rows: pages.filter((p) => p.imageinfo?.[0]?.thumburl).map((p) => ({ title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), text: plain(p.imageinfo[0].extmetadata?.LicenseShortName?.value ?? ''), image: p.imageinfo[0].thumburl, link: p.imageinfo[0].descriptionurl })), note: 'Free-licence images from Wikimedia Commons. Each page names the author and licence.' }
    },
  },
  {
    id: 'holidays', name: 'Holidays', stands: 'Office Holidays', ask: null, ideas: [], option: { label: 'Country', choices: COUNTRIES }, sites: ['officeholidays.com', 'publicholidays.com'],
    async run(_q, opt) {
      const y = new Date().getFullYear()
      const today = new Date().toISOString().slice(0, 10)
      const lists = await Promise.all([y, y + 1].map((n) => get(`https://date.nager.at/api/v3/PublicHolidays/${n}/${opt || 'US'}`).catch(() => [])))
      const next = lists.flat().filter((h: any) => h.date >= today).slice(0, 12) // eslint-disable-line @typescript-eslint/no-explicit-any
      return { rows: next.map((h: any) => ({ title: `${day(h.date)} ${h.date.slice(0, 4)}: ${h.name}`, text: h.localName !== h.name ? h.localName : undefined })), note: 'Public holidays from Nager.Date.' } // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  },
  {
    id: 'air', name: 'Air quality', stands: 'IQAir', ask: 'A town or city', ideas: ['Delhi', 'Los Angeles', 'Lagos'], sites: ['iqair.com', 'aqicn.org'],
    async run(q) {
      const p = await place(q)
      const d = await get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}&longitude=${p.lon}&current=european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide`)
      const a = d.current?.european_aqi
      const band = a == null ? 'No reading' : a <= 20 ? 'Good' : a <= 40 ? 'Fair' : a <= 60 ? 'Moderate' : a <= 80 ? 'Poor' : a <= 100 ? 'Very poor' : 'Extremely poor'
      return { rows: [{ title: `${p.name}: ${band}${a != null ? ` (index ${num(a)})` : ''}`, text: `${p.where}\nFine dust (PM2.5) ${num(d.current?.pm2_5)} · coarse dust (PM10) ${num(d.current?.pm10)} µg/m³\nOzone ${num(d.current?.ozone)} · nitrogen dioxide ${num(d.current?.nitrogen_dioxide)} · sulphur dioxide ${num(d.current?.sulphur_dioxide)} µg/m³` }], note: 'Modelled air quality (European index) from Open-Meteo, not a ground sensor.' }
    },
  },
  {
    id: 'quakes', name: 'Earthquakes', stands: 'USGS earthquake map', ask: null, ideas: [], sites: ['earthquake.usgs.gov', 'volcanodiscovery.com'],
    option: { label: 'Show', choices: [['4.5_day', 'Past day, 4.5+'], ['4.5_week', 'Past week, 4.5+'], ['significant_month', 'Past month, significant']] },
    async run(_q, opt) {
      const d = await get(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${opt || '4.5_day'}.geojson`)
      return { rows: (d.features ?? []).slice(0, 25).map((f: any) => ({ title: `M${num(f.properties.mag, 1)} · ${f.properties.place}`, text: `${new Date(f.properties.time).toLocaleString()} · depth ${num(f.geometry.coordinates[2])} km`, link: f.properties.url })), note: 'Live feed from the US Geological Survey.' } // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  },
  {
    id: 'food', name: 'Food facts', stands: 'Open Food Facts', ask: 'A food or brand', ideas: ['oat milk', 'nutella', 'basmati rice'], sites: ['openfoodfacts.org', 'myfitnesspal.com', 'fatsecret.com'],
    async run(q) {
      const d = await get(`https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriscore_grade,nutriments,image_front_small_url&search_terms=${enc(q)}`)
      return {
        rows: (d.products ?? []).filter((p: any) => p.product_name).map((p: any) => { const n = p.nutriments ?? {}; return { title: `${p.product_name}${p.brands ? ` · ${String(p.brands).split(',')[0]}` : ''}`, text: `Per 100 g: ${num(n['energy-kcal_100g'])} kcal · fat ${num(n.fat_100g, 1)} g · sugars ${num(n.sugars_100g, 1)} g · salt ${num(n.salt_100g, 2)} g${p.nutriscore_grade ? `\nNutri-Score ${String(p.nutriscore_grade).toUpperCase()}` : ''}`, image: p.image_front_small_url } }), // eslint-disable-line @typescript-eslint/no-explicit-any
        note: 'Crowd-sourced data from Open Food Facts; it can be incomplete.',
      }
    },
  },
  {
    id: 'sun', name: 'Sunrise and sunset', stands: 'Sunrise-Sunset', ask: 'A town or city', ideas: ['Reykjavik', 'Singapore', 'Sydney'], sites: ['sunrise-sunset.org', 'suncalc.org'],
    async run(q) {
      const p = await place(q)
      const d = await get(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=sunrise,sunset,daylight_duration&timezone=auto&forecast_days=5`)
      return { rows: d.daily.time.map((t: string, i: number) => { const h = d.daily.daylight_duration[i] / 3600; return { title: `${day(t)}: up ${clock(`${d.daily.sunrise[i]}Z`)} · down ${clock(`${d.daily.sunset[i]}Z`)}`, text: `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min of daylight` } }), note: `Local time in ${p.name}, ${p.where}.` }
    },
  },
  {
    id: 'music', name: 'Music facts', stands: 'Discogs', ask: 'An artist or album', ideas: ['Radiohead', 'Miles Davis', 'Kind of Blue'], sites: ['musicbrainz.org', 'discogs.com', 'allmusic.com', 'last.fm'],
    option: { label: 'Look for', choices: [['artist', 'Artists'], ['release-group', 'Albums']] },
    async run(q, opt) {
      const d = await get(`https://musicbrainz.org/ws/2/${opt || 'artist'}?fmt=json&limit=10&query=${enc(q)}`)
      const list = (d.artists ?? d['release-groups'] ?? []) as any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      return { rows: list.map((a) => ({ title: a.name ?? a.title, text: opt === 'release-group' ? [a['primary-type'], a['artist-credit']?.[0]?.name, a['first-release-date']?.slice(0, 4)].filter(Boolean).join(' · ') : [a.type, a.country, a.disambiguation, a['life-span']?.begin && `from ${a['life-span'].begin.slice(0, 4)}`].filter(Boolean).join(' · '), link: `https://musicbrainz.org/${opt || 'artist'}/${a.id}` })), note: 'From MusicBrainz, the open music database.' }
    },
  },
  {
    id: 'colors', name: 'Colors', stands: 'Coolors', ask: 'A hex color, like 1E90FF', ideas: ['1E90FF', 'f4a261', '2a9d8f'], sites: ['coolors.co', 'color-hex.com', 'colorhunt.co'],
    async run(q) {
      const hex = q.trim().replace(/^#/, '')
      if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) throw new Error('Type a hex color, like 1E90FF.')
      const [c, s] = await Promise.all([get(`https://www.thecolorapi.com/id?format=json&hex=${hex}`), get(`https://www.thecolorapi.com/scheme?format=json&mode=analogic&count=5&hex=${hex}`)])
      return { rows: [{ title: `${c.name.value} · ${c.hex.value}`, text: `${c.rgb.value}\n${c.hsl.value}`, swatch: c.hex.value }, ...(s.colors ?? []).map((k: any) => ({ title: `${k.name.value} · ${k.hex.value}`, text: 'Neighbouring colour', swatch: k.hex.value }))] } // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  },
  {
    id: 'poems', name: 'Poems', stands: 'Poetry Foundation', ask: 'A title or a poet', ideas: ['Ozymandias', 'Emily Dickinson', 'If'], sites: ['poetryfoundation.org', 'poets.org', 'poem.com'],
    option: { label: 'Search by', choices: [['title', 'Title'], ['author', 'Poet']] },
    async run(q, opt) {
      const d = await get(`https://poetrydb.org/${opt || 'title'}/${enc(q)}`)
      if (!Array.isArray(d)) throw new Error(NO)
      return { rows: d.slice(0, 6).map((p: any) => ({ title: `${p.title} · ${p.author}`, text: p.lines.slice(0, 40).join('\n') + (p.lines.length > 40 ? '\n…' : '') })), note: 'Public-domain poems from PoetryDB.' } // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  },
  {
    id: 'crypto', name: 'Coin prices', stands: 'CoinMarketCap', ask: 'A coin, or nothing for the biggest', ideas: ['bitcoin', 'ethereum', 'solana'], sites: ['coinmarketcap.com', 'coingecko.com'],
    option: { label: 'In', choices: [['usd', 'US dollars'], ['eur', 'Euros'], ['gbp', 'Pounds'], ['jpy', 'Yen']] },
    async run(q, opt) {
      const cur = opt || 'usd'
      const find = q.trim()
      let url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&order=market_cap_desc&per_page=10&page=1`
      if (find) {
        const s = await get(`https://api.coingecko.com/api/v3/search?query=${enc(find)}`)
        const ids = (s.coins ?? []).slice(0, 8).map((c: any) => c.id).join(',') // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!ids) throw new Error(NO)
        url += `&ids=${ids}`
      }
      const d = await get(url)
      return { rows: d.map((c: any) => ({ title: `${c.name} (${String(c.symbol).toUpperCase()}): ${num(c.current_price, c.current_price < 1 ? 4 : 2)} ${cur.toUpperCase()}`, text: `24 hours ${c.price_change_percentage_24h >= 0 ? '+' : ''}${num(c.price_change_percentage_24h, 2)}% · market value ${num(c.market_cap)}`, image: c.image })), note: 'Prices from CoinGecko, which can be a few minutes old. Not advice.' } // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  },
  {
    id: 'waves', name: 'Waves', stands: 'Surfline', ask: 'A coastal town', ideas: ['Newquay', 'Honolulu', 'Biarritz'], sites: ['surfline.com', 'magicseaweed.com', 'surf-forecast.com'],
    async run(q) {
      const p = await place(q)
      const d = await get(`https://marine-api.open-meteo.com/v1/marine?latitude=${p.lat}&longitude=${p.lon}&timezone=auto&current=wave_height,wave_period,wave_direction,swell_wave_height&daily=wave_height_max,wave_period_max&forecast_days=5`)
      if (d.current?.wave_height == null) throw new Error(`${p.name} is not on the coast, so there is no sea data for it. Try a town by the sea.`)
      const rows: Row[] = [{ title: `${p.name}: waves ${num(d.current.wave_height, 1)} m every ${num(d.current.wave_period)} s`, text: `${p.where}\nSwell ${num(d.current.swell_wave_height, 1)} m · coming from ${num(d.current.wave_direction)}°` }]
      d.daily.time.forEach((t: string, i: number) => rows.push({ title: `${day(t)}: up to ${num(d.daily.wave_height_max[i], 1)} m`, text: `longest period ${num(d.daily.wave_period_max[i])} s` }))
      return { rows, note: 'Open-sea model from Open-Meteo; beaches near the shore can differ a lot.' }
    },
  },
]

/** the alt that stands in for this address, if there is one */
export function altFor(u: URL): Alt | null {
  const host = u.hostname.replace(/^(www|m)\./, '')
  const path = host + u.pathname
  return ALTS.find((a) => a.sites.some((s) => (s.includes('/') ? path.startsWith(s) : host === s || host.endsWith(`.${s}`)))) ?? null
}
