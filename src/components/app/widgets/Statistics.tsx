import { useMemo, useState } from 'react'
import { fit, numbersIn, pairsIn, summarise } from '@/lib/describe'
import { show } from '@/lib/mathexpr'
import { cn } from '@/lib/utils'
import { field } from './Window'

/** Paste numbers (any separators) for a summary, a box plot and a histogram; paste pairs, two numbers a line, for a line of best fit. */
const SAMPLE = '12 15 11 18 14 13 16 40 15 14'
const f = (n: number) => show(Number(n.toPrecision(7)))

export function Statistics() {
  const [text, setText] = useState('')
  const [tab, setTab] = useState<'one' | 'pairs'>('one')
  const { nums, skipped } = useMemo(() => numbersIn(text), [text])
  const sum = useMemo(() => summarise(nums), [nums])
  const pts = useMemo(() => pairsIn(text), [text])
  const line = useMemo(() => fit(pts), [pts])
  const seg = 'h-11 px-3 text-[13px] font-semibold md:h-9'
  return (
    <div className="grid gap-2">
      <div role="tablist" aria-label="Kind of data" className="flex border-b border-ink/15">
        <button role="tab" aria-selected={tab === 'one'} onClick={() => setTab('one')} className={cn(seg, tab === 'one' ? 'border-b-2 border-signal text-ink' : 'text-ink-3 hover:text-ink')}>Numbers</button>
        <button role="tab" aria-selected={tab === 'pairs'} onClick={() => setTab('pairs')} className={cn(seg, tab === 'pairs' ? 'border-b-2 border-signal text-ink' : 'text-ink-3 hover:text-ink')}>Pairs</button>
      </div>
      <label className="grid gap-0.5 text-[11px] text-ink-3">{tab === 'one' ? 'Numbers, separated by spaces, commas or lines' : 'One pair a line: x then y'}
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 50_000))} rows={3} spellCheck={false} data-no-drag placeholder={tab === 'one' ? SAMPLE : '1 2.1\n2 3.9\n3 6.2'} className={cn(field, 'fig h-auto w-full resize-y px-2 py-1.5 text-[14px]')} />
      </label>
      {tab === 'one' ? (
        !sum ? <p className="text-[13px] text-ink-3">{text.trim() ? 'No numbers found.' : 'Paste some numbers.'} <button className="underline" onClick={() => setText(SAMPLE)}>Try an example</button></p> : (
          <>
            <p className="text-[12px] text-ink-3" role="status">{sum.n.toLocaleString('en-US')} number{sum.n === 1 ? '' : 's'}{skipped ? `, ${skipped} word${skipped === 1 ? '' : 's'} skipped` : ''}</p>
            <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
              {([['Mean', f(sum.mean)], ['Median', f(sum.median)], ['Mode', sum.modes.length ? sum.modes.slice(0, 3).map(f).join(', ') : 'none'], ['Sum', f(sum.sum)], ['Min', f(sum.min)], ['Max', f(sum.max)], ['Range', f(sum.range)], ['Q1 · Q3', `${f(sum.q1)} · ${f(sum.q3)}`], ['Std dev (sample)', sum.sd === null ? 'needs 2' : f(sum.sd)], ['Std dev (all)', f(sum.sdPop)], ['Variance', sum.variance === null ? 'needs 2' : f(sum.variance)], ['IQR', f(sum.iqr)]] as [string, string][]).map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-3">{k}</dt><dd className="fig text-ink">{v}</dd></div>)}
            </dl>
            {sum.outliers.length > 0 && <p className="text-[12px] text-ink-2">Outlier{sum.outliers.length === 1 ? '' : 's'} (1.5 × IQR): <span className="fig">{sum.outliers.slice(0, 10).map(f).join(', ')}</span></p>}
            <Plots s={sum} />
          </>
        )
      ) : pts.length < 2 ? <p className="text-[13px] text-ink-3">Needs at least two lines with two numbers each.</p>
        : !line ? <p className="text-[13px] text-ink-2">Every x is the same, so there is no line.</p>
          : (
            <>
              <p className="fig text-[15px] text-ink" role="status">y = {f(line.slope)}x {line.intercept < 0 ? '−' : '+'} {f(Math.abs(line.intercept))}</p>
              <p className="fig text-[13px] text-ink-2">r = {line.r.toFixed(4)} · r² = {line.r2.toFixed(4)} · {line.n} points</p>
              <Scatter pts={pts} slope={line.slope} intercept={line.intercept} />
            </>
          )}
    </div>
  )
}

function Plots({ s }: { s: NonNullable<ReturnType<typeof summarise>> }) {
  const W = 300, pad = 8, span = s.range || 1
  const x = (v: number) => pad + ((v - s.min) / span) * (W - 2 * pad)
  const bins = Math.min(12, Math.max(3, Math.ceil(Math.sqrt(s.n))))
  const counts = Array(bins).fill(0)
  for (const v of s.sorted) counts[s.range === 0 ? 0 : Math.min(bins - 1, Math.floor(((v - s.min) / span) * bins))]++
  const top = Math.max(...counts)
  const text = `Box plot from ${f(s.min)} to ${f(s.max)}, median ${f(s.median)}, middle half ${f(s.q1)} to ${f(s.q3)}. Histogram in ${bins} bins, the tallest holds ${top}.`
  return (
    <svg viewBox={`0 0 ${W} 110`} role="img" aria-label={text} className="w-full max-w-md" data-no-drag>
      <line x1={x(s.min)} x2={x(s.max)} y1="14" y2="14" stroke="var(--ink-3)" />
      <rect x={x(s.q1)} y="6" width={Math.max(1, x(s.q3) - x(s.q1))} height="16" fill="color-mix(in srgb, var(--signal) 30%, transparent)" stroke="var(--signal)" />
      <line x1={x(s.median)} x2={x(s.median)} y1="6" y2="22" stroke="var(--signal)" strokeWidth="2" />
      {s.outliers.map((o, i) => <circle key={i} cx={x(o)} cy="14" r="2.5" fill="var(--ice)" />)}
      {counts.map((c, i) => { const bw = (W - 2 * pad) / bins, h = top ? (c / top) * 70 : 0; return <rect key={i} x={pad + i * bw + 1} y={100 - h} width={bw - 2} height={h} fill="var(--ice)" opacity="0.8" /> })}
      <line x1={pad} x2={W - pad} y1="100" y2="100" stroke="var(--ink-3)" />
    </svg>
  )
}

function Scatter({ pts, slope, intercept }: { pts: { x: number; y: number }[]; slope: number; intercept: number }) {
  const W = 300, H = 160, pad = 10
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys, slope * x0 + intercept, slope * x1 + intercept), y1 = Math.max(...ys, slope * x0 + intercept, slope * x1 + intercept)
  const X = (v: number) => pad + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * pad), Y = (v: number) => H - pad - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * pad)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Scatter plot of ${pts.length} points with the line y = ${f(slope)}x + ${f(intercept)}`} className="w-full max-w-md" data-no-drag>
      <line x1={X(x0)} y1={Y(slope * x0 + intercept)} x2={X(x1)} y2={Y(slope * x1 + intercept)} stroke="var(--signal)" strokeWidth="2" />
      {pts.slice(0, 2000).map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="3" fill="var(--ice)" />)}
    </svg>
  )
}
