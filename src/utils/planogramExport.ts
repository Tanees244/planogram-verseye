'use client'

import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  downloadTextFile,
  exportPlanogramContent,
  extensionForFormat,
  sanitizeFilename,
  type PlanogramFileFormat,
} from '@/lib/planogram-formats'
import toast from 'react-hot-toast'

export function exportRacksAs(
  racks: Rack[],
  format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>,
  options?: {
    planogramName?: string
    storeId?: string | null
    storeName?: string | null
  },
) {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }

  const content = exportPlanogramContent(racks, format, options)
  const ext = extensionForFormat(format)
  const baseName =
    racks.length === 1
      ? racks[0].blueprintName ?? racks[0].rackCode ?? 'rack'
      : options?.planogramName ?? options?.storeName ?? 'store-planogram'

  downloadTextFile(
    content,
    sanitizeFilename(baseName, ext),
    format === 'plm' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
  )
  toast.success(`Exported ${format.toUpperCase()} file`)
}

export function usePlanogramExport() {
  const area = usePlanogramStore((s) => s.area)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)

  return {
    exportStore(format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>) {
      exportRacksAs(area.racks, format, {
        planogramName: selectedStoreName ?? 'Store planogram',
        storeId: selectedStoreId,
        storeName: selectedStoreName,
      })
    },
    exportRack(
      rack: Rack,
      format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>,
    ) {
      exportRacksAs([rack], format, {
        planogramName: rack.blueprintName ?? rack.rackCode,
        storeId: selectedStoreId,
        storeName: selectedStoreName,
      })
    },
  }
}
