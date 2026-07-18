'use client'

import { useEffect, useState } from 'react'
import { FiPackage } from 'react-icons/fi'
import { resolveProductModelUrl } from '@/utils/productModelUrl'
import { getGlbThumbnail } from '@/utils/glbThumbnail'
import { cn } from '@/lib/cn'

export interface SkuVisualFields {
  imageUrl?: string | null
  imageStorageKey?: string | null
  modelUrl?: string | null
  modelStorageKey?: string | null
  attachments?: Array<{
    storageKey?: string | null
    objectKey?: string | null
    url?: string | null
    is3D?: boolean | null
  }> | null
}

function isGlbRef(value?: string | null): boolean {
  if (!value) return false
  return value.split('?')[0].toLowerCase().endsWith('.glb')
}

export interface SkuVisual {
  /** Same-origin URL for a regular 2D image, if the SKU has one. */
  imageSrc: string | null
  /** Same-origin URL for a GLB model, if the SKU has one. */
  modelSrc: string | null
}

/** Pick the best image / 3D-model source from a catalog SKU row. */
export function resolveSkuVisual(sku: SkuVisualFields): SkuVisual {
  const attachments = Array.isArray(sku.attachments) ? sku.attachments : []
  const modelAttachment = attachments.find(
    (a) =>
      a &&
      (a.is3D === true || isGlbRef(a.storageKey ?? a.objectKey) || isGlbRef(a.url)),
  )
  const imageAttachment = attachments.find(
    (a) =>
      a &&
      a.is3D !== true &&
      (a.storageKey || a.objectKey || a.url) &&
      !isGlbRef(a.storageKey ?? a.objectKey) &&
      !isGlbRef(a.url),
  )

  // Some backends put the GLB into imageUrl/imageStorageKey — treat those as models.
  const modelSrc = resolveProductModelUrl({
    modelUrl:
      sku.modelUrl ??
      (isGlbRef(sku.imageUrl) ? sku.imageUrl : null) ??
      modelAttachment?.url ??
      null,
    modelStorageKey:
      sku.modelStorageKey ??
      (isGlbRef(sku.imageStorageKey) ? sku.imageStorageKey : null) ??
      modelAttachment?.storageKey ??
      modelAttachment?.objectKey ??
      null,
  })

  let imageSrc: string | null = null
  if (sku.imageUrl && !isGlbRef(sku.imageUrl)) {
    imageSrc = `/api/files/image?url=${encodeURIComponent(sku.imageUrl)}`
  } else if (sku.imageStorageKey && !isGlbRef(sku.imageStorageKey)) {
    imageSrc = `/api/files/image?key=${encodeURIComponent(sku.imageStorageKey)}`
  } else if (imageAttachment?.url) {
    imageSrc = `/api/files/image?url=${encodeURIComponent(imageAttachment.url)}`
  } else if (imageAttachment?.storageKey || imageAttachment?.objectKey) {
    imageSrc = `/api/files/image?key=${encodeURIComponent(
      (imageAttachment.storageKey ?? imageAttachment.objectKey)!,
    )}`
  }

  return { imageSrc, modelSrc }
}

/**
 * SKU list thumbnail: real image when available, otherwise a rendered
 * snapshot of the 3D model, otherwise a placeholder icon.
 */
export function SkuThumb({
  sku,
  className,
  iconClassName,
  size = 16,
}: {
  sku: SkuVisualFields
  className?: string
  iconClassName?: string
  size?: number
}) {
  const { imageSrc, modelSrc } = resolveSkuVisual(sku)
  const [modelThumb, setModelThumb] = useState<string | null>(null)
  const [modelFailed, setModelFailed] = useState(false)

  useEffect(() => {
    setModelThumb(null)
    setModelFailed(false)
    if (imageSrc || !modelSrc) return
    let active = true
    getGlbThumbnail(modelSrc).then((dataUrl) => {
      if (!active) return
      if (dataUrl) setModelThumb(dataUrl)
      else setModelFailed(true)
    })
    return () => {
      active = false
    }
  }, [imageSrc, modelSrc])

  const src = imageSrc ?? modelThumb

  if (src) {
    return (
      <div className={cn('relative shrink-0 overflow-hidden', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
        {!imageSrc && (
          <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl bg-black/55 px-[3px] text-[7px] font-bold leading-[10px] text-white">
            3D
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center',
        !modelFailed && modelSrc && 'animate-pulse',
        className,
        iconClassName,
      )}
    >
      <FiPackage size={size} />
    </div>
  )
}
