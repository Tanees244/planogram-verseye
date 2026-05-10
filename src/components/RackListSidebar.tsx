"use client"

import React from 'react'
import { usePlanogramStore } from '@/store/planogramStore'

export default function RackListSidebar() {
  const { area, setSelected } = usePlanogramStore();

  return (
    <div>
      <div className="mb-4">
        {/* <h3 className="text-lg font-semibold text-gray-800">Racks</h3> */}
        {/* <div className="text-sm text-gray-600">{area.racks.length} in area</div> */}
      </div>
    </div>
  )
}
