import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CategorySummary, Paginated, Product, ProductInput } from '../lib/types';

export type ProductSort = 'newest' | 'name' | 'price_asc' | 'price_desc';

export interface ProductFilters {
  search?: string;
  category?: string;
  sort?: ProductSort;
  page: number;
}

const keys = {
  all: ['products'] as const,
  list: (f: ProductFilters) => ['products', 'list', f] as const,
  categories: ['products', 'categories'] as const,
};

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams({ page: String(filters.page), limit: '12' });
      if (filters.search) qs.set('search', filters.search);
      if (filters.category) qs.set('category', filters.category);
      if (filters.sort) qs.set('sort', filters.sort);
      return api<Paginated<Product>>(`/products?${qs}`, { signal });
    },
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | null, initial?: Product) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: ({ signal }) => api<Product>(`/products/${id}`, { signal }),
    enabled: !!id,
    initialData: initial,
    staleTime: initial ? 0 : 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<{ items: CategorySummary[] }>('/products/categories').then((r) => r.items),
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: ProductInput }) =>
      id ? api<Product>(`/products/${id}`, { method: 'PUT', body: data }) : api<Product>('/products', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function uploadImage(file: File) {
  const form = new FormData();
  form.append('image', file);
  return api<{ url: string }>('/uploads', { method: 'POST', formData: form });
}
