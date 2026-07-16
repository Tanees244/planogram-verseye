'use client'

import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei'
import { fitObjectToBox } from '@/utils/fitGlbToBox'

class PreviewErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function PreviewMesh({
  url,
  width,
  height,
  depth,
}: {
  url: string
  width: number
  height: number
  depth: number
}) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    fitObjectToBox(clone, width, height, depth)
    return clone
  }, [scene, width, height, depth])

  return (
    <Center>
      <primitive object={model} />
    </Center>
  )
}

/** Small orbitable GLB preview for Create SKU. */
export function SkuModelPreview({
  url,
  width,
  height,
  depth,
  className,
}: {
  url: string
  width: number
  height: number
  depth: number
  className?: string
}) {
  useEffect(() => {
    try {
      useGLTF.preload(url)
    } catch {
      /* ignore */
    }
  }, [url])

  const w = Math.max(0.01, width)
  const h = Math.max(0.01, height)
  const d = Math.max(0.01, depth)

  const fallback = (
    <div className="flex h-full items-center justify-center text-xs text-gray-500">
      Preview unavailable
    </div>
  )

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-slate-100 to-slate-200 ${className ?? ''}`}
    >
      <PreviewErrorBoundary fallback={fallback}>
        <Canvas
          camera={{ position: [0.35, 0.28, 0.45], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000000', 0)
          }}
        >
          <ambientLight intensity={0.85} />
          <directionalLight position={[2, 3, 2]} intensity={1.1} />
          <directionalLight position={[-2, 1, -1]} intensity={0.35} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.35}>
              <PreviewMesh url={url} width={w} height={h} depth={d} />
            </Bounds>
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={0.15}
            maxDistance={2.5}
            autoRotate
            autoRotateSpeed={1.2}
          />
        </Canvas>
      </PreviewErrorBoundary>
      <p className="pointer-events-none absolute bottom-1.5 left-2 rounded bg-white/70 px-1.5 py-0.5 text-[9px] text-gray-500">
        Drag to rotate
      </p>
    </div>
  )
}
