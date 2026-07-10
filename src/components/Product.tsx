'use client'

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, Texture } from 'three'
import { SRGBColorSpace, TextureLoader } from 'three'
import { Product as ProductType } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
} from '@/constants/dimensions'
import { safeDim } from '@/utils/safeDimensions'
import { resolveProductFacingId } from '@/utils/storeLayoutLoader'
import { resolveProductModelUrl } from '@/utils/productModelUrl'
import { ProductGlbModel, preloadProductGlb } from '@/components/ProductGlbModel'

class GlbLoadBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

interface ProductProps {
  product: ProductType
  position: [number, number, number]
  rowId?: string
}

function ProductBoxFallback({
  product,
  width,
  height,
  depth,
  meshRef,
  texture,
  isSelected,
  hovered,
  onSelect,
  setHovered,
}: {
  product: ProductType
  width: number
  height: number
  depth: number
  meshRef: React.RefObject<Mesh | null>
  texture: Texture | null
  isSelected: boolean
  hovered: boolean
  onSelect: (e: { stopPropagation: () => void; shiftKey?: boolean }) => void
  setHovered: (v: boolean) => void
}) {
  return (
    <mesh
      userData={{ id: product.id, type: 'product' }}
      ref={meshRef}
      onClick={onSelect}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        key={texture ? 'with-texture' : 'no-texture'}
        map={texture ?? undefined}
        color={texture ? '#ffffff' : product.color}
        metalness={0.2}
        roughness={0.6}
        emissive={isSelected || hovered ? (texture ? '#ffffff' : product.color) : '#000000'}
        emissiveIntensity={isSelected ? 0.25 : hovered ? 0.35 : 0}
      />
    </mesh>
  )
}

export function Product({ product, position, rowId }: ProductProps) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const [texture, setTexture] = useState<Texture | null>(null)
  const [glbFailed, setGlbFailed] = useState(false)
  const { selectedId, setSelected } = usePlanogramStore()
  const catalogId = resolveProductFacingId(product.id)
  const isSelected = selectedId === product.id || selectedId === catalogId

  const width = safeDim(product.width, DEFAULT_PRODUCT_WIDTH)
  const height = safeDim(product.height, DEFAULT_PRODUCT_HEIGHT)
  const depth = safeDim(product.depth, DEFAULT_PRODUCT_DEPTH)
  const modelUrl = resolveProductModelUrl(product)
  const useGlb = Boolean(modelUrl && !glbFailed)

  useEffect(() => {
    if (modelUrl) preloadProductGlb(modelUrl)
  }, [modelUrl])

  useEffect(() => {
    setGlbFailed(false)
  }, [modelUrl])

  useEffect(() => {
    if (useGlb) {
      setTexture(null)
      return
    }
    const url = product.imageUrl
    if (!url) {
      setTexture(null)
      return
    }
    let active = true
    const proxiedUrl = `/api/files/image?url=${encodeURIComponent(url)}`
    const loader = new TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      proxiedUrl,
      (tex) => {
        if (!active) {
          tex.dispose()
          return
        }
        tex.colorSpace = SRGBColorSpace
        setTexture(tex)
      },
      undefined,
      () => {
        if (active) setTexture(null)
      },
    )
    return () => {
      active = false
    }
  }, [product.imageUrl, useGlb])

  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])

  useFrame(() => {
    if (!useGlb && meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.1 : hovered ? 1.05 : 1)
    }
  })

  const handleSelect = (e: unknown) => {
    const event = e as { stopPropagation?: () => void; shiftKey?: boolean }
    event.stopPropagation?.()
    if (event.shiftKey && rowId) {
      setSelected(rowId, 'row')
      return
    }
    setSelected(catalogId, 'product')
  }

  const interaction = {
    onSelect: handleSelect,
    onPointerOver: (e: unknown) => {
      ;(e as { stopPropagation?: () => void }).stopPropagation?.()
      setHovered(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHovered(false)
      document.body.style.cursor = 'default'
    },
  }

  return (
    <group position={position}>
      {useGlb && modelUrl ? (
        <GlbLoadBoundary onError={() => setGlbFailed(true)}>
          <Suspense
            fallback={
              <ProductBoxFallback
                product={product}
                width={width}
                height={height}
                depth={depth}
                meshRef={meshRef}
                texture={texture}
                isSelected={isSelected}
                hovered={hovered}
                onSelect={handleSelect}
                setHovered={setHovered}
              />
            }
          >
            <ProductGlbModel
              url={modelUrl}
              width={width}
              height={height}
              depth={depth}
              productId={product.id}
              isSelected={isSelected}
              hovered={hovered}
              onSelect={handleSelect}
              onPointerOver={interaction.onPointerOver}
              onPointerOut={interaction.onPointerOut}
            />
          </Suspense>
        </GlbLoadBoundary>
      ) : (
        <ProductBoxFallback
          product={product}
          width={width}
          height={height}
          depth={depth}
          meshRef={meshRef}
          texture={texture}
          isSelected={isSelected}
          hovered={hovered}
          onSelect={handleSelect}
          setHovered={setHovered}
        />
      )}
    </group>
  )
}
