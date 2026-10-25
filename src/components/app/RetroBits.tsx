import { Sprite, INVADER, HEART, STAR } from '@/components/app/Sprite'

const LINES = ['Scrolling not required', 'Hold to tune in', 'Stay on one channel', 'Every drift gets counted', 'Time counts only while locked in', 'Insert focus to continue', 'Nothing leaves this browser']
const ART = [INVADER, HEART, STAR]

/** Retro pieces the era dial switches on: tube glass from stop 4, a marquee from stop 3 (with sprites from stop 5). */
export function RetroBits() {
  return (
    <>
      <div className="retro-fx retro-tube" aria-hidden />
      <div className="retro-fx retro-roll" aria-hidden />
      <div className="ticker" aria-hidden>
        <span>
          {LINES.map((l, i) => (
            <span key={l}>{l}<Sprite rows={ART[i % 3]} px={2} className="spr" />{'  ///  '}</span>
          ))}
        </span>
      </div>
    </>
  )
}
