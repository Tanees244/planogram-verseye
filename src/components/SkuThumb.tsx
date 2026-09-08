'use client'

import { useEffect, useState } from 'react'
import { FiPackage } from 'react-icons/fi'
import { resolveProductModelUrl, storageKeyFromSignedUrl, pickImageAttachment, pickModelAttachment, isGlbRef, isRasterImagePath } from '@/utils/productModelUrl'
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

export interface SkuVisual {
  /** Same-origin URL for a regular 2D image, if the SKU has one. */
  imageSrc: string | null
  /** Same-origin URL for a GLB model, if the SKU has one. */
  modelSrc: string | null
}

/** Pick the best image / 3D-model source from a catalog SKU row. */
export function resolveSkuVisual(sku: SkuVisualFields): SkuVisual {
  const attachments = Array.isArray(sku.attachments) ? sku.attachments : []
  const modelAttachment = pickModelAttachment(attachments)
  const imageAttachment = pickImageAttachment(attachments)

  // Some backends put the GLB into imageUrl/imageStorageKey — treat those as models.
  const modelSrc = resolveProductModelUrl({
    modelUrl:
      sku.modelUrl ??
      (isGlbRef(sku.imageUrl) ? sku.imageUrl : null) ??
      modelAttachment?.url ??
      null,
    modelStorageKey:
      (sku.modelStorageKey && !isRasterImagePath(sku.modelStorageKey)
        ? sku.modelStorageKey
        : null) ??
      (isGlbRef(sku.imageStorageKey) ? sku.imageStorageKey : null) ??
      modelAttachment?.storageKey ??
      modelAttachment?.objectKey ??
      null,
  })

  let imageSrc: string | null = null
  const rescuedRasterModel =
    sku.modelStorageKey && isRasterImagePath(sku.modelStorageKey)
      ? sku.modelStorageKey
      : null
  const imageKey =
    (sku.imageStorageKey && !isGlbRef(sku.imageStorageKey) ? sku.imageStorageKey : null) ||
    (imageAttachment?.storageKey && !isGlbRef(imageAttachment.storageKey)
      ? imageAttachment.storageKey
      : null) ||
    (imageAttachment?.objectKey && !isGlbRef(imageAttachment.objectKey)
      ? imageAttachment.objectKey
      : null) ||
    rescuedRasterModel ||
    (sku.imageUrl && !isGlbRef(sku.imageUrl) ? storageKeyFromSignedUrl(sku.imageUrl) : null) ||
    (imageAttachment?.url && !isGlbRef(imageAttachment.url)
      ? storageKeyFromSignedUrl(imageAttachment.url)
      : null)
  if (imageKey) {
    imageSrc = `/api/files/image?key=${encodeURIComponent(imageKey)}`
  } else if (sku.imageUrl && !isGlbRef(sku.imageUrl)) {
    imageSrc = `/api/files/image?url=${encodeURIComponent(sku.imageUrl)}`
  } else if (imageAttachment?.url) {
    imageSrc = `/api/files/image?url=${encodeURIComponent(imageAttachment.url)}`
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
