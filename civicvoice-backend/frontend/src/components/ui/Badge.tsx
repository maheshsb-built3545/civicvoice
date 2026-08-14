import * as React from "react"
import { cn } from "./Button"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'info'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 select-none",
        {
          'border-transparent bg-zinc-200/60 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100': variant === 'default',
          'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400': variant === 'secondary',
          'border-border text-foreground': variant === 'outline',
          'border-emerald-500/20 bg-success-soft text-emerald-700 dark:text-emerald-400': variant === 'success',
          'border-amber-500/20 bg-warning-soft text-amber-700 dark:text-amber-400': variant === 'warning',
          'border-red-500/20 bg-danger-soft text-red-700 dark:text-red-400': variant === 'danger',
          'border-blue-500/20 bg-info-soft text-blue-700 dark:text-blue-450': variant === 'info',
        },
        className
      )}
      {...props}
    />
  )
}
