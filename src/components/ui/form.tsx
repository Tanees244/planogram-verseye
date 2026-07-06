'use client'

import { cn } from '@/lib/cn'

export const inputClass =
  'w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-60 disabled:bg-gray-50 transition-colors'

export const labelClass = 'block text-sm font-medium text-gray-900 mb-1.5'

interface FormFieldProps {
  label: string
  required?: boolean
  hint?: string
  error?: string | null
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, hint, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <div className={cn('grid gap-4', cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
      {children}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(inputClass, error && 'border-red-300 focus:border-red-400 focus:ring-red-100', className)}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ className, error, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(inputClass, error && 'border-red-300 focus:border-red-400 focus:ring-red-100', className)}
      {...props}
    >
      {children}
    </select>
  )
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Btn({ variant = 'primary', size = 'md', className, children, ...props }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-2 text-sm', md: 'px-5 py-2.5 text-sm' }
  const variants = {
    primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  }
  return (
    <button type="button" className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  )
}

export function Alert({ variant = 'error', children }: { variant?: 'error' | 'warning'; children: React.ReactNode }) {
  const styles =
    variant === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-amber-50 border-amber-200 text-amber-800'
  return <div className={cn('px-3 py-2.5 rounded-lg border text-sm', styles)}>{children}</div>
}

/** Pill toggle group (e.g. one-sided / two-sided) */
export function PillGroup<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              active
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
