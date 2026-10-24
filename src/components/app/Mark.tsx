/** A square of dots with one lit: the friction point. */
export function Mark({ size = 24 }: { size?: number }) {
  const dots = []
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) dots.push(<rect key={`${x}${y}`} x={8 + x * 18} y={8 + y * 18} width="12" height="12" fill={x === 1 && y === 1 ? 'var(--signal)' : 'currentColor'} />)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Friction">
      {dots}
    </svg>
  )
}
