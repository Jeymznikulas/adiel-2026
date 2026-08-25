import { apiRequest } from './client'

export type SupplierType = 'Contractor' | 'Distributor' | 'Manufacturer' | 'Service provider' | 'Other'
export type SupplierStatus = 'Active' | 'Inactive'
export type SupplierContact = { id: string; name: string; email: string; phone: string; isPrimary: boolean; sortOrder: number }
export type SupplierPerformanceNote = { id: string; text: string }
export type Supplier = {
  id: string
  logo: string
  name: string
  type: SupplierType
  status: SupplierStatus
  tin: string
  companyEmail: string
  companyPhone: string
  address: string
  catalogUrl: string
  contacts: SupplierContact[]
  categories: string[]
  performanceNotes: SupplierPerformanceNote[]
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  version: number
}
export type SaveSupplier = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'version' | 'contacts' | 'performanceNotes'> & { contacts: Array<Omit<SupplierContact, 'isPrimary' | 'sortOrder'>>; performanceNotes: SupplierPerformanceNote[]; version?: number }
export type SupplierPage = { items: Supplier[]; page: number; pageSize: number; total: number; summary: { totalSuppliers: number; activeSuppliers: number; categoryCount: number } }

export const listSuppliers = (query: { search?: string; type?: SupplierType; includeArchived?: boolean; archivedOnly?: boolean; page?: number; pageSize?: number; sort?: 'name' | 'newest' | 'type' } = {}) => {
  const parameters = new URLSearchParams()
  if (query.search) parameters.set('search', query.search)
  if (query.type) parameters.set('type', query.type)
  if (query.includeArchived) parameters.set('includeArchived', 'true')
  if (query.archivedOnly) parameters.set('archivedOnly', 'true')
  parameters.set('page', String(query.page ?? 1))
  parameters.set('pageSize', String(query.pageSize ?? 100))
  parameters.set('sort', query.sort ?? 'name')
  return apiRequest<SupplierPage>('/suppliers?' + parameters.toString())
}
export const getSupplier = (id: string) => apiRequest<Supplier>('/suppliers/' + id)
export const createSupplier = (supplier: SaveSupplier) => apiRequest<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(supplier) })
export const updateSupplier = (id: string, supplier: SaveSupplier) => apiRequest<Supplier>('/suppliers/' + id, { method: 'PUT', body: JSON.stringify(supplier) })
export const archiveSupplier = (id: string, version: number) => apiRequest<Supplier>('/suppliers/' + id + '/archive', { method: 'POST', body: JSON.stringify({ version }) })
export const restoreSupplier = (id: string, version: number) => apiRequest<Supplier>('/suppliers/' + id + '/restore', { method: 'POST', body: JSON.stringify({ version }) })
