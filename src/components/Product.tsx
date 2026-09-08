'use client'

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, Texture } from 'three'
import { Product as ProductType } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
} from '@/constants/dimensions'
import { safeDim } from '@/utils/safeDimensions'
import { resolveProductFacingId } from '@/utils/storeLayoutLoader'
import { resolveProductModelUrl, isGlbPath } from '@/utils/productModelUrl'
import {
  ensureGlbReady,
  isGlbFailed,
  isGlbReady,
  subscribeGlbReady,
} from '@/utils/glbLoadQueue'
import { ProductGlbModel, preloadProductGlb } from '@/components/ProductGlbModel'
import {
  acquireProductTexture,
  productImageProxyUrl,
} from '@/utils/productTextureCache'

class GlbLoadBoundary extends Component<
  { onError: () => void; children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[Product] GLB load failed, using box fallback', error)
    this.props.onError()
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

interface ProductProps {
  product: ProductType
  position: [number, number, number]
  rowId?: string
  /** Source bin — Alt/Option-click starts move-to-another-bin mode. */
  binId?: string
  /** Force box/texture instead of GLB (LOD for dense bins). */
  forceSimple?: boolean
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
  const faceColor = texture ? '#ffffff' : product.color
  const sideColor = texture ? '#e8e8e8' : product.color
  const emissive = isSelected || hovered ? (texture ? '#ffffff' : product.color) : '#000000'
  const emissiveIntensity = isSelected ? 0.25 : hovered ? 0.35 : 0
  const catalogId = resolveProductFacingId(product.id)

  // Shared SKU textures must not be disposed when one facing remounts (resize
  // remounts Product meshes; R3F would otherwise dispose material.map → magenta).
  // boxGeometry materials: +x -x +y -y +z -z — shopper faces -Z on the shelf.
  const materials = texture
    ? [
        <meshStandardMaterial key="px" color={sideColor} metalness={0.15} roughness={0.7} dispose={null} />,
        <meshStandardMaterial key="nx" color={sideColor} metalness={0.15} roughness={0.7} dispose={null} />,
        <meshStandardMaterial key="py" color={sideColor} metalness={0.15} roughness={0.7} dispose={null} />,
        <meshStandardMaterial key="ny" color={sideColor} metalness={0.15} roughness={0.7} dispose={null} />,
        <meshStandardMaterial key="pz" color={sideColor} metalness={0.15} roughness={0.7} dispose={null} />,
        <meshStandardMaterial
          key="nz"
          map={texture}
          color="#ffffff"
          metalness={0.2}
          roughness={0.55}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          dispose={null}
        />,
      ]
    : (
      <meshStandardMaterial
        color={faceColor}
        metalness={0.2}
        roughness={0.6}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    )

  return (
    <mesh
      userData={{ id: catalogId, type: 'product', facingId: product.id }}
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
      castShadow={false}
      receiveShadow={false}
    >
      <boxGeometry args={[width, height, depth]} />
      {materials}
    </mesh>
  )
}

/** Shared across Product instances — one probe per unique GLB, not per facing. */
function useGlbAvailability(modelUrl: string | null, forceSimple: boolean) {
  const [, tick] = useState(0)

  useEffect(() => {
    if (!modelUrl || forceSimple) return
    if (isGlbReady(modelUrl) || isGlbFailed(modelUrl)) return

    void ensureGlbReady(modelUrl)
    return subscribeGlbReady(modelUrl, () => tick((n) => n + 1))
  }, [modelUrl, forceSimple])

  if (!modelUrl || forceSimple) return { ready: false, failed: false }
  return {
    ready: isGlbReady(modelUrl),
    failed: isGlbFailed(modelUrl),
  }
}

export function Product({ product, position, rowId, binId, forceSimple = false }: ProductProps) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const [texture, setTexture] = useState<Texture | null>(null)
  const [glbFailed, setGlbFailed] = useState(false)
  const { selectedId, setSelected, startMovingBinInventory, movingInventoryFromBinId, moveBinInventoryToBin } =
    usePlanogramStore()
  const catalogId = resolveProductFacingId(product.id)
  const isSelected = selectedId === product.id || selectedId === catalogId

  const width = safeDim(product.width, DEFAULT_PRODUCT_WIDTH)
  const height = safeDim(product.height, DEFAULT_PRODUCT_HEIGHT)
  const depth = safeDim(product.depth, DEFAULT_PRODUCT_DEPTH)
  const resolvedModel = resolveProductModelUrl(product)
  const modelUrl =
    resolvedModel && isGlbPath(resolvedModel) ? resolvedModel : null
  const glbAvailability = useGlbAvailability(modelUrl, forceSimple)
  const useGlb = Boolean(
    modelUrl && !glbFailed && !forceSimple && glbAvailability.ready && !glbAvailability.failed,
  )

  useEffect(() => {
    setGlbFailed(false)
  }, [modelUrl, forceSimple])

  useEffect(() => {
    if (glbAvailability.failed) setGlbFailed(true)
  }, [glbAvailability.failed])

  useEffect(() => {
    if (modelUrl && !forceSimple && glbAvailability.ready) preloadProductGlb(modelUrl)
  }, [modelUrl, forceSimple, glbAvailability.ready])

  useEffect(() => {
    if (useGlb) {
      setTexture(null)
      return
    }
    const proxiedUrl = productImageProxyUrl(
      product.imageUrl,
      product.imageStorageKey,
    )
    if (!proxiedUrl) {
      setTexture(null)
      return
    }
    let active = true
    const release = acquireProductTexture(proxiedUrl, (tex) => {
      if (active) setTexture(tex)
    })
    return () => {
      active = false
      release()
    }
  }, [product.imageUrl, product.imageStorageKey, useGlb])

  useFrame(() => {
    // Selection pulse only — hover scale causes pointer flicker
    if (!useGlb && meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.06 : 1)
    }
  })

  const handleSelect = (e: unknown) => {
    const event = e as {
      stopPropagation?: () => void
      shiftKey?: boolean
      altKey?: boolean
    }
    event.stopPropagation?.()
    if (event.shiftKey && rowId) {
      setSelected(rowId, 'row')
      return
    }
    if (movingInventoryFromBinId && binId) {
      if (movingInventoryFromBinId === binId) {
        usePlanogramStore.getState().cancelMovingBinInventory()
        return
      }
      void (async () => {
        const res = await moveBinInventoryToBin(movingInventoryFromBinId, binId)
        if (!res.success && res.message) {
          usePlanogramStore.setState({ addProductError: res.message })
        }
      })()
      return
    }
    // Alt/Option-click: start move-SKU-to-another-bin (then click target SKU or bin)
    if (event.altKey && binId) {
      startMovingBinInventory(binId)
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
        <GlbLoadBoundary
          onError={() => setGlbFailed(true)}
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
              productId={catalogId}
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
