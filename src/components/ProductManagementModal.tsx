'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    FiX,
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiSearch,
    FiFilter,
    FiChevronLeft,
    FiChevronRight,
    FiLock
} from 'react-icons/fi'
import { Category, Brand, Product } from '../types/product-management'

interface ProductManagementModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function ProductManagementModal({ isOpen, onClose }: ProductManagementModalProps) {
    // Brand -> Category -> Product flow
    const [activeTab, setActiveTab] = useState<'brands' | 'categories' | 'products'>('brands')

    // Data State
    const [categories, setCategories] = useState<Category[]>([])
    const [brands, setBrands] = useState<Brand[]>([])
    const [products, setProducts] = useState<Product[]>([])

    // Loading States
    const [loading, setLoading] = useState(false)

    // Modal States
    const [showAddCategory, setShowAddCategory] = useState(false)
    const [showAddBrand, setShowAddBrand] = useState(false)
    const [showAddProduct, setShowAddProduct] = useState(false)

    // Filter & Sort States
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

    // Form States
    const [categoryForm, setCategoryForm] = useState({ name: '', status: 'Active' as const })
    const [brandForm, setBrandForm] = useState({ name: '', categoryId: '', status: 'Active' as const })
    const [productForm, setProductForm] = useState({
        name: '',
        categoryId: '',
        brandId: '',
        price: 0,
        height: 0,
        width: 0,
        depth: 0,
        length: 0,
        color: '#000000',
        images: [] as File[],
        description: '',
        status: 'Active' as const
    })

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [catRes, brandRes, prodRes] = await Promise.all([
                fetch('/api/categories/list'),
                fetch('/api/brands/list'),
                fetch('/api/products/list')
            ])

            const [catData, brandData, prodData] = await Promise.all([
                catRes.json(),
                brandRes.json(),
                prodRes.json()
            ])

            // ✅ Handle both possible API shapes
            if (catData?.isRequestSuccess) {
                const categoryList =
                    catData.data?.categories ??
                    catData.data ??
                    []
                const mapped = (Array.isArray(categoryList) ? categoryList : []).map((item: any) => ({
                    ...item,
                    status: item.status || (item.isActive ? 'Active' : 'Inactive')
                }))
                setCategories(mapped)
            }

            if (brandData?.isRequestSuccess) {
                const brandList =
                    brandData.data?.brands ??
                    brandData.data ??
                    []
                const mapped = (Array.isArray(brandList) ? brandList : []).map((item: any) => ({
                    ...item,
                    status: item.status || (item.isActive ? 'Active' : 'Inactive')
                }))
                setBrands(mapped)
            }

            if (prodData?.isRequestSuccess) {
                const productList =
                    prodData.data?.products ??
                    prodData.data ??
                    []
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

    // Tab Disabling Logic
    // const isCategoryDisabled = brands.length === 0
    // const isProductDisabled = categories.length === 0 || brands.length === 0

    // Helper for Category Name
    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown'
    const getBrandName = (id: string) => brands.find(b => b.id === id)?.name || 'Unknown'

    // Actions
    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/categories/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryForm)
            })
            const data = await res.json()
            if (data.isRequestSuccess) {
                setShowAddCategory(false)
                setCategoryForm({ name: '', status: 'Active' })
                await fetchData()
            } else {
                alert(data.message || 'Failed to add category')
            }
        } catch (error) {
            alert('Error adding category')
        }
    }

    const handleAddBrand = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/brands/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(brandForm)
            })
            const data = await res.json()
            if (data.isRequestSuccess) {
                setShowAddBrand(false)
                setBrandForm({ name: '', categoryId: '', status: 'Active' })
                await fetchData()
            } else {
                alert(data.message || 'Failed to add brand')
            }
        } catch (error) {
            alert('Error adding brand')
        }
    }

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/products/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productForm)
            })
            const data = await res.json()
            if (data.isRequestSuccess) {
                const productId = data.data?.id || data.data?.productId;

                // Automatically upload images if any
                if (productId && productForm.images.length > 0) {
                    const formData = new FormData();
                    formData.append('productId', productId);
                    productForm.images.forEach(image => {
                        formData.append('images', image);
                    });

                    const uploadRes = await fetch('/api/products/add-images', {
                        method: 'POST',
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (!uploadData.isRequestSuccess) {
                        console.error('Failed to upload images:', uploadData.message);
                        alert('Product created, but image upload failed: ' + uploadData.message);
                    }
                }

                setShowAddProduct(false)
                setProductForm({
                    name: '', categoryId: '', brandId: '', price: 0, height: 0, width: 0, depth: 0, length: 0, color: '#000000', images: [], description: '', status: 'Active'
                })
                await fetchData()
            } else {
                alert(data.message || 'Failed to add product')
            }
        } catch (error) {
            alert('Error adding product')
        } finally {
            setLoading(false)
        }
    }

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

    const filteredBrandsForProduct = Array.isArray(brands)
        ? brands.filter(b => !productForm.categoryId || b.categoryId === productForm.categoryId || !b.categoryId)
        : []

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage your categories, brands, and products inventory.</p>
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
                        {(['brands', 'categories', 'products'] as const).map((tab) => (
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
                        <button
                            onClick={() => {
                                if (activeTab === 'categories') setShowAddCategory(true)
                                if (activeTab === 'brands') setShowAddBrand(true)
                                if (activeTab === 'products') setShowAddProduct(true)
                            }}
                            className="flex items-center gap-2 bg-[#002952] text-white px-5 py-2 rounded-xl font-semibold hover:bg-[#001a33] transition-all whitespace-nowrap shadow-lg shadow-[#002952]/20"
                        >
                            <FiPlus />
                            Add {activeTab.slice(0, -1)}
                        </button>
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
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                            </>
                                        )}
                                        {activeTab === 'brands' && (
                                            <>
                                                <th onClick={() => handleSort('name')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Name {renderSortIcon('name')}</th>
                                                <th onClick={() => handleSort('categoryId')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Category {renderSortIcon('categoryId')}</th>
                                                <th onClick={() => handleSort('createdDate')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Created Date {renderSortIcon('createdDate')}</th>
                                                <th onClick={() => handleSort('status')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Status {renderSortIcon('status')}</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                            </>
                                        )}
                                        {activeTab === 'products' && (
                                            <>
                                                <th onClick={() => handleSort('name')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Product Info {renderSortIcon('name')}</th>
                                                <th onClick={() => handleSort('categoryId')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Category & Brand {renderSortIcon('categoryId')}</th>
                                                <th onClick={() => handleSort('price')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Price {renderSortIcon('price')}</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimensions (H×W×D)</th>
                                                <th onClick={() => handleSort('status')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">Status {renderSortIcon('status')}</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
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
                                                {new Date(category.createdDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${category.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {category.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><FiEdit2 size={16} /></button>
                                                    <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><FiTrash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Brand Rows */}
                                    {activeTab === 'brands' && getSortedData((Array.isArray(brands) ? brands : []).filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))).map((brand) => (
                                        <tr key={brand.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 font-semibold text-gray-900">{brand.name}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-[#002952]/10 text-[#002952] px-2 py-0.5 rounded text-xs font-medium">
                                                    {getCategoryName(brand.categoryId)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(brand.createdDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${brand.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {brand.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><FiEdit2 size={16} /></button>
                                                    <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><FiTrash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Product Rows */}
                                    {activeTab === 'products' && getSortedData((Array.isArray(products) ? products : []).filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))).map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg shadow-inner flex-shrink-0" style={{ backgroundColor: product.color }} />
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{product.name}</div>
                                                        <div className="text-xs text-gray-400 line-clamp-1">{product.description}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-[#002952]">Cat: {getCategoryName(product.categoryId)}</span>
                                                    <span className="text-xs font-bold text-purple-600">Brand: {getBrandName(product.brandId)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-gray-900">${product.price.toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {product.height}m × {product.width}m × {product.depth}m
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${product.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {product.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><FiEdit2 size={16} /></button>
                                                    <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><FiTrash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {(activeTab === 'categories' ? categories : activeTab === 'brands' ? brands : products).length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-gray-400 font-medium">No {activeTab} found. Click Add to get started!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <div>Showing {(activeTab === 'categories' ? categories : activeTab === 'brands' ? brands : products).length} entries</div>
                    <div className="flex items-center gap-1">
                        <button className="p-1 hover:text-gray-600 disabled:opacity-30" disabled><FiChevronLeft /></button>
                        <span className="px-2 font-bold text-gray-900">1</span>
                        <button className="p-1 hover:text-gray-600 disabled:opacity-30" disabled><FiChevronRight /></button>
                    </div>
                </div>

                {/* Sub-modals for Add/Edit */}
                {showAddCategory && (
                    <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
                        <form onSubmit={handleAddCategory} className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-xl font-bold mb-6">Add New Category</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-gray-700">Category Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={categoryForm.name}
                                        onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                        placeholder="Enter category name..."
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-[#002952]/20 focus:border-[#002952]"
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex gap-3">
                                <button type="button" onClick={() => setShowAddCategory(false)} className="flex-1 py-2 font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-2 font-semibold bg-[#002952] text-white rounded-xl hover:bg-[#001a33] shadow-lg shadow-[#002952]/20 transition-all">Add Category</button>
                            </div>
                        </form>
                    </div>
                )}

                {showAddBrand && (
                    <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
                        <form onSubmit={handleAddBrand} className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-xl font-bold mb-6">Add New Brand</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-gray-700">Brand Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={brandForm.name}
                                        onChange={e => setBrandForm({ ...brandForm, name: e.target.value })}
                                        placeholder="Enter brand name..."
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-[#002952]/20 focus:border-[#002952]"
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex gap-3">
                                <button type="button" onClick={() => setShowAddBrand(false)} className="flex-1 py-2 font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-2 font-semibold bg-[#002952] text-white rounded-xl hover:bg-[#001a33] shadow-lg shadow-[#002952]/20 transition-all">Add Brand</button>
                            </div>
                        </form>
                    </div>
                )}

                {showAddProduct && (
                    <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
                        <form onSubmit={handleAddProduct} className="bg-white p-8 rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-xl font-bold mb-6">Add New Product</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">Product Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={productForm.name}
                                            onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                                            placeholder="Enter product name..."
                                            className="w-full px-4 py-2 border rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">Category</label>
                                        <div className="flex gap-2">
                                            <select
                                                required
                                                value={productForm.categoryId}
                                                onChange={e => setProductForm({ ...productForm, categoryId: e.target.value, brandId: '' })}
                                                className="flex-1 px-4 py-2 border rounded-xl"
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            <button type="button" onClick={() => setShowAddCategory(true)} className="p-2 border rounded-xl hover:bg-gray-50"><FiPlus /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">Brand</label>
                                        <div className="flex gap-2">
                                            <select
                                                required
                                                disabled={!productForm.categoryId}
                                                value={productForm.brandId}
                                                onChange={e => setProductForm({ ...productForm, brandId: e.target.value })}
                                                className="flex-1 px-4 py-2 border rounded-xl disabled:bg-gray-50 disabled:text-gray-400"
                                            >
                                                <option value="">Select Brand</option>
                                                {filteredBrandsForProduct.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                            <button type="button" onClick={() => setShowAddBrand(true)} className="p-2 border rounded-xl hover:bg-gray-50"><FiPlus /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">Color</label>
                                        <input
                                            type="color"
                                            value={productForm.color}
                                            onChange={e => setProductForm({ ...productForm, color: e.target.value })}
                                            className="w-full h-10 border rounded-xl cursor-pointer"
                                        />
                                    </div>


                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">Price ($)</label>
                                        <input
                                            type="number" step="0.01"
                                            value={productForm.price || ''}
                                            onChange={e => setProductForm({ ...productForm, price: parseFloat(e.target.value) })}
                                            className="w-full px-4 py-2 border rounded-xl"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Height (m)</label>
                                            <input type="number" step="0.01" value={productForm.height || ''} onChange={e => setProductForm({ ...productForm, height: parseFloat(e.target.value) })} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Width (m)</label>
                                            <input type="number" step="0.01" value={productForm.width || ''} onChange={e => setProductForm({ ...productForm, width: parseFloat(e.target.value) })} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Depth (m)</label>
                                            <input type="number" step="0.01" value={productForm.depth || ''} onChange={e => setProductForm({ ...productForm, depth: parseFloat(e.target.value) })} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Length (m)</label>
                                            <input type="number" step="0.01" value={productForm.length || ''} onChange={e => setProductForm({ ...productForm, length: parseFloat(e.target.value) })} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">Description</label>
                                        <textarea
                                            value={productForm.description}
                                            onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-xl resize-none h-20 text-sm"
                                            placeholder="Product details..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className='w-full'>
                                <label className="block text-sm w-full font-semibold mb-1.5 text-gray-700">Product Images</label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            const filesArray = Array.from(e.target.files)
                                            setProductForm({
                                                ...productForm,
                                                images: [...productForm.images, ...filesArray]
                                            })
                                        }
                                    }}
                                    className="w-full px-4 py-2 border rounded-xl"
                                />
                            </div>
                            <div className="mt-8 flex gap-3">
                                <button type="button" onClick={() => setShowAddProduct(false)} className="flex-1 py-3 font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-3 font-semibold bg-[#002952] text-white rounded-xl hover:bg-[#001a33] shadow-lg shadow-[#002952]/20 transition-all">Create Product</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
