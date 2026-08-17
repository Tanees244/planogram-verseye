'use client'

import { useEffect, useState } from 'react'
import { FiBox, FiChevronLeft, FiChevronRight, FiGrid, FiLayers, FiSearch, FiTag } from 'react-icons/fi'
import { FixturePalette } from '@/components/FixturePalette'
import { ProductPalette } from '@/components/ProductPalette'
import { PosmPalette } from '@/components/PosmPalette'
import { ContextAddButton } from '@/components/ContextAddButton'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'
import { PANEL_SHELL } from '@/lib/uiShell'

export type LeftLibraryTab = 'fixtures' | 'products' | 'posm' | 'racks'
const PANEL_COLLAPSE_KEY = 'planogram.leftPanelCollapsed'

const TABS: Array<{
  id: LeftLibraryTab
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}> = [
  { id: 'fixtures', label: 'Fixtures', icon: FiGrid },
  { id: 'products', label: 'Products', icon: FiBox },
  { id: 'posm', label: 'POSM', icon: FiTag },
  { id: 'racks', label: 'Rows & racks', icon: FiLayers },
]

/**
 * Option A layout: persistent search + icon tabs for fixtures / products / POSM / rack tools.
 */
export function SceneLeftPanel() {
  const selectedType = usePlanogramStore((s) => s.selectedType)
  const [tab, setTab] = useState<LeftLibraryTab>('fixtures')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(PANEL_COLLAPSE_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      window.localStorage.setItem(PANEL_COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  // Auto-surface structure tools for the clicked object; POSM stays its own tab.
  useEffect(() => {
    setTab((current) => {
      if (current === 'posm' || current === 'products') return current
      if (selectedType === 'rack' || selectedType === 'row' || selectedType === 'bin') {
        return 'racks'
      }
      return current
    })
  }, [selectedType])

  const searchPlaceholder =
    tab === 'fixtures'
      ? 'Search fixtures…'
      : tab === 'products'
        ? 'Search SKUs…'
        : tab === 'posm'
          ? 'Search POSM…'
          : 'Search fixtures, products…'

  if (collapsed) {
    return (
      <div className={cn(PANEL_SHELL, 'w-[52px] p-1.5')}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Expand left panel"
          className="w-9 h-9 rounded-lg border border-slate-500 bg-[#1e293b] text-white hover:bg-[#243248] flex items-center justify-center"
        >
          <FiChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className={cn(PANEL_SHELL, 'w-[288px] h-full min-h-0 flex flex-col overflow-hidden')}>
      <div className="shrink-0 p-2 space-y-2 border-b border-slate-600/80">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Collapse left panel"
            className="w-7 h-7 rounded-lg border border-slate-600 bg-[#1e293b] text-gray-300 hover:text-white hover:bg-[#243248] flex items-center justify-center"
          >
            <FiChevronLeft size={14} />
          </button>
        </div>
        <div className="relative">
          <FiSearch
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-slate-600 bg-[#0b1220] pl-8 pr-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50"
          />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center justify-center h-9 rounded-xl border transition-colors',
                  active
                    ? 'bg-brand border-brand text-white shadow-md shadow-brand/30'
                    : 'bg-[#1e293b] border-slate-600 text-gray-400 hover:text-white hover:border-slate-500',
                )}
              >
                <Icon size={16} />
              </button>
            )
          })}
        </div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">
          {TABS.find((t) => t.id === tab)?.label}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === 'fixtures' && (
          <FixturePalette fillHeight embedded filterQuery={search} />
        )}
        {tab === 'products' && (
          <ProductPalette embedded externalSearch={search} />
        )}
        {tab === 'posm' && (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <PosmPalette search={search} />
          </div>
        )}
        {tab === 'racks' && (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2">
            <ContextAddButton layout="sidebar" hidePosmPanel />
          </div>
        )}
      </div>
    </div>
  )
}
