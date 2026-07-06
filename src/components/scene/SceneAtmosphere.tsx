'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENE_THEMES, type SceneTheme } from '@/constants/sceneTheme'
import { WAREHOUSE_SCALE } from '@/constants/warehouse'

const SHADOW_EXT = 80 * WAREHOUSE_SCALE

export function SceneAtmosphere({ theme }: { theme: SceneTheme }) {
  const scene = useThree((s) => s.scene)
  const cfg = SCENE_THEMES[theme]

  useEffect(() => {
    scene.background = new THREE.Color(cfg.background)
    scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar)
  }, [scene, cfg])

  return null
}

export function SceneLighting({ theme }: { theme: SceneTheme }) {
  const cfg = SCENE_THEMES[theme]
  const isNight = theme === 'night'

  return (
    <>
      <ambientLight intensity={cfg.ambient} />
      <hemisphereLight
        args={[cfg.hemisphereSky, cfg.hemisphereGround, cfg.hemisphereIntensity]}
      />
      <directionalLight
        position={cfg.sunPosition}
        intensity={cfg.sunIntensity}
        color={cfg.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-SHADOW_EXT}
        shadow-camera-right={SHADOW_EXT}
        shadow-camera-top={SHADOW_EXT}
        shadow-camera-bottom={-SHADOW_EXT}
      />
      <directionalLight
        position={[-cfg.sunPosition[0] * 0.4, 12, -cfg.sunPosition[2] * 0.4]}
        intensity={cfg.fillIntensity}
        color={cfg.fillColor}
      />
      {isNight && (
        <>
          <pointLight position={[0, 25, 30]} intensity={2} distance={120} color="#a8c0e8" decay={1} />
          <pointLight position={[0, 15, -20]} intensity={1.2} distance={90} color="#8898b8" decay={1} />
        </>
      )}
    </>
  )
}
