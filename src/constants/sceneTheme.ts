import { WAREHOUSE_SCALE } from '@/constants/warehouse'

export type SceneTheme = 'day' | 'night'

export interface SceneThemeConfig {
  background: string
  fogColor: string
  fogNear: number
  fogFar: number
  ambient: number
  sunIntensity: number
  sunColor: string
  sunPosition: [number, number, number]
  fillIntensity: number
  fillColor: string
  hemisphereSky: string
  hemisphereGround: string
  hemisphereIntensity: number
  floorColor: string
  floorRoughness: number
  asphaltColor: string
  wallColor: string
  accentColor: string
  roofColor: string
  labelColor: string
  ceilingLightIntensity: number
  streetLightIntensity: number
}

export const SCENE_THEMES: Record<SceneTheme, SceneThemeConfig> = {
  day: {
    background: '#87CEEB',
    fogColor: '#b8d4e8',
    fogNear: 120 * WAREHOUSE_SCALE,
    fogFar: 380 * WAREHOUSE_SCALE,
    ambient: 0.55,
    sunIntensity: 1.8,
    sunColor: '#fff8e7',
    sunPosition: [40, 60, 30],
    fillIntensity: 0.35,
    fillColor: '#e8f4ff',
    hemisphereSky: '#87CEEB',
    hemisphereGround: '#6b8f71',
    hemisphereIntensity: 0.45,
    floorColor: '#e8ecef',
    floorRoughness: 0.35,
    asphaltColor: '#4a4f54',
    wallColor: '#f5f6fa',
    accentColor: '#2C5282',
    roofColor: '#dce1e8',
    labelColor: '#2c3e50',
    ceilingLightIntensity: 0,
    streetLightIntensity: 0,
  },
  night: {
    background: '#1e3050',
    fogColor: '#1e3050',
    fogNear: 110 * WAREHOUSE_SCALE,
    fogFar: 340 * WAREHOUSE_SCALE,
    ambient: 0.58,
    sunIntensity: 0.45,
    sunColor: '#c8d4f0',
    sunPosition: [-30, 40, -20],
    fillIntensity: 0.42,
    fillColor: '#4a5a78',
    hemisphereSky: '#3a4a68',
    hemisphereGround: '#4a5058',
    hemisphereIntensity: 0.52,
    floorColor: '#7a8290',
    floorRoughness: 0.45,
    asphaltColor: '#454a50',
    wallColor: '#6a7280',
    accentColor: '#2C5282',
    roofColor: '#5a6270',
    labelColor: '#e2e8f0',
    ceilingLightIntensity: 5.5,
    streetLightIntensity: 6.5,
  },
}
