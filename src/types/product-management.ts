export interface Category {
    id: string;
    name: string;
    createdDate: string;
    status: 'Active' | 'Archived';
}

export interface Brand {
    id: string;
    name: string;
    categoryId: string;
    categoryName?: string;
    createdDate: string;
    status: 'Active' | 'Archived';
}

export interface Product {
    id: string;
    name: string;
    categoryId: string;
    categoryName?: string;
    brandId: string;
    brandName?: string;
    price: number;
    height: number;
    width: number;
    depth: number;
    length: number;
    color: string;
    description: string;
    status: 'Active' | 'Archived';
    createdDate: string;
}

export interface AddCategoryRequest {
    name: string;
    status: 'Active' | 'Archived';
}

export interface AddBrandRequest {
    name: string;
    categoryId: string;
    status: 'Active' | 'Archived';
}

export interface AddProductRequest {
    name: string;
    categoryId: string;
    brandId: string;
    price: number;
    height: number;
    width: number;
    depth: number;
    length: number;
    color: string;
    description: string;
}
