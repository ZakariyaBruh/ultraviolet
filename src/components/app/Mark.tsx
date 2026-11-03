/** A ring with a square notch: friction at one point. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Friction">
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="40" y="10" width="16" height="16" fill="var(--signal)" />
    </svg>
  )
}
