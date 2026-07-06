'use client'

import { cn } from '@/lib/cn'

interface ActionBarProps {
  label: string
  children: React.ReactNode
  dark?: boolean
  className?: string
}

/** Bottom context action bar for 3D view */
export function ActionBar({ label, children, dark, className }: ActionBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md',
        dark
          ? 'bg-white/95 border-gray-200/80 text-gray-800'
          : 'bg-white border-gray-200 text-gray-800',
        className,
      )}
    >
      <span className="text-sm font-medium text-gray-500 mr-1">{label}</span>
      {children}
    </div>
  )
}

export function ActionBtn({
  children,
  onClick,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}) {
  const variants = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
