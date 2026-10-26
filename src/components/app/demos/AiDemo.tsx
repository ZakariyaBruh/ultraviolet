import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AiDemo as Written } from '@/lib/aidemo'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { Frame, ghost, type DemoProps } from './kit'

/*
 * A demo written by an AI is untrusted code. It runs in an iframe that is sealed three ways:
 *  - sandbox="allow-scripts" with no allow-same-origin: the frame gets an empty origin, so it cannot read this page,
 *    its storage or its cookies, and cannot navigate the page, open windows or submit forms;
 *  - a Content-Security-Policy inside the frame that allows only its own inline script and style, so fetch, XHR,
 *    WebSocket, images, fonts and frames from anywhere are all refused (nothing can leave);
 *  - the server already refused any code that names the network, storage, eval or the parent window.
 * The only way out is postMessage, and this component only reads three fixed words from it.
 */

const TOKENS: [string, string, string][] = [['--ink', '--ink', '#e8e8e8'], ['--ink2', '--ink-2', '#b0b0b0'], ['--ink3', '--ink-3', '#888'], ['--ground', '--ground', '#0b0d12'], ['--signal', '--signal', '#ffd23f'], ['--on-signal', '--on-signal', '#111'], ['--rule', '--rule', 'rgba(128,128,128,.4)'], ['--good', '--ok', '#2fbf71'], ['--bad', '--danger', '#e5484d'], ['--warn', '--warn', '#e0a100'], ['--ice', '--ice', '#4aa8d8']]

const BASE = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--ground);color:var(--ink);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
body{overflow:auto}
#app{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.col{display:flex;flex-direction:column;gap:8px;min-width:0}
.grow{flex:1;min-height:0;min-width:0}
.hud{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);font-weight:600}
.big{font-size:clamp(22px,5vw,34px);font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2}
.muted{color:var(--ink2)}
.card{border:1px solid var(--rule);padding:8px;min-width:0}
.stage{position:relative;border:1px solid var(--rule);overflow:hidden;min-width:0}
.stage>canvas,.stage>svg{display:block;width:100%;height:100%}
button{min-height:44px;padding:0 16px;font:inherit;font-weight:600;color:var(--ink);background:transparent;border:1px solid var(--rule);border-radius:0;cursor:pointer}
button:hover{border-color:var(--signal)}
button[aria-pressed=true]{background:var(--ink);color:var(--ground);border-color:var(--ink)}
button:disabled{opacity:.4;cursor:default}
select,input[type=text],input[type=number]{min-height:44px;font:inherit;color:var(--ink);background:transparent;border:1px solid var(--rule);border-radius:0;padding:0 10px;min-width:0}
select option{color:#111;background:#fff}
input[type=range]{width:100%;min-height:44px;margin:0;accent-color:var(--signal)}
label{display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--ink2);min-width:0}
:focus-visible{outline:2px solid var(--signal);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

/** says three things to the page around it: it loaded, it was touched, it broke */
const REPORT = `(function(){var P=parent;function s(t){try{P.postMessage({frictionDemo:1,t:t},'*')}catch(e){}}
addEventListener('error',function(){s('error')});addEventListener('unhandledrejection',function(){s('error')});
addEventListener('load',function(){s('ready')});var o=0;function t(){if(!o){o=1;s('touch')}}
addEventListener('pointerdown',t,true);addEventListener('keydown',t,true);addEventListener('input',t,true)})();`

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'"

/** the document the frame shows: the app's colours, the base styles, and then the demo */
export function frameDocument(html: string): string {
  const cs = getComputedStyle(document.documentElement)
  const vars = TOKENS.map(([name, from, fallback]) => `${name}:${cs.getPropertyValue(from).trim() || fallback}`).join(';')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Demo</title><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{${vars};color-scheme:${document.documentElement.classList.contains('light') ? 'light' : 'dark'}}${BASE}</style><script>${REPORT}</script></head><body><main id="app">${html}</main></body></html>`
}

interface Props extends DemoProps { demo: Written; onFail: () => void }

export function AiDemoFrame({ demo, played, onFail }: Props) {
  const box = useRef<HTMLIFrameElement>(null)
  const [round, setRound] = useState(0)
  const [broke, setBroke] = useState(false)
  const loaded = useRef(false)
  const doc = useMemo(() => frameDocument(demo.html), [demo.html, round]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loaded.current = false
    setBroke(false)
    // a demo that has not said it loaded within a few seconds is not going to
    const late = setTimeout(() => { if (!loaded.current) onFail() }, 6000)
    const hear = (e: MessageEvent) => {
      if (e.source !== box.current?.contentWindow) return
      const d = e.data as { frictionDemo?: number; t?: string } | null
      if (!d || d.frictionDemo !== 1) return
      if (d.t === 'ready') loaded.current = true
      else if (d.t === 'touch') played()
      else if (d.t === 'error') { if (loaded.current) setBroke(true); else onFail() }
    }
    addEventListener('message', hear)
    return () => { clearTimeout(late); removeEventListener('message', hear) }
  }, [doc]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:gap-6">
      <div className="flex shrink-0 flex-col gap-2 md:w-[32%] md:max-w-[340px] md:justify-center">
        <p className="hud">Try it · {demo.title} · AI-made</p>
        <p className="max-w-[58ch] text-[15px] leading-[1.4]">{demo.task}</p>
        <p className="hidden text-[13px] leading-[1.4] text-ink-2 md:block">{demo.note} <span className="text-ink-3">AI-made: check it against the article.</span></p>
      </div>
      <div className="relative min-h-[150px] flex-1 border border-ink/20">
        <iframe ref={box} key={round} title={`Interactive demo: ${demo.title}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={doc} data-no-drag className="absolute inset-0 size-full border-0" />
        {broke && (
          <div role="alert" className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-ink/30 bg-ground p-2 text-[13px]">
            <span>Something in this demo broke.</span>
            <button onClick={() => { setBroke(false); setRound((r) => r + 1) }} className={ghost}><RotateCcw className="size-4" />Start it again</button>
          </div>
        )}
      </div>
      <p className="shrink-0 text-[13px] leading-[1.4] text-ink-2 md:hidden">{demo.note} <span className="text-ink-3">AI-made: check it against the article.</span></p>
    </div>
  )
}

/** shown in the demo's place while it is still being written */
export function DemoWaiting({ title }: { title: string }) {
  return (
    <Frame kicker="A demo is on its way" task={`An AI is writing a small interactive demo about ${title}. Wait a moment for it, or press Continue to carry on without it.`}>
      <div className="min-h-[120px] flex-1"><LoadingBlock label="Writing a demo" size={72} /></div>
    </Frame>
  )
}
