import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
        secondary:   'border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
        destructive: 'border-transparent bg-red-100 text-red-700 border-red-200',
        outline:     'text-[hsl(var(--foreground))]',
        success:     'border-transparent bg-emerald-100 text-emerald-700 border-emerald-200',
        warning:     'border-transparent bg-amber-100 text-amber-700 border-amber-200',
        info:        'border-transparent bg-blue-100 text-blue-700 border-blue-200',
        ghost:       'border-transparent bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
