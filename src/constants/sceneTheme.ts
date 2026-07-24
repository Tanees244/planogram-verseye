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
    background: '#a8d4f0',
    fogColor: '#c5dff0',
    fogNear: 140 * WAREHOUSE_SCALE,
    fogFar: 420 * WAREHOUSE_SCALE,
    ambient: 0.62,
    sunIntensity: 1.55,
    sunColor: '#fff6e8',
    sunPosition: [35, 55, 28],
    fillIntensity: 0.42,
    fillColor: '#eef6ff',
    hemisphereSky: '#9ec9e8',
    hemisphereGround: '#7a9a72',
    hemisphereIntensity: 0.5,
    floorColor: '#f0f3f6',
    floorRoughness: 0.42,
    asphaltColor: '#52575c',
    wallColor: '#f7f8fb',
    accentColor: '#2C5282',
    roofColor: '#e2e7ee',
    labelColor: '#1e293b',
    ceilingLightIntensity: 0.15,
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
