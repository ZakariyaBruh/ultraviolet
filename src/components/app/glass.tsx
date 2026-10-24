import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** clear: for controls floating directly over live media */
  clear?: boolean
  /** kept for call sites; the surface is flat now */
  lens?: boolean
  radius?: number
  children?: ReactNode
}

/** The floating layer (nav, player, timer, chips): a ruled black plate with registration ticks. */
export function Glass({ as: Tag = 'div', clear, lens: _lens, radius = 4, className, style, children, ...rest }: GlassProps) {
  return (
    <Tag className={cn(clear ? 'glass-clear' : 'glass', className)} style={{ ['--r' as string]: `${Math.min(radius, 6)}px`, ...style }} {...rest}>
      {children}
    </Tag>
  )
}

/** The content layer's dotted panel: charts, lists, tables. */
export function Material({ as: Tag = 'div', radius = 4, className, style, children, ...rest }: Omit<GlassProps, 'clear' | 'lens'>) {
  return (
    <Tag className={cn('material', className)} style={{ ['--r' as string]: `${Math.min(radius, 6)}px`, ...style }} {...rest}>
      {children}
    </Tag>
  )
}
