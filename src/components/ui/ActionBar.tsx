'use client'

import { cn } from '@/lib/cn'
import { PANEL_SHELL } from '@/lib/uiShell'

interface ActionBarProps {
  label: string
  children: React.ReactNode
  dark?: boolean
  layout?: 'horizontal' | 'sidebar'
  className?: string
}

/** Context action bar for 3D view (bottom or left sidebar) */
export function ActionBar({ label, children, dark, layout = 'horizontal', className }: ActionBarProps) {
  const isSidebar = layout === 'sidebar'

  return (
    <div
      className={cn(
        isSidebar
          ? cn(PANEL_SHELL, 'w-full flex flex-col gap-2 px-3 py-2.5 text-gray-100')
          : 'flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border',
        !isSidebar && (dark
          ? 'bg-white border-gray-200 text-gray-800'
          : 'bg-white border-gray-200 text-gray-800'),
        className,
      )}
    >
      <span
        className={cn(
          'text-sm font-medium',
          isSidebar ? 'text-[10px] uppercase tracking-wider text-brand-light/80' : 'text-gray-500 mr-1',
        )}
      >
        {label}
      </span>
      <div className={cn(isSidebar && 'flex flex-col gap-1.5 w-full')}>
        {children}
      </div>
    </div>
  )
}

export function ActionBtn({
  children,
  onClick,
  variant = 'primary',
  fullWidth,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
}) {
  const variants = {
    primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm shadow-brand/25',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  }
  const sidebarVariants = {
    primary: 'bg-brand text-white hover:bg-brand-dark shadow-md shadow-brand/30',
    secondary: 'bg-white/10 text-gray-100 border border-white/15 hover:bg-white/15',
    danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25',
  }
  const palette = fullWidth ? sidebarVariants : variants

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all',
        fullWidth && 'w-full justify-center',
        palette[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
