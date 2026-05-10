import { Area, Rack, Row, Bin, Product, RackSide } from '@/store/planogramStore'

interface JSONBin {
  bin_id: string
  aisle: string
  products: string[]
  merged?: boolean
}

interface JSONRow {
  row_number: number
  bins: JSONBin[]
  note?: string
}

interface JSONSide {
  side_id: string
  total_rows: number
  rows: JSONRow[]
}

interface JSONRack {
  rack_id: string
  height: string
  sides: JSONSide[]
}

interface JSONAisle {
  aisle_id: string
  pricing_zone: string
  connected_bins: string[]
}

interface JSONLayout {
  racks: JSONRack[]
  aisles: JSONAisle[]
}

interface JSONData {
  locationId: string
  layout: JSONLayout
}


export interface ParseResult {
  area: Area
  renderTime: number
  summary: {
    totalRacks: number
    totalAisles: number
    totalRows: number
    totalBins: number
    totalProducts: number
  }
}

// Logic moved to planogramStore.ts to ensure single source of truth and dynamic handling
