'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
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
  binId: _binId,
  onSuccess,
  logPayload: _logPayload,
}: AttachProductToBinModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    width: '0.15',
    depth: '0.20',
    height: '0.08',
    quantity: 1,
    color: '#2C5282',
  })

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!formData.name.trim() || formData.quantity < 1) return

    setSubmitting(true)
    try {
      const localProduct: Product = {
        id: `local-${Date.now()}`,
        name: formData.name.trim(),
        categoryId: 'local',
        brandId: 'local',
        price: 0,
        height: Number(formData.height) || 0.08,
        width: Number(formData.width) || 0.15,
        depth: Number(formData.depth) || 0.2,
        length: Number(formData.depth) || 0.2,
        color: formData.color,
        description: 'Local product (not synced)',
        status: 'Active',
        createdDate: new Date().toISOString(),
      }
      onSuccess(localProduct, formData.quantity)
      setFormData({
        name: '',
        width: '0.15',
        depth: '0.20',
        height: '0.08',
        quantity: 1,
        color: '#2C5282',
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Attach Product"
      subtitle="Local mode: add product without API sync."
      maxWidth="md"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={submitting || !formData.name.trim()} onClick={() => handleSubmit()}>
            {submitting && <Spinner />}
            {submitting ? 'Attaching…' : 'Attach Product'}
          </Btn>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Product Name" required>
          <Input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter product/widget name"
          />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Width (m)" required>
            <Input
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              required
              value={formData.width}
              onChange={(e) => setFormData({ ...formData, width: e.target.value })}
            />
          </FormField>
          <FormField label="Depth (m)" required>
            <Input
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              required
              value={formData.depth}
              onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
            />
          </FormField>
          <FormField label="Height (m)" required>
            <Input
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              required
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
            />
          </FormField>
        </div>

        <FormField label="Color">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-14 h-10 p-1"
            />
            <span className="text-xs text-gray-500">{formData.color}</span>
          </div>
        </FormField>

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
