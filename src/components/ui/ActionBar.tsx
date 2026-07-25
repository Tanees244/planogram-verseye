'use client'

import { cn } from '@/lib/cn'
import { PANEL_HEADER, PANEL_SHELL } from '@/lib/uiShell'
import { FiChevronLeft } from 'react-icons/fi'

interface ActionBarProps {
  label: string
  children: React.ReactNode
  dark?: boolean
  layout?: 'horizontal' | 'sidebar'
  className?: string
  /** Short status under the label (e.g. rack name). */
  subtitle?: string
  /** Sidebar only — collapse / hide this context panel. */
  onHide?: () => void
}

/** Context action bar for 3D view (bottom or left sidebar) */
export function ActionBar({
  label,
  subtitle,
  children,
  dark,
  layout = 'horizontal',
  className,
  onHide,
}: ActionBarProps) {
  const isSidebar = layout === 'sidebar'

  return (
    <div
      className={cn(
        isSidebar
          ? cn(
              PANEL_SHELL,
              'w-full flex flex-col gap-2 text-gray-100 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200',
            )
          : 'flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border',
        !isSidebar &&
          (dark
            ? 'bg-white border-gray-200 text-gray-800'
            : 'bg-white border-gray-200 text-gray-800'),
        className,
      )}
    >
      {isSidebar ? (
        <div className={cn(PANEL_HEADER, 'rounded-t-2xl -mx-0 px-3')}>
          <span className="flex h-2 w-2 rounded-full bg-brand shadow-[0_0_8px] shadow-brand animate-pulse shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-light/90">
              {label}
            </p>
            {subtitle ? (
              <p className="text-xs font-semibold text-white truncate mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Hide panel"
            >
              <FiChevronLeft size={15} />
            </button>
          )}
        </div>
      ) : (
        <span className="text-sm font-medium text-gray-500 mr-1">{label}</span>
      )}
      <div className={cn(isSidebar && 'flex flex-col gap-1.5 w-full px-3 pb-2.5')}>{children}</div>
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
    primary:
      'bg-brand text-white hover:bg-brand-dark shadow-md shadow-brand/30 hover:scale-[1.01] active:scale-[0.99]',
    secondary:
      'bg-white/10 text-gray-100 border border-white/15 hover:bg-white/15 hover:border-white/25 hover:scale-[1.01] active:scale-[0.99]',
    danger:
      'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 hover:scale-[1.01] active:scale-[0.99]',
  }
  const palette = fullWidth ? sidebarVariants : variants

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-150',
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
