'use client'

import { FiMoon, FiSun } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import type { SceneTheme } from '@/constants/sceneTheme'
import { cn } from '@/lib/cn'

export function DayNightToggle({
  className,
  dark,
  embedded,
}: {
  className?: string
  dark?: boolean
  embedded?: boolean
}) {
  const theme = usePlanogramStore((s) => s.sceneTheme)
  const setSceneTheme = usePlanogramStore((s) => s.setSceneTheme)

  const set = (t: SceneTheme) => setSceneTheme(t)

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 rounded-lg',
        !embedded && 'rounded-xl shadow-lg backdrop-blur-sm',
        embedded
          ? 'bg-white/5'
          : dark
            ? 'bg-black/70 border border-white/10'
            : 'bg-white/95 border border-gray-200',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => set('day')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
          embedded && 'flex-1 justify-center',
          theme === 'day'
            ? 'bg-brand text-white shadow-sm'
            : dark
              ? 'text-gray-300 hover:bg-white/10'
              : 'text-gray-600 hover:bg-gray-100',
        )}
        title="Day mode"
      >
        <FiSun size={16} />
        Day
      </button>
      <button
        type="button"
        onClick={() => set('night')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
          embedded && 'flex-1 justify-center',
          theme === 'night'
            ? 'bg-brand text-white shadow-sm'
            : dark
              ? 'text-gray-300 hover:bg-white/10'
              : 'text-gray-600 hover:bg-gray-100',
        )}
        title="Night mode"
      >
        <FiMoon size={16} />
        Night
      </button>
    </div>
  )
}
