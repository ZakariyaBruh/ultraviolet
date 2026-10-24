import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** clear: for controls floating directly over live media */
  clear?: boolean
  /** lens: refracts what is behind it (Chromium) */
  lens?: boolean
  radius?: number
  children?: ReactNode
}

/** Liquid Glass: only for the functional layer (nav, dock, island, sheets, floating controls). */
export function Glass({ as: Tag = 'div', clear, lens, radius = 20, className, style, children, ...rest }: GlassProps) {
  return (
    <Tag className={cn(clear ? 'glass-clear' : 'glass', lens && 'lens', className)} style={{ ['--r' as string]: `${radius}px`, ...style }} {...rest}>
      {children}
    </Tag>
  )
}

/** The content layer's quieter surface: thicker, darker, no refraction. For charts, lists, tables. */
export function Material({ as: Tag = 'div', radius = 18, className, style, children, ...rest }: Omit<GlassProps, 'clear' | 'lens'>) {
  return (
    <Tag className={cn('material', className)} style={{ ['--r' as string]: `${radius}px`, ...style }} {...rest}>
      {children}
    </Tag>
  )
}
