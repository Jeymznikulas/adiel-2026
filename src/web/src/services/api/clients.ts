import { apiRequest } from './client'

export type ClientStatus = 'Active' | 'Inactive'
export type ClientContact = { id: string; name: string; email: string; phone: string; isPrimary: boolean; sortOrder: number }
export type Client = {
  id: string
  photo: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  industry: string
  clientSince: string
  status: ClientStatus
  contacts: ClientContact[]
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  version: number
}
export type ClientDirectorySummary = { totalClients: number; activeClients: number; industryCount: number; approvedSalesValue: number }
export type ClientPage = { items: Client[]; page: number; pageSize: number; total: number; summary: ClientDirectorySummary }
export type ClientTimelineKind = 'Activity' | 'Quotation' | 'Sale' | 'SOA' | 'Payment'
export type ClientTimelineEntry = {
  id: string
  kind: ClientTimelineKind
  source: string
  occurredAt: string
  reference: string
  title: string
  description: string
  amount: number | null
  balance: number | null
  status: string
  href: string
}
export type ClientTimelineSummary = { salesValue: number; collected: number; outstanding: number; recordCount: number; openStatements: number; paymentCount: number }
export type ClientTimeline = { items: ClientTimelineEntry[]; summary: ClientTimelineSummary }
export type ClientIndustry = { id: string; name: string; isActive: boolean; sortOrder: number; usageCount: number; version: number }
export type SaveClient = {
  name: string
  photo: string | null
  address: string
  industry: string
  clientSince: string
  status: ClientStatus
  contacts: Array<Pick<ClientContact, 'id' | 'name' | 'email' | 'phone'>>
  version?: number
}

export type ClientListQuery = {
  search?: string
  industry?: string
  includeArchived?: boolean
  archivedOnly?: boolean
  page?: number
  pageSize?: number
  sort?: 'name' | 'newest' | 'industry'
}

export function listClients(query: ClientListQuery = {}) {
  const parameters = new URLSearchParams()
  if (query.search?.trim()) parameters.set('search', query.search.trim())
  if (query.industry?.trim()) parameters.set('industry', query.industry.trim())
  if (query.includeArchived) parameters.set('includeArchived', 'true')
  if (query.archivedOnly) parameters.set('archivedOnly', 'true')
  parameters.set('page', String(query.page ?? 1))
  parameters.set('pageSize', String(query.pageSize ?? 12))
  parameters.set('sort', query.sort ?? 'name')
  return apiRequest<ClientPage>(`/clients?${parameters}`)
}
export const getClient = (id: string) => apiRequest<Client>(`/clients/${id}`)
export const getClientTimeline = (id: string) => apiRequest<ClientTimeline>(`/clients/${id}/timeline`)
export const createClient = (request: SaveClient) => apiRequest<Client>('/clients', { method: 'POST', body: JSON.stringify(request) })
export const updateClient = (id: string, request: SaveClient) => apiRequest<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(request) })
export const archiveClient = (id: string, version: number) => apiRequest<Client>(`/clients/${id}/archive`, { method: 'POST', body: JSON.stringify({ version }) })
export const restoreClient = (id: string, version: number) => apiRequest<Client>(`/clients/${id}/restore`, { method: 'POST', body: JSON.stringify({ version }) })
export const listClientIndustries = () => apiRequest<ClientIndustry[]>('/clients/industries')
export const createClientIndustry = (name: string) => apiRequest<ClientIndustry>('/clients/industries', { method: 'POST', body: JSON.stringify({ name }) })
export const renameClientIndustry = (id: string, name: string, version: number) => apiRequest<ClientIndustry>(`/clients/industries/${id}`, { method: 'PUT', body: JSON.stringify({ name, version }) })
export const setClientIndustryActive = (id: string, isActive: boolean, version: number) => apiRequest<ClientIndustry>(`/clients/industries/${id}/active`, { method: 'POST', body: JSON.stringify({ isActive, version }) })
export const reorderClientIndustries = (ids: string[]) => apiRequest<ClientIndustry[]>('/clients/industries/order', { method: 'PUT', body: JSON.stringify({ ids }) })
export const deleteClientIndustry = (id: string, version: number) => apiRequest<void>(`/clients/industries/${id}?version=${version}`, { method: 'DELETE' })
