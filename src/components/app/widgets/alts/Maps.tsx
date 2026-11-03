import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Navigation, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ALT } from '@/lib/alts'
import { field } from '../Window'
import { AltFrame, getJson, type AltProps } from './kit'

/**
 * Friction Maps, in place of Google Maps. The map is OpenStreetMap, drawn by Leaflet (drag, pinch, wheel, arrow keys). Places come
 * from Nominatim, OpenStreetMap's own search, and routes from the public OSRM server, which only knows driving. Both are free,
 * need no key and answer browsers; only the words typed are sent, and nothing about where you are (no location is asked for).
 */
interface Place { lat: string; lon: string; display_name: string; boundingbox?: string[] }
interface Route { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const geocode = async (q: string): Promise<Place[]> => (await getJson(`${NOMINATIM}?${new URLSearchParams({ q, format: 'jsonv2', limit: '6' })}`)) as Place[]
const signal = () => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() || '#ffd23f'
const ground = () => getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || '#05070c'
const short = (n: string) => n.split(',').slice(0, 3).join(',')
const when = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min` }

export default function Maps({ hit, onBack, onCloud }: AltProps) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const [mode, setMode] = useState<'places' | 'route'>(hit.from || hit.to ? 'route' : 'places')
  const [text, setText] = useState(hit.q ?? '')
  const [from, setFrom] = useState(hit.from ?? '')
  const [to, setTo] = useState(hit.to ?? '')
  const [found, setFound] = useState<Place[]>([])
  const [chosen, setChosen] = useState<Place | null>(null)
  const [trip, setTrip] = useState<{ km: number; secs: number; a: string; b: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = useRef(0)

  // the map itself
  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { attributionControl: false, worldCopyJump: true, minZoom: 2 }).setView([25, 10], 2)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).addTo(m)
    L.control.attribution({ prefix: false }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); map.current = null; layer.current = null }
  }, [])

  const dot = (p: [number, number], label: string) => L.circleMarker(p, { radius: 9, color: ground(), weight: 3, fillColor: signal(), fillOpacity: 1 }).bindTooltip(label, { direction: 'top', offset: [0, -8] })
  const show = (p: Place) => {
    const m = map.current, g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const at: [number, number] = [Number(p.lat), Number(p.lon)]
    dot(at, short(p.display_name)).addTo(g)
    const bb = p.boundingbox?.map(Number)
    if (bb && bb.length === 4 && bb.every(Number.isFinite)) m.fitBounds([[bb[0], bb[2]], [bb[1], bb[3]]], { maxZoom: 16, padding: [24, 24] })
    else m.setView(at, 15)
    setChosen(p); setFound([]); setTrip(null)
  }
  const find = async (q: string) => {
    const t = q.trim()
    if (!t) return
    const my = ++run.current
    setBusy(true); setErr('')
    try {
      const r = await geocode(t)
      if (my !== run.current) return
      if (!r.length) { setErr('No place found. Try the name with the town or country.'); setFound([]); return }
      if (r.length === 1) show(r[0]); else { setFound(r); setChosen(null) }
    } catch { if (my === run.current) setErr('The place search did not answer. Try again in a moment.') } finally { if (my === run.current) setBusy(false) }
  }
  const route = async (a: string, b: string) => {
    if (!a.trim() || !b.trim()) return setErr('Type where from and where to.')
    const my = ++run.current
    setBusy(true); setErr(''); setFound([]); setChosen(null)
    try {
      const pa = (await geocode(a.trim()))[0]
      await new Promise((r) => setTimeout(r, 1100)) // the place search asks for one request a second
      const pb = (await geocode(b.trim()))[0]
      if (my !== run.current) return
      if (!pa || !pb) return setErr(`No place found for ${!pa ? `“${a}”` : `“${b}”`}.`)
      const A: [number, number] = [Number(pa.lon), Number(pa.lat)], B: [number, number] = [Number(pb.lon), Number(pb.lat)]
      const r = (await getJson(`${OSRM}/${A.join(',')};${B.join(',')}?overview=full&geometries=geojson`, 15000)) as Route
      if (my !== run.current) return
      const best = r.routes?.[0]
      if (r.code !== 'Ok' || !best) return setErr('No driving route between those places.')
      const m = map.current, g = layer.current
      if (!m || !g) return
      g.clearLayers()
      const line = L.polyline(best.geometry.coordinates.map(([x, y]) => [y, x] as [number, number]), { color: ground(), weight: 9, opacity: 0.9 }).addTo(g)
      L.polyline(line.getLatLngs() as L.LatLngExpression[], { color: signal(), weight: 5 }).addTo(g)
      dot([A[1], A[0]], short(pa.display_name)).addTo(g); dot([B[1], B[0]], short(pb.display_name)).addTo(g)
      m.fitBounds(line.getBounds(), { padding: [30, 30] })
      setTrip({ km: best.distance / 1000, secs: best.duration, a: short(pa.display_name), b: short(pb.display_name) })
    } catch { if (my === run.current) setErr('The route service did not answer. Try again in a moment.') } finally { if (my === run.current) setBusy(false) }
  }
  useEffect(() => {
    if (hit.from && hit.to) void route(hit.from, hit.to)
    else if (hit.q) void find(hit.q)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AltFrame alt={ALT.maps} site={hit.site === 'Google Maps' || hit.site.includes('Maps') ? hit.site : 'Google Maps'} cloudUrl="https://www.google.com/maps" onBack={onBack} onCloud={onCloud} credit="Map data © OpenStreetMap contributors. Driving routes only.">
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)]">
        <div className="grid gap-2 p-2 pb-1">
          <div role="group" aria-label="What to do" className="flex gap-1.5">
            {([['places', 'Places', MapPin], ['route', 'Directions', Navigation]] as const).map(([k, n, Icon]) => (
              <button key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setErr('') }} className={`inline-flex min-h-11 items-center gap-1.5 px-3 text-[13px] ${mode === k ? 'bg-ink text-ground' : 'border border-ink/25 hover:bg-ink/10'}`}><Icon className="size-3.5" aria-hidden />{n}</button>
            ))}
          </div>
          {mode === 'places' ? (
            <form onSubmit={(e) => { e.preventDefault(); void find(text) }} className="flex gap-2">
              <label className="relative min-w-0 flex-1"><span className="sr-only">Search a place</span>
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="A place, an address or a landmark" autoComplete="off" spellCheck={false} enterKeyHint="search" autoFocus={!hit.q && !hit.from} className={`${field} w-full pl-9`} data-no-drag />
              </label>
              <button type="submit" disabled={busy} className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-60">Search</button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void route(from, to) }} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="min-w-0"><span className="sr-only">From</span><input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" autoComplete="off" spellCheck={false} className={`${field} w-full`} data-no-drag /></label>
              <label className="min-w-0"><span className="sr-only">To</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" autoComplete="off" spellCheck={false} className={`${field} w-full`} data-no-drag /></label>
              <button type="submit" disabled={busy} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-60">Go</button>
            </form>
          )}
        </div>
        <div className="px-2 pb-1 text-[13px]" aria-live="polite">
          {busy && <p className="hud py-1" role="status">Searching…</p>}
          {err && <p role="alert" className="py-1 text-bad">{err}</p>}
          {chosen && !found.length && (
            <p className="flex items-center gap-2 py-1"><MapPin className="size-4 shrink-0 text-signal" aria-hidden /><span className="min-w-0 flex-1 truncate">{chosen.display_name}</span><button onClick={() => { setChosen(null); layer.current?.clearLayers() }} aria-label="Clear the place" className="grid size-11 shrink-0 place-items-center text-ink-2 hover:text-ink"><X className="size-4" /></button></p>
          )}
          {trip && !busy && (
            <p className="py-1"><span className="fig font-bold">{trip.km >= 10 ? Math.round(trip.km) : trip.km.toFixed(1)} km</span> <span className="text-ink-3">({(trip.km * 0.621371 >= 10 ? Math.round(trip.km * 0.621371) : (trip.km * 0.621371).toFixed(1))} mi)</span> · <span className="fig font-bold">{when(trip.secs)}</span> driving, from {trip.a} to {trip.b}.</p>
          )}
        </div>
        <div className="relative isolate min-h-[11rem] border-t border-ink/15">
          <div ref={el} className="absolute inset-0" data-no-drag role="application" aria-label="Map" />
          {found.length > 0 && (
            <ul className="scroll-y absolute inset-x-2 top-2 z-[1000] m-0 max-h-[75%] list-none border border-ink/30 bg-ground p-0" aria-label="Places found" data-no-drag>
              {found.map((p) => <li key={`${p.lat},${p.lon}`}><button onClick={() => show(p)} className="block min-h-11 w-full truncate px-3 py-2 text-left text-[13px] hover:bg-ink/10">{p.display_name}</button></li>)}
            </ul>
          )}
        </div>
      </div>
    </AltFrame>
  )
}
