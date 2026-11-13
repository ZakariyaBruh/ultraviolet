import { useThemeId } from '@/lib/theme'
import { themeDef } from '@/lib/themes'

/**
 * Product Hunt's "featured" badge, in the version that suits the theme on screen (Product Hunt draws three): light for the paper-like
 * themes, neutral for Mono, dark for the rest. `t` is part of the address Product Hunt gave and only keeps its picture fresh.
 */
export function ProductHuntBadge({ className = '' }: { className?: string }) {
  const id = useThemeId()
  const look = themeDef(id).light ? 'light' : id === 'mono' ? 'neutral' : 'dark'
  return (
    <a href="https://www.producthunt.com/products/friction-4?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-friction-4" target="_blank" rel="noopener noreferrer" className={`block w-fit ${className}`}>
      <img alt="Friction - Focus u. | Product Hunt" width="250" height="54" loading="lazy" style={{ width: 250, height: 54 }} src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1297515&theme=${look}&t=1794602887120`} />
    </a>
  )
}
