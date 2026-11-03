import { Download, Eraser, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { key } from './Window'

const W = 640
const H = 360

/** A scratch board for working something out by hand. It is not saved; Save keeps a picture. */
export function Sketch() {
  const cv = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [tool, setTool] = useState<'pen' | 'rub'>('pen')
  const [empty, setEmpty] = useState(true)

  const at = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const c = cv.current?.getContext('2d')
    if (!c) return
    c.lineCap = 'round'; c.lineJoin = 'round'
    c.globalCompositeOperation = tool === 'rub' ? 'destination-out' : 'source-over'
    c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#fff'
    c.lineWidth = tool === 'rub' ? 26 : 3.2
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke()
  }
  const down = (e: PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); const p = at(e); last.current = p; line(p, { x: p.x + 0.01, y: p.y }); if (tool === 'pen') setEmpty(false) }
  const move = (e: PointerEvent<HTMLCanvasElement>) => { if (!last.current) return; const p = at(e); line(last.current, p); last.current = p }
  const up = () => { last.current = null }
  const clear = () => { cv.current?.getContext('2d')?.clearRect(0, 0, W, H); setEmpty(true) }
  const save = () => {
    const src = cv.current
    if (!src) return
    const out = document.createElement('canvas')
    out.width = W; out.height = H
    const c = out.getContext('2d')
    if (!c) return
    c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || '#000'
    c.fillRect(0, 0, W, H); c.drawImage(src, 0, 0)
    out.toBlob((b) => { if (!b) return; const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = 'sketch.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })
  }
  return (
    <div className="grid gap-2">
      <div className="relative aspect-[16/9] w-full border border-ink/25">
        <canvas ref={cv} width={W} height={H} role="img" aria-label="Scratch board. Draw with a finger, a pen or the mouse." className="absolute inset-0 size-full touch-none cursor-crosshair" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {empty && <p aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-ink-3">Draw here</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Tool">
          <button aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} aria-label="Pen" className={cn(key, 'size-11 md:size-9', tool === 'pen' && 'bg-ink text-ground hover:bg-ink')}><Pencil className="size-4" /></button>
          <button aria-pressed={tool === 'rub'} onClick={() => setTool('rub')} aria-label="Rubber" className={cn(key, 'size-11 md:size-9', tool === 'rub' && 'bg-ink text-ground hover:bg-ink')}><Eraser className="size-4" /></button>
        </div>
        <div className="flex gap-1">
          <button onClick={save} disabled={empty} aria-label="Save as a picture" className={`${key} size-11 disabled:opacity-40 md:size-9`}><Download className="size-4" /></button>
          <button onClick={clear} disabled={empty} aria-label="Clear the board" className={`${key} size-11 disabled:opacity-40 md:size-9`}><Trash2 className="size-4" /></button>
        </div>
      </div>
    </div>
  )
}
