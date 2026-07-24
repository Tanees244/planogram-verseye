/**
 * User-saved custom fixtures shown in the fixture palette presets.
 */

import type { CustomRackConfig } from '@/components/fixtures/customRackTypes'

const STORAGE_KEY = 'planogram.customFixturePresets'

export type CustomFixturePreset = {
  id: string
  name: string
  config: CustomRackConfig
  createdAt: number
}

function readAll(): CustomFixturePreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const arr = raw ? (JSON.parse(raw) as CustomFixturePreset[]) : []
    if (!Array.isArray(arr)) return []
    return arr.filter((p) => p && typeof p.name === 'string' && p.config)
  } catch {
    return []
  }
}

function writeAll(list: CustomFixturePreset[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 24)))
  } catch {
    /* ignore */
  }
}

export function listCustomFixturePresets(): CustomFixturePreset[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt)
}

export function saveCustomFixturePreset(name: string, config: CustomRackConfig): CustomFixturePreset {
  const cleaned = name.trim()
  const list = readAll().filter((p) => p.name.toLowerCase() !== cleaned.toLowerCase())
  const entry: CustomFixturePreset = {
    id: `custom-preset-${Date.now()}`,
    name: cleaned,
    config: JSON.parse(JSON.stringify(config)) as CustomRackConfig,
    createdAt: Date.now(),
  }
  writeAll([entry, ...list])
  return entry
}

export function removeCustomFixturePreset(id: string) {
  writeAll(readAll().filter((p) => p.id !== id))
}
