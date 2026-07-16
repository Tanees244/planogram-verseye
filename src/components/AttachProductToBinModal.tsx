'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiSearch, FiPlus, FiImage, FiX, FiBox } from 'react-icons/fi'
import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Product } from '../types/product-management'
import { Spinner } from './Spinner'
import { SkuModelPreview } from '@/components/SkuModelPreview'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { safeDim } from '@/utils/safeDimensions'
import { uploadCatalogFile, buildSkuAttachments } from '@/utils/catalogUpload'
import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
  DEMO_PRODUCT_MODELS,
} from '@/constants/dimensions'
import {
  fetchBinInventory,
  facingCapacityMessage,
  maxFacingsForShelf,
  remainingBinFacings,
  type BinInventoryData,
} from '@/utils/binInventoryApi'
import { FacingShelfPreview } from '@/components/FacingShelfPreview'
import { usePlanogramStore } from '@/store/planogramStore'

interface AttachProductToBinModalProps {
  isOpen: boolean
  onClose: () => void
  binId: string
  onSuccess: (product: Product, quantity: number) => void
  inventoryRefreshKey?: number
  logPayload?: boolean
}

interface CatalogSku {
  id: string
  name: string
  code?: string | null
  categoryId?: string | null
  categoryName?: string | null
  brandId?: string | null
  brandName?: string | null
  width?: number | null
  height?: number | null
  depth?: number | null
  imageUrl?: string | null
  modelUrl?: string | null
  modelStorageKey?: string | null
  status?: string
}

interface CategoryOption {
  id: string
  name: string
}

type Mode = 'browse' | 'create'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

function skuToProduct(sku: CatalogSku): Product {
  return {
    id: sku.id,
    name: sku.name,
    categoryId: sku.categoryId ?? '',
    categoryName: sku.categoryName ?? undefined,
    brandId: sku.brandId ?? '',
    brandName: sku.brandName ?? undefined,
    price: 0,
    height: safeDim(sku.height, DEFAULT_PRODUCT_HEIGHT),
    width: safeDim(sku.width, DEFAULT_PRODUCT_WIDTH),
    depth: safeDim(sku.depth, DEFAULT_PRODUCT_DEPTH),
    length: safeDim(sku.depth, DEFAULT_PRODUCT_DEPTH),
    color: '#2C5282',
    description: sku.code ?? '',
    status: 'Active',
    createdDate: new Date().toISOString(),
    imageUrl: sku.imageUrl ?? undefined,
    modelUrl: sku.modelUrl ?? undefined,
    modelStorageKey: sku.modelStorageKey ?? undefined,
    code: sku.code ?? undefined,
  }
}

export default function AttachProductToBinModal({
  isOpen,
  onClose,
  binId,
  onSuccess,
  inventoryRefreshKey = 0,
}: AttachProductToBinModalProps) {
  const [mode, setMode] = useState<Mode>('browse')
  const [submitting, setSubmitting] = useState(false)
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [inventory, setInventory] = useState<BinInventoryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [skus, setSkus] = useState<CatalogSku[]>([])
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)
  const [quantityInput, setQuantityInput] = useState('1')
  const [categories, setCategories] = useState<CategoryOption[]>([])

  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    categoryId: '',
    width: String(DEFAULT_PRODUCT_WIDTH),
    depth: String(DEFAULT_PRODUCT_DEPTH),
    height: String(DEFAULT_PRODUCT_HEIGHT),
  })
  const [overrideDims, setOverrideDims] = useState({
    width: String(DEFAULT_PRODUCT_WIDTH),
    depth: String(DEFAULT_PRODUCT_DEPTH),
    height: String(DEFAULT_PRODUCT_HEIGHT),
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [localModelUrl, setLocalModelUrl] = useState<string | null>(null)
  const [modelObjectUrl, setModelObjectUrl] = useState<string | null>(null)
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null)
  const [uploadingModel, setUploadingModel] = useState(false)
  const setAttachFacingPreview = usePlanogramStore((s) => s.setAttachFacingPreview)

  const previewModelUrl = useMemo(
    () => localModelUrl ?? modelObjectUrl,
    [localModelUrl, modelObjectUrl],
  )

  const previewWidth = parseFloat(createForm.width) || DEFAULT_PRODUCT_WIDTH
  const previewDepth = parseFloat(createForm.depth) || DEFAULT_PRODUCT_DEPTH
  const previewHeight = parseFloat(createForm.height) || DEFAULT_PRODUCT_HEIGHT

  const loadInventory = useCallback(async () => {
    if (!binId) return
    setLoadingInventory(true)
    const res = await fetchBinInventory(binId)
    setLoadingInventory(false)
    if (res.success) setInventory(res.data ?? null)
  }, [binId])

  const fetchSkus = useCallback(async (term: string) => {
    setLoadingSkus(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page: '1', pageSize: '50' })
      if (term.trim()) qs.set('search', term.trim())
      const res = await fetch(`/api/products/list?${qs}`, { headers: authHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false) {
        setError(json?.message || 'Failed to load catalog SKUs')
        setSkus([])
        return
      }
      const list = json?.data?.products ?? json?.data ?? []
      setSkus(
        (Array.isArray(list) ? list : []).map((s: any) => ({
          id: s.id ?? s.skuId,
          name: s.name ?? s.skuName ?? 'SKU',
          code: s.code ?? null,
          categoryId: s.categoryId ?? null,
          categoryName: s.categoryName ?? null,
          brandId: s.brandId ?? null,
          brandName: s.brandName ?? null,
          width: s.width ?? null,
          height: s.height ?? null,
          depth: s.depth ?? null,
          imageUrl: s.imageUrl ?? null,
          modelUrl: s.modelUrl ?? s.glbUrl ?? s.model3dUrl ?? null,
          modelStorageKey: s.modelStorageKey ?? s.glbStorageKey ?? null,
          status: s.status,
        })),
      )
    } catch {
      setError('Could not connect to catalog API')
      setSkus([])
    } finally {
      setLoadingSkus(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true)
    try {
      const res = await fetch('/api/categories/list', { headers: authHeaders() })
      const json = await res.json().catch(() => ({}))
      const list = json?.data?.categories ?? json?.data ?? []
      setCategories(
        (Array.isArray(list) ? list : []).map((c: any) => ({
          id: c.id,
          name: c.name ?? c.categoryName ?? c.id,
        })),
      )
    } catch {
      /* non-fatal */
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setMode('browse')
    setError(null)
    setSelectedSkuId(null)
    setQuantityInput('1')
    setSearch('')
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setModelFile(null)
    setLocalModelUrl(null)
    setSelectedDemoId(null)
    setModelObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    void fetchCategories()
    void loadInventory()
  }, [isOpen, fetchCategories, loadInventory, inventoryRefreshKey])

  useEffect(() => {
    if (!isOpen || mode !== 'browse') return
    const t = setTimeout(() => {
      void fetchSkus(search)
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search, isOpen, mode, fetchSkus])

  const selectedSku = skus.find((s) => s.id === selectedSkuId) ?? null
  const selectedNeedsDims = Boolean(
    selectedSku &&
      (selectedSku.width == null ||
        selectedSku.height == null ||
        selectedSku.depth == null ||
        Number(selectedSku.width) <= 0 ||
        Number(selectedSku.height) <= 0 ||
        Number(selectedSku.depth) <= 0),
  )

  useEffect(() => {
    if (!selectedSku) return
    setOverrideDims({
      width: String(safeDim(selectedSku.width, DEFAULT_PRODUCT_WIDTH)),
      depth: String(safeDim(selectedSku.depth, DEFAULT_PRODUCT_DEPTH)),
      height: String(safeDim(selectedSku.height, DEFAULT_PRODUCT_HEIGHT)),
    })
  }, [selectedSkuId, selectedSku])

  const parsedQuantity = Math.floor(Number(quantityInput))
  const quantityOk = Number.isFinite(parsedQuantity) && parsedQuantity >= 1

  const facingWidthM = selectedSku
    ? parseFloat(overrideDims.width) || safeDim(selectedSku.width, DEFAULT_PRODUCT_WIDTH)
    : mode === 'create'
      ? parseFloat(createForm.width) || DEFAULT_PRODUCT_WIDTH
      : 0

  const facingHeightM = selectedSku
    ? parseFloat(overrideDims.height) || safeDim(selectedSku.height, DEFAULT_PRODUCT_HEIGHT)
    : mode === 'create'
      ? parseFloat(createForm.height) || DEFAULT_PRODUCT_HEIGHT
      : 0

  const facingDepthM = selectedSku
    ? parseFloat(overrideDims.depth) || safeDim(selectedSku.depth, DEFAULT_PRODUCT_DEPTH)
    : mode === 'create'
      ? parseFloat(createForm.depth) || DEFAULT_PRODUCT_DEPTH
      : 0

  const binWidthM = inventory?.width ?? 0
  const apiRemaining = remainingBinFacings(inventory)
  const shelfMaxTotal =
    binWidthM > 0 && facingWidthM > 0 ? maxFacingsForShelf(binWidthM, facingWidthM) : null
  const usedFacings = inventory?.sku?.quantity ?? 0
  const shelfRemaining =
    shelfMaxTotal != null ? Math.max(0, shelfMaxTotal - usedFacings) : null
  const maxAttachQty =
    apiRemaining != null
      ? apiRemaining
      : shelfRemaining != null && shelfRemaining > 0
        ? shelfRemaining
        : undefined

  const capacityError =
    quantityOk && binWidthM > 0 && facingWidthM > 0
      ? facingCapacityMessage(binWidthM, facingWidthM, parsedQuantity, usedFacings)
      : null

  // Push live facing ghosts to the selected bin in the 3D scene
  useEffect(() => {
    if (!isOpen || !binId || !(facingWidthM > 0 && facingHeightM > 0 && facingDepthM > 0)) {
      setAttachFacingPreview(null)
      return
    }
    const qty = quantityOk ? parsedQuantity : 0
    if (qty < 1) {
      setAttachFacingPreview(null)
      return
    }
    const fits = !capacityError && (maxAttachQty == null || qty <= maxAttachQty)
    setAttachFacingPreview({
      binId,
      width: facingWidthM,
      height: facingHeightM,
      depth: facingDepthM,
      quantity: qty,
      fits,
      modelUrl:
        mode === 'create'
          ? previewModelUrl
          : (selectedSku?.modelUrl ?? null),
      modelStorageKey: mode === 'create' ? null : (selectedSku?.modelStorageKey ?? null),
      color: fits ? '#2C5282' : '#ef4444',
    })
    return () => setAttachFacingPreview(null)
  }, [
    isOpen,
    binId,
    facingWidthM,
    facingHeightM,
    facingDepthM,
    parsedQuantity,
    quantityOk,
    capacityError,
    maxAttachQty,
    mode,
    previewModelUrl,
    selectedSku?.modelUrl,
    selectedSku?.modelStorageKey,
    setAttachFacingPreview,
  ])

  const validateAttachQuantity = (skuId: string): string | null => {
    if (!quantityOk) return 'Quantity (facings) must be at least 1'
    if (inventory?.sku && inventory.sku.skuId !== skuId) {
      return `Bin already contains "${inventory.sku.skuName}". Detach it before attaching a different SKU.`
    }
    if (apiRemaining != null && parsedQuantity > apiRemaining) {
      return `Only ${apiRemaining} more facing${apiRemaining === 1 ? '' : 's'} fit in this bin.`
    }
    if (capacityError) return capacityError
    return null
  }

  const handleAttachExisting = async () => {
    if (!selectedSku || !quantityOk) {
      if (!quantityOk) setError('Quantity (facings) must be at least 1')
      return
    }
    const qtyError = validateAttachQuantity(selectedSku.id)
    if (qtyError) {
      setError(qtyError)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const w = parseFloat(overrideDims.width)
      const d = parseFloat(overrideDims.depth)
      const h = parseFloat(overrideDims.height)
      if (!(w > 0 && d > 0 && h > 0)) {
        setError('Width, depth, and height must be greater than 0')
        return
      }

      // Persist dims onto catalog SKU when missing (required before attach)
      if (selectedNeedsDims) {
        const headers = { ...authHeaders(), 'Content-Type': 'application/json' }
        const patchRes = await fetch(`/api/products/${encodeURIComponent(selectedSku.id)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ width: w, height: h, depth: d }),
        })
        const patchJson = await patchRes.json().catch(() => ({}))
        if (!patchRes.ok || patchJson?.isRequestSuccess === false) {
          setError(
            patchJson?.message ||
              'Could not set SKU dimensions. Catalog may require an update endpoint.',
          )
          return
        }
      }

      const product = skuToProduct({
        ...selectedSku,
        width: w,
        height: h,
        depth: d,
      })
      onSuccess(product, parsedQuantity)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const clearImage = () => {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
  }

  const clearModel = () => {
    const demoId = selectedDemoId
    setModelFile(null)
    setLocalModelUrl(null)
    setSelectedDemoId(null)
    if (modelObjectUrl) {
      URL.revokeObjectURL(modelObjectUrl)
      setModelObjectUrl(null)
    }
    setCreateForm((prev) => {
      const demo = demoId
        ? DEMO_PRODUCT_MODELS.find((d) => d.id === demoId)
        : null
      return {
        ...prev,
        width: String(DEFAULT_PRODUCT_WIDTH),
        depth: String(DEFAULT_PRODUCT_DEPTH),
        height: String(DEFAULT_PRODUCT_HEIGHT),
        // Clear autofilled demo name/code when they still match the selected demo
        name:
          demo?.suggestedName && prev.name.trim() === demo.suggestedName ? '' : prev.name,
        code:
          demo?.suggestedCode && prev.code.trim() === demo.suggestedCode ? '' : prev.code,
      }
    })
  }

  const handleCreateAndAttach = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!createForm.name.trim() || !createForm.code.trim() || !createForm.categoryId) {
      setError('Name, code, and category are required')
      return
    }
    const w = parseFloat(createForm.width)
    const d = parseFloat(createForm.depth)
    const h = parseFloat(createForm.height)
    if (!(w > 0 && d > 0 && h > 0)) {
      setError('Width, depth, and height must be greater than 0')
      return
    }
    if (inventory?.sku) {
      setError(
        `Bin already contains "${inventory.sku.skuName}". Detach it before creating a new SKU here.`,
      )
      return
    }
    if (!quantityOk) {
      setError('Quantity (facings) must be at least 1')
      return
    }
    if (shelfRemaining != null && shelfRemaining === 0) {
      setError('This bin has no remaining facing capacity.')
      return
    }
    const createFacingW = parseFloat(createForm.width) || DEFAULT_PRODUCT_WIDTH
    const createCapError = facingCapacityMessage(binWidthM, createFacingW, parsedQuantity, usedFacings)
    if (createCapError) {
      setError(createCapError)
      return
    }
    if (apiRemaining != null && parsedQuantity > apiRemaining) {
      setError(`Only ${apiRemaining} more facing${apiRemaining === 1 ? '' : 's'} fit in this bin.`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      let imageStorageKey: string | null = null
      let uploadedImageUrl: string | undefined
      let modelStorageKey: string | null = null
      if (imageFile) {
        setUploadingImage(true)
        const up = await uploadCatalogFile(imageFile, 'skus')
        setUploadingImage(false)
        if (!up.success || !up.storageKey) {
          setError(up.message || 'Image upload failed')
          return
        }
        imageStorageKey = up.storageKey
        uploadedImageUrl = up.imageUrl
      }

      let modelFileToUpload = modelFile
      if (!modelFileToUpload && localModelUrl?.startsWith('/')) {
        try {
          const demoRes = await fetch(localModelUrl)
          if (demoRes.ok) {
            const blob = await demoRes.blob()
            const name = localModelUrl.split('/').pop() ?? 'model.glb'
            modelFileToUpload = new File([blob], name, { type: 'model/gltf-binary' })
          }
        } catch {
          /* demo model stays local-only */
        }
      }

      if (modelFileToUpload) {
        setUploadingModel(true)
        const up = await uploadCatalogFile(modelFileToUpload, 'skus/models')
        setUploadingModel(false)
        if (!up.success || !up.storageKey) {
          setError(up.message || '3D model upload failed')
          return
        }
        modelStorageKey = up.storageKey
      }

      const attachments = buildSkuAttachments(imageStorageKey, modelStorageKey)

      const headers = { ...authHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/products/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: createForm.name.trim(),
          code: createForm.code.trim(),
          categoryId: createForm.categoryId,
          width: w,
          height: h,
          depth: d,
          imageStorageKey,
          modelStorageKey,
          attachments,
          status: 'active',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false) {
        setError(json?.message || 'Failed to create SKU')
        return
      }

      const created = json?.data ?? {}
      const skuId = created.id ?? created.skuId
      if (!skuId || typeof skuId !== 'string') {
        setError('SKU created but no id was returned')
        return
      }

      const product = skuToProduct({
        id: skuId,
        name: created.name ?? createForm.name.trim(),
        code: created.code ?? createForm.code.trim(),
        categoryId: created.categoryId ?? createForm.categoryId,
        categoryName: created.categoryName ?? null,
        brandId: created.brandId ?? null,
        brandName: created.brandName ?? null,
        width: created.width ?? w,
        height: created.height ?? h,
        depth: created.depth ?? d,
        imageUrl: created.imageUrl ?? uploadedImageUrl ?? null,
        modelUrl: created.modelUrl ?? localModelUrl ?? null,
        modelStorageKey: created.modelStorageKey ?? modelStorageKey ?? null,
      })

      onSuccess(product, parsedQuantity)
      setCreateForm({
        name: '',
        code: '',
        categoryId: '',
        width: String(DEFAULT_PRODUCT_WIDTH),
        depth: String(DEFAULT_PRODUCT_DEPTH),
        height: String(DEFAULT_PRODUCT_HEIGHT),
      })
      clearImage()
      clearModel()
      onClose()
    } catch {
      setError('Network error while creating SKU')
    } finally {
      setUploadingImage(false)
      setUploadingModel(false)
      setSubmitting(false)
    }
  }

  const canSubmit =
    mode === 'browse'
      ? Boolean(selectedSkuId) && quantityOk && !submitting
      : Boolean(createForm.name.trim() && createForm.code.trim() && createForm.categoryId) &&
        quantityOk &&
        !submitting

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Attach Product"
      subtitle="Select a catalog SKU or create a new one, then attach to this bin."
      maxWidth="lg"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            disabled={!canSubmit || uploadingImage || uploadingModel}
            onClick={() => (mode === 'browse' ? handleAttachExisting() : handleCreateAndAttach())}
          >
            {(submitting || uploadingImage || uploadingModel) && <Spinner />}
            {uploadingImage
              ? 'Uploading image…'
              : uploadingModel
                ? 'Uploading 3D model…'
                : submitting
                  ? 'Attaching…'
                  : mode === 'browse'
                    ? 'Attach SKU'
                    : 'Create & Attach'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('browse')
              setError(null)
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'browse'
                ? 'bg-white text-[#2C5282] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiSearch size={14} /> Browse catalog
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('create')
              setError(null)
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'create'
                ? 'bg-white text-[#2C5282] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiPlus size={14} /> Create SKU
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[#2C5282]/20 bg-[#2C5282]/5 px-3 py-2.5 text-sm">
          <p className="font-semibold text-[#2C5282]">Bin capacity</p>
          {loadingInventory ? (
            <p className="text-xs text-gray-600 mt-1 flex items-center gap-2">
              <Spinner /> Loading inventory…
            </p>
          ) : inventory?.sku ? (
            <p className="text-xs text-gray-700 mt-1 leading-snug">
              <span className="font-medium">{inventory.sku.skuName}</span> —{' '}
              {inventory.sku.quantity} / {inventory.sku.maxQuantity} facings used
              {apiRemaining != null ? ` · ${apiRemaining} available to add` : ''}
            </p>
          ) : inventory ? (
            <p className="text-xs text-gray-700 mt-1 leading-snug">
              Bin is empty · shelf {(inventory.width * 100).toFixed(0)}×
              {(inventory.depth * 100).toFixed(0)}×{(inventory.height * 100).toFixed(0)} cm
              {facingWidthM > 0 && shelfMaxTotal != null ? (
                <>
                  {' '}
                  · <span className="font-medium">{(facingWidthM * 100).toFixed(0)} cm</span> facing → max{' '}
                  <span className="font-medium">{shelfMaxTotal}</span> facings
                </>
              ) : (
                '. Select a SKU to see how many facings fit.'
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-600 mt-1 leading-snug">Loading bin dimensions…</p>
          )}
        </div>

        {capacityError && (
          <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs leading-snug">
            {capacityError}
          </div>
        )}

        <FormField
          label="Quantity (facings)"
          required
          hint={
            maxAttachQty != null
              ? `Up to ${maxAttachQty} facing${maxAttachQty === 1 ? '' : 's'} can fit on this shelf`
              : facingWidthM > 0
                ? 'Select a SKU with dimensions to calculate capacity'
                : 'Number of product facings to place in this bin'
          }
          error={capacityError ?? undefined}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxAttachQty}
            step={1}
            required
            value={quantityInput}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) {
                setQuantityInput(next)
                setError(null)
              }
            }}
            onBlur={() => {
              if (!quantityOk) {
                setQuantityInput('1')
                return
              }
              if (maxAttachQty != null && parsedQuantity > maxAttachQty) {
                setQuantityInput(String(maxAttachQty))
              }
            }}
          />
        </FormField>

        {inventory && inventory.width > 0 && facingWidthM > 0 && facingHeightM > 0 && (
          <FacingShelfPreview
            binWidthM={inventory.width}
            binHeightM={Math.max(inventory.height, 0.1)}
            facingWidthM={facingWidthM}
            facingHeightM={facingHeightM}
            quantity={quantityOk ? parsedQuantity : 0}
            usedFacings={usedFacings}
            label="Live facing preview"
          />
        )}

        {mode === 'browse' ? (
          <div className="space-y-3">
            <FormField label="Search & select SKU" required>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code…"
                  className="pl-9"
                />
              </div>
            </FormField>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {loadingSkus ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                  <Spinner /> Loading catalog…
                </div>
              ) : skus.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No SKUs found. Try Create SKU.
                </div>
              ) : (
                skus.map((sku) => {
                  const selected = selectedSkuId === sku.id
                  const missingDims =
                    sku.width == null || sku.height == null || sku.depth == null
                  return (
                    <button
                      key={sku.id}
                      type="button"
                      onClick={() => setSelectedSkuId(sku.id)}
                      className={`w-full text-left px-3 py-2.5 transition-colors ${
                        selected ? 'bg-[#2C5282]/10' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {sku.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/files/image?url=${encodeURIComponent(sku.imageUrl)}`}
                            alt=""
                            className="w-10 h-10 rounded-md object-cover bg-gray-100 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-gray-100 shrink-0 flex items-center justify-center text-gray-300">
                            <FiImage size={16} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{sku.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {[sku.code, sku.brandName, sku.categoryName].filter(Boolean).join(' · ') ||
                              sku.id.slice(0, 8)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {missingDims
                              ? 'No catalog dims — enter size below'
                              : `${Number(sku.width).toFixed(2)} × ${Number(sku.depth).toFixed(2)} × ${Number(sku.height).toFixed(2)} m`}
                          </p>
                        </div>
                        {selected && (
                          <span className="text-[10px] font-semibold text-[#2C5282] shrink-0">Selected</span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {selectedSku && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-2">
                <p className="text-xs text-amber-900 font-medium">
                  {selectedNeedsDims
                    ? 'This SKU has no dimensions. Enter W × D × H in meters (e.g. 0.12 = 12 cm).'
                    : 'Confirm dimensions in meters (e.g. 0.12 = 12 cm):'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Width (m)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step={0.01}
                      value={overrideDims.width}
                      onChange={(e) =>
                        setOverrideDims({ ...overrideDims, width: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Depth (m)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step={0.01}
                      value={overrideDims.depth}
                      onChange={(e) =>
                        setOverrideDims({ ...overrideDims, depth: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Height (m)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step={0.01}
                      value={overrideDims.height}
                      onChange={(e) =>
                        setOverrideDims({ ...overrideDims, height: e.target.value })
                      }
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateAndAttach} className="space-y-3">
            <FormField label="Product Name" required>
              <Input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Sliced White Bread"
              />
            </FormField>
            <FormField label="SKU Code" required>
              <Input
                required
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                placeholder="e.g. WHT-BRD-001"
              />
            </FormField>
            <FormField label="Category" required>
              <select
                required
                value={createForm.categoryId}
                onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C5282]/30"
                disabled={loadingCategories}
              >
                <option value="">{loadingCategories ? 'Loading…' : 'Select category'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Product image">
              {imagePreview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-gray-600 truncate max-w-[200px]">
                      {imageFile?.name}
                    </p>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <FiX size={12} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 cursor-pointer hover:border-[#2C5282]/50 hover:bg-[#2C5282]/5 transition-colors">
                  <FiImage className="text-gray-400" size={22} />
                  <span className="text-sm text-gray-600">
                    {uploadingImage ? 'Uploading…' : 'Click to upload image'}
                  </span>
                  <span className="text-[10px] text-gray-400">PNG, JPG, WebP</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      if (imagePreview) URL.revokeObjectURL(imagePreview)
                      setImageFile(file)
                      setImagePreview(file ? URL.createObjectURL(file) : null)
                    }}
                  />
                </label>
              )}
            </FormField>

            <FormField label="3D model (.glb)">
              {modelFile || localModelUrl ? (
                <div className="space-y-2">
                  {previewModelUrl ? (
                    <SkuModelPreview
                      url={previewModelUrl}
                      width={previewWidth}
                      height={previewHeight}
                      depth={previewDepth}
                      className="h-44 w-full"
                    />
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-600 truncate min-w-0">
                      {modelFile?.name ?? localModelUrl}
                    </p>
                    <button
                      type="button"
                      onClick={clearModel}
                      className="inline-flex shrink-0 items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <FiX size={12} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 cursor-pointer hover:border-[#2C5282]/50 hover:bg-[#2C5282]/5 transition-colors">
                    <FiBox className="text-gray-400" size={22} />
                    <span className="text-sm text-gray-600">
                      {uploadingModel ? 'Uploading…' : 'Click to upload .glb'}
                    </span>
                    <span className="text-[10px] text-gray-400">GLB only — scaled to catalog W×H×D</span>
                    <input
                      type="file"
                      accept=".glb,model/gltf-binary"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setLocalModelUrl(null)
                        setSelectedDemoId(null)
                        if (modelObjectUrl) {
                          URL.revokeObjectURL(modelObjectUrl)
                          setModelObjectUrl(null)
                        }
                        setModelFile(file)
                        if (file) setModelObjectUrl(URL.createObjectURL(file))
                      }}
                    />
                  </label>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Local demo models
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DEMO_PRODUCT_MODELS.map((demo) => (
                        <button
                          key={demo.id}
                          type="button"
                          onClick={() => {
                            setModelFile(null)
                            if (modelObjectUrl) {
                              URL.revokeObjectURL(modelObjectUrl)
                              setModelObjectUrl(null)
                            }
                            setSelectedDemoId(demo.id)
                            setLocalModelUrl(demo.url)
                            setCreateForm((prev) => ({
                              ...prev,
                              width: String(demo.width),
                              depth: String(demo.depth),
                              height: String(demo.height),
                              name: prev.name.trim() ? prev.name : (demo.suggestedName ?? prev.name),
                              code: prev.code.trim() ? prev.code : (demo.suggestedCode ?? prev.code),
                            }))
                          }}
                          className="text-left text-[11px] text-[#2C5282] hover:text-[#1a365d] px-2 py-1.5 rounded-lg border border-[#2C5282]/20 hover:bg-[#2C5282]/5 transition-colors"
                          title={`${demo.width}×${demo.depth}×${demo.height} m`}
                        >
                          {demo.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Width (m)" required hint="e.g. 0.12 = 12 cm">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.01}
                  required
                  value={createForm.width}
                  onChange={(e) => setCreateForm({ ...createForm, width: e.target.value })}
                />
              </FormField>
              <FormField label="Depth (m)" required hint="e.g. 0.08 = 8 cm">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.01}
                  required
                  value={createForm.depth}
                  onChange={(e) => setCreateForm({ ...createForm, depth: e.target.value })}
                />
              </FormField>
              <FormField label="Height (m)" required hint="e.g. 0.27 = 27 cm">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.01}
                  required
                  value={createForm.height}
                  onChange={(e) => setCreateForm({ ...createForm, height: e.target.value })}
                />
              </FormField>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
