/** A dial with a notch: the ring you hold still. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Anti-Scroll">
      <path d="M32 11a21 21 0 1 0 14.8 6.2" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5" fill="var(--signal)" />
    </svg>
  )
}
