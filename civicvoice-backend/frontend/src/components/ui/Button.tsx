import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            'bg-blue-600 text-white shadow hover:bg-blue-500': variant === 'default',
            'bg-red-600 text-white shadow-sm hover:bg-red-500': variant === 'destructive',
            'border border-border bg-background text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900': variant === 'outline',
            'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800': variant === 'secondary',
            'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100': variant === 'ghost',
            'text-blue-500 underline-offset-4 hover:underline': variant === 'link',
          },
          {
            'h-11 sm:h-10 px-4': size === 'default',
            'h-10 sm:h-9 rounded-md px-3 text-sm': size === 'sm',
            'h-11 rounded-md px-8 text-base': size === 'lg',
            'h-11 w-11 sm:h-10 sm:w-10 p-0': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
