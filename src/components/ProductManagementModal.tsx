'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    FiX,
    FiSearch,
    FiChevronLeft,
    FiChevronRight
} from 'react-icons/fi'
import { Category, Product } from '../types/product-management'

interface ProductManagementModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function ProductManagementModal({ isOpen, onClose }: ProductManagementModalProps) {
    const [activeTab, setActiveTab] = useState<'categories' | 'products'>('categories')

    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])

    const [loading, setLoading] = useState(false)

    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [catRes, prodRes] = await Promise.all([
                fetch('/api/categories/list'),
                fetch('/api/products/list')
            ])

            const [catData, prodData] = await Promise.all([
                catRes.json(),
                prodRes.json()
            ])

            if (catData?.isRequestSuccess) {
                const categoryList = catData.data?.categories ?? catData.data ?? []
                const mapped = (Array.isArray(categoryList) ? categoryList : []).map((item: any) => ({
                    ...item,
                    status: item.status || (item.isActive ? 'Active' : 'Inactive')
                }))
                setCategories(mapped)
            }

            if (prodData?.isRequestSuccess) {
                const productList = prodData.data?.products ?? prodData.data ?? []
                const mapped = (Array.isArray(productList) ? productList : []).map((item: any) => ({
                    ...item,
                    status: item.status || (item.isActive ? 'Active' : 'Inactive')
                }))
                setProducts(mapped)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            fetchData()
        }
    }, [isOpen, fetchData])

    if (!isOpen) return null

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown'

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const getSortedData = <T extends Record<string, any>>(data: T[]) => {
        if (!sortConfig) return data
        return [...data].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }

    const renderSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return <span className="ml-1 opacity-20">⇅</span>
        return <span className="ml-1 text-[#002952] font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Product Catalog</h2>
                        <p className="text-sm text-gray-500 mt-1">Browse categories and products from the catalog.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <FiX size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Tabs & Search */}
                <div className="px-8 py-4 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {(['categories', 'products'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab)
                                    setSearchTerm('')
                                    setSortConfig(null)
                                }}
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab
                                    ? 'bg-white text-[#002952] shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 flex-1 max-w-md">
                        <div className="relative flex-1">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002952]/20 focus:border-[#002952] transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto px-8 py-6">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="w-12 h-12 border-4 border-[#002952]/20 border-t-[#002952] rounded-full animate-spin mb-4" />
                            <p className="font-medium animate-pulse">Loading data...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        {activeTab === 'categories' && (
                                            <>
                                                <th onClick={() => handleSort('name')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Name {renderSortIcon('name')}</th>
                                                <th onClick={() => handleSort('createdDate')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Created Date {renderSortIcon('createdDate')}</th>
                                                <th onClick={() => handleSort('status')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Status {renderSortIcon('status')}</th>
                                            </>
                                        )}
                                        {activeTab === 'products' && (
                                            <>
                                                <th onClick={() => handleSort('name')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Product Info {renderSortIcon('name')}</th>
                                                <th onClick={() => handleSort('categoryId')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Category & Brand {renderSortIcon('categoryId')}</th>
                                                <th onClick={() => handleSort('price')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Price {renderSortIcon('price')}</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimensions (H×W×D)</th>
                                                <th onClick={() => handleSort('status')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Status {renderSortIcon('status')}</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {/* Category Rows */}
                                    {activeTab === 'categories' && getSortedData((Array.isArray(categories) ? categories : []).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))).map((category) => (
                                        <tr key={category.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-gray-900">{category.name}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {category.createdDate ? new Date(category.createdDate).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${category.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {category.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Product Rows */}
                                    {activeTab === 'products' && getSortedData((Array.isArray(products) ? products : []).filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))).map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {(product as any).imageUrl ? (
                                                        <img
                                                            src={(product as any).imageUrl}
                                                            alt={product.name}
                                                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0 bg-white"
                                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg shadow-inner flex-shrink-0" style={{ backgroundColor: product.color || '#cbd5e1' }} />
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{product.name}</div>
                                                        <div className="text-xs text-gray-400 line-clamp-1">{product.description}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-[#002952]">Cat: {product.categoryName || getCategoryName(product.categoryId)}</span>
                                                    <span className="text-xs font-bold text-purple-600">Brand: {product.brandName || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-gray-900">{typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : '—'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {product.height || 0}m × {product.width || 0}m × {product.depth || 0}m
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${product.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {product.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {(activeTab === 'categories' ? categories : products).length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-gray-400 font-medium">No {activeTab} found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <div>Showing {(activeTab === 'categories' ? categories : products).length} entries</div>
                    <div className="flex items-center gap-1">
                        <button className="p-1 hover:text-gray-600 disabled:opacity-30" disabled><FiChevronLeft /></button>
                        <span className="px-2 font-bold text-gray-900">1</span>
                        <button className="p-1 hover:text-gray-600 disabled:opacity-30" disabled><FiChevronRight /></button>
                    </div>
                </div>
            </div>
        </div>
    )
}
