import { apiRequest } from './client'

export type QuotationStatus = 'Draft' | 'For Approval' | 'Approved' | 'Rejected' | 'Voided'
export type QuotationLine = { id: string; itemId: string | null; variantId: string | null; photo: string; itemName: string; variantLabel: string; productCode: string; unitOfMeasure: string; quantity: number; unitPrice: number; unitCost: number; lineAmount: number }
export type QuotationCharge = { id: string; label: string; amount: number; position: number }
export type Quotation = { id: string; quotationNumber: string; quotationDate: string; clientId: string | null; clientName: string; contactId: string | null; contactPerson: string; subject: string; projectLocation: string; leadTime: string; notes: string; terms: string; subtotalAmount: number; vatEnabled: boolean; vatRate: number; vatAmount: number; totalAmount: number; estimatedProfit: number; status: QuotationStatus; rejectionReason: string | null; voidReason: string | null; lines: QuotationLine[]; charges: QuotationCharge[]; createdAt: string; updatedAt: string; archivedAt: string | null; version: number }
export type SaveQuotation = { quotationDate: string; clientId: string | null; clientName: string; contactId: string | null; contactPerson: string; subject: string; projectLocation: string; leadTime: string; notes: string; terms: string; vatEnabled: boolean; lines: Array<Omit<QuotationLine, 'id' | 'lineAmount'>>; charges: Array<Pick<QuotationCharge, 'label' | 'amount'>>; intent: 'draft' | 'submit'; version?: number }
export type QuotationPage = { items: Quotation[]; page: number; pageSize: number; total: number }

export function listQuotations(query: { search?: string; status?: QuotationStatus; includeArchived?: boolean; archivedOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const parameters = new URLSearchParams()
  if (query.search?.trim()) parameters.set('search', query.search.trim())
  if (query.status) parameters.set('status', query.status)
  if (query.includeArchived) parameters.set('includeArchived', 'true')
  if (query.archivedOnly) parameters.set('archivedOnly', 'true')
  parameters.set('page', String(query.page ?? 1))
  parameters.set('pageSize', String(query.pageSize ?? 100))
  return apiRequest<QuotationPage>(`/quotations?${parameters}`)
}

export const getQuotation = (id: string) => apiRequest<Quotation>(`/quotations/${id}`)
export const createQuotation = (request: SaveQuotation) => apiRequest<Quotation>('/quotations', { method: 'POST', body: JSON.stringify(request) })
export const updateQuotation = (id: string, request: SaveQuotation) => apiRequest<Quotation>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(request) })
export const changeQuotationStatus = (id: string, status: QuotationStatus, version: number, reason?: string, archiveAfterVoiding = false) => apiRequest<Quotation>(`/quotations/${id}/status`, { method: 'POST', body: JSON.stringify({ status, reason, version, archiveAfterVoiding }) })
export const archiveQuotation = (id: string, version: number) => apiRequest<Quotation>(`/quotations/${id}/archive`, { method: 'POST', body: JSON.stringify({ version }) })
export const restoreQuotation = (id: string, version: number) => apiRequest<Quotation>(`/quotations/${id}/restore`, { method: 'POST', body: JSON.stringify({ version }) })
