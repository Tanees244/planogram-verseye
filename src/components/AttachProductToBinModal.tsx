'use client'

import { useState, useEffect } from 'react'
import { FiX, FiPlus, FiBox } from 'react-icons/fi'
import { Product } from '../types/product-management'

interface AttachProductToBinModalProps {
    isOpen: boolean
    onClose: () => void
    binId: string
    onSuccess: (product: Product, quantity: number) => void
    logPayload?: boolean
}

export default function AttachProductToBinModal({ isOpen, onClose, binId, onSuccess, logPayload }: AttachProductToBinModalProps) {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [formData, setFormData] = useState({
        productId: '',
        quantity: 1
    })

    useEffect(() => {
        if (isOpen) {
            fetchProducts()
        }
    }, [isOpen])

    const fetchProducts = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/products/list')
            const data = await res.json()
            if (data.isRequestSuccess) {
                const list = data.data?.products ?? data.data ?? []
                setProducts(Array.isArray(list) ? list : [])
            }
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const selectedProduct = products.find(p => p.id === formData.productId)
        if (!selectedProduct || formData.quantity < 1) return

        setSubmitting(true)
        try {
            const payload = {
                binId,
                productId: formData.productId,
                quantity: Number(formData.quantity)
            }
            if (logPayload) console.log('[Traditional] AttachProduct payload ->', payload)
            const res = await fetch('/api/bins/attach-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (data.isRequestSuccess) {
                onSuccess(selectedProduct, formData.quantity)
                resetForm()
                onClose()
            } else {
                alert(data.message || 'Failed to attach product')
            }
        } catch (error) {
            alert('Error connecting to server')
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setFormData({ productId: '', quantity: 1 })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FiBox className="text-[#002952]" />
                        Attach Product to Bin
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <FiX size={20} className="text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Product</label>
                        <select
                            required
                            disabled={loading}
                            value={formData.productId}
                            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002952]/20 focus:border-[#002952] transition-all"
                        >
                            <option value="">{loading ? 'Loading products...' : 'Select a product'}</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity</label>
                        <input
                            type="number"
                            min="1"
                            required
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002952]/20 focus:border-[#002952]"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !formData.productId}
                            className="flex-1 py-2 font-semibold bg-[#002952] text-white rounded-xl hover:bg-[#001a33] shadow-lg shadow-[#002952]/20 transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                            {submitting ? 'Attaching...' : 'Attach Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
