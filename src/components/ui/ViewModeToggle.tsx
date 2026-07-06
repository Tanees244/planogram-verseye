'use client'

import { cn } from '@/lib/cn'

interface ViewModeToggleProps {
  mode: 'traditional' | 'advanced'
  onChange: (mode: 'traditional' | 'advanced') => void
  dark?: boolean
}

export function ViewModeToggle({ mode, onChange, dark }: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        'flex gap-1 p-1 rounded-xl shadow-lg backdrop-blur-sm',
        dark ? 'bg-black/70 border border-white/10' : 'bg-white/95 border border-gray-200',
      )}
    >
      {(['traditional', 'advanced'] as const).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
              active
                ? 'bg-brand text-white shadow-sm'
                : dark
                  ? 'text-gray-300 hover:bg-white/10'
                  : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {m === 'traditional' ? 'Traditional' : '3D View'}
          </button>
        )
      })}
    </div>
  )
}
