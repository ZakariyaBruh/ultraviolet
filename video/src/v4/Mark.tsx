import { useEffect, useState } from 'react'
import { useDelayRender } from 'remotion'
import { measureText } from '@remotion/layout-utils'

/** the wordmark's two halves, measured once the face has loaded, so the dial can sit exactly where the O goes */
export const useWordmark = (size: number) => {
  const { delayRender, continueRender } = useDelayRender()
  const [m, setM] = useState<{ a: number; b: number; o: number } | null>(null)
  const [h] = useState(() => delayRender('wordmark'))
  useEffect(() => {
    document.fonts.load(`800 ${size}px Unbounded`).then(() => document.fonts.ready).then(() => {
      const f = { fontFamily: 'Unbounded', fontWeight: '800', fontSize: size, letterSpacing: `-0.02em` }
      setM({ a: measureText({ text: 'FRICTI', ...f }).width, b: measureText({ text: 'N', ...f }).width, o: measureText({ text: 'O', ...f }).width })
      continueRender(h)
    })
  }, [size, h, continueRender])
  return m
}
