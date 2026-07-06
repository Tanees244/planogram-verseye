'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input, Select } from '@/components/ui/form'
import { Product } from '../types/product-management'
import { Spinner } from './Spinner'

interface AttachProductToBinModalProps {
  isOpen: boolean
  onClose: () => void
  binId: string
  onSuccess: (product: Product, quantity: number) => void
  logPayload?: boolean
}

export default function AttachProductToBinModal({
  isOpen,
  onClose,
  binId,
  onSuccess,
  logPayload,
}: AttachProductToBinModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ productId: '', quantity: 1 })

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/products/list')
      .then((r) => r.json())
      .then((data) => {
        if (data.isRequestSuccess) {
          const list = data.data?.products ?? data.data ?? []
          setProducts(Array.isArray(list) ? list : [])
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isOpen])

  const sel = products.find((p) => p.id === formData.productId) as Product & {
    imageUrl?: string
    skuCode?: string
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const selectedProduct = products.find((p) => p.id === formData.productId)
    if (!selectedProduct || formData.quantity < 1) return

    setSubmitting(true)
    try {
      const payload = { binId, skuId: formData.productId, quantity: Number(formData.quantity) }
      if (logPayload) console.log('[Traditional] AttachProduct payload ->', payload)
      const res = await fetch('/api/bins/attach-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.isRequestSuccess) {
        onSuccess(selectedProduct, formData.quantity)
        setFormData({ productId: '', quantity: 1 })
        onClose()
      } else {
        alert(data.message || 'Failed to attach product')
      }
    } catch {
      alert('Error connecting to server')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Attach Product"
      subtitle="Select a catalog SKU and quantity to place in this bin."
      maxWidth="md"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={submitting || !formData.productId} onClick={() => handleSubmit()}>
            {submitting && <Spinner />}
            {submitting ? 'Attaching…' : 'Attach Product'}
          </Btn>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Product" required>
          <Select
            required
            disabled={loading}
            value={formData.productId}
            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
          >
            <option value="">{loading ? 'Loading products…' : 'Select a product'}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>

        {sel?.imageUrl && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
            <img
              src={sel.imageUrl}
              alt={sel.name}
              className="w-14 h-14 rounded-lg object-cover border border-gray-200 bg-white"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{sel.name}</div>
              {sel.skuCode && <div className="text-xs text-gray-500 truncate">{sel.skuCode}</div>}
            </div>
          </div>
        )}

        <FormField label="Quantity (facings)" required>
          <Input
            type="number"
            min={1}
            required
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
          />
        </FormField>
      </form>
    </Modal>
  )
}
