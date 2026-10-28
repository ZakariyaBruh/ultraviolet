import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AiDemo as Written } from '@/lib/aidemo'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { Frame, ghost, type DemoProps } from './kit'
import { FRAME_CSS, FRAME_VARS } from './frameStyle'

/*
 * A demo written by an AI is untrusted code. It runs in an iframe that is sealed three ways:
 *  - sandbox="allow-scripts" with no allow-same-origin: the frame gets an empty origin, so it cannot read this page,
 *    its storage or its cookies, and cannot navigate the page, open windows or submit forms;
 *  - a Content-Security-Policy inside the frame that allows only its own inline script and style, so fetch, XHR,
 *    WebSocket, images, fonts and frames from anywhere are all refused (nothing can leave);
 *  - the server already refused any code that names the network, storage, eval or the parent window.
 * The only way out is postMessage, and this component only reads three fixed words from it.
 */

/** says three things to the page around it: it loaded, it was touched, it broke */
const REPORT = `(function(){var P=parent;function s(t){try{P.postMessage({frictionDemo:1,t:t},'*')}catch(e){}}
addEventListener('error',function(){s('error')});addEventListener('unhandledrejection',function(){s('error')});
addEventListener('load',function(){s('ready')});var o=0;function t(){if(!o){o=1;s('touch')}}
addEventListener('pointerdown',t,true);addEventListener('keydown',t,true);addEventListener('input',t,true)})();`

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'"

/** the document the frame shows: the app's colours, faces and theme, the base styles, and then the demo */
export function frameDocument(html: string, faces = ''): string {
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const vars = FRAME_VARS.map(([name, from, fallback]) => `${name}:${cs.getPropertyValue(from).trim() || fallback}`).join(';')
  const theme = (root.dataset.theme ?? 'station').replace(/[^a-z-]/g, '')
  return `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><title>Demo</title><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${faces}:root{${vars};color-scheme:${root.classList.contains('light') ? 'light' : 'dark'}}${FRAME_CSS}</style><script>${REPORT}</script></head><body><main id="app">${html}</main></body></html>`
}

interface Props extends DemoProps { demo: Written; onFail: () => void; onAgain?: () => void }

export function AiDemoFrame({ demo, played, onFail, onAgain }: Props) {
  const box = useRef<HTMLIFrameElement>(null)
  const [round, setRound] = useState(0)
  const [broke, setBroke] = useState(false)
  const loaded = useRef(false)
  // the app's faces travel inside the frame as data; they are a separate chunk, fetched the first time a demo like this is shown
  const [faces, setFaces] = useState<string | null>(null)
  useEffect(() => { let dead = false; import('./frameFonts').then((m) => { if (!dead) setFaces(m.FACES) }, () => { if (!dead) setFaces('') }); return () => { dead = true } }, [])
  const doc = useMemo(() => (faces === null ? '' : frameDocument(demo.html, faces)), [demo.html, round, faces]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!doc) return
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
        <p className="hud flex flex-wrap items-center gap-x-2 gap-y-1">Try it · {demo.title}<span className="border border-signal px-1.5 py-0.5 text-signal">AI-made</span></p>
        <p className="max-w-[58ch] text-[15px] leading-[1.4]">{demo.task}</p>
        <p className="hidden text-[13px] leading-[1.4] text-ink-2 md:block">{demo.note} <span className="text-ink-3">An AI wrote this demo, not the lesson. Check it against the article.</span></p>
        {onAgain && <div className="hidden md:block"><button onClick={onAgain} className={ghost}><RotateCcw className="size-4" />Not working? Write another</button></div>}
      </div>
      <div className="relative min-h-[150px] flex-1 border border-ink/20">
        {doc && <iframe ref={box} key={round} title={`Interactive demo: ${demo.title}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={doc} data-no-drag className="absolute inset-0 size-full border-0" />}
        {broke && (
          <div role="alert" className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-ink/30 bg-ground p-2 text-[13px]">
            <span>Something in this demo broke.</span>
            <button onClick={() => { setBroke(false); setRound((r) => r + 1) }} className={ghost}><RotateCcw className="size-4" />Start it again</button>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 md:hidden">
        <p className="text-[13px] leading-[1.4] text-ink-2">{demo.note} <span className="text-ink-3">An AI wrote this demo, not the lesson. Check it against the article.</span></p>
        {onAgain && <button onClick={onAgain} className={`${ghost} self-start`}><RotateCcw className="size-4" />Not working? Write another</button>}
      </div>
    </div>
  )
}

/** shown in the demo's place while it is still being written */
export function DemoWaiting({ title }: { title: string }) {
  return (
    <Frame kicker="A demo is on its way" task={`The lesson is built from Wikipedia by fixed rules. Only this demo is written by an AI, because there is no built-in one for ${title}. Wait a moment, or press Continue.`}>
      <div className="min-h-[120px] flex-1"><LoadingBlock label="Writing a demo" size={72} /></div>
    </Frame>
  )
}
