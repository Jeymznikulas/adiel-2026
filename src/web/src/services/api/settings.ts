import { apiRequest } from './client'

export type CompanySettings = {
  companyName: string
  address: string
  mainOfficeNumber: string
  clientRelationsNumber: string
  accountsNumber: string
  newAccountsNumber: string
  email: string
  tin: string
  updatedAt: string
  version: number
}

export type DocumentDefaults = {
  quotationTerms: string
  purchaseOrderTerms: string
  statementPaymentInstructions: string
  pdfFooter: string
  lateChargeEnabled: boolean
  lateChargeGraceDays: number
  lateChargeType: 'Percentage' | 'Fixed amount'
  lateChargeValue: number
  updatedAt: string
  version: number
}

export type DocumentNumberingType = 'quotation' | 'purchase_order' | 'statement_of_account'
export type DocumentNumberingRule = {
  documentType: DocumentNumberingType
  prefix: string
  startingNumber: number
  digits: number
  includeYear: boolean
  resetYearly: boolean
  updatedAt: string
  version: number
}
export type DocumentNumberPreview = { documentType: DocumentNumberingType; documentDate: string; number: string }

export type BusinessOptionType = 'expense_category' | 'payment_method' | 'client_industry' | 'supplier_category' | 'item_category' | 'task_assignee'
export type BusinessOption = { id: string; type: BusinessOptionType; name: string; isActive: boolean; sortOrder: number; usageCount: number; updatedAt: string; version: number }

export const getCompanySettings = () => apiRequest<CompanySettings>('/settings/company')
export const updateCompanySettings = (settings: Omit<CompanySettings, 'updatedAt'>) => apiRequest<CompanySettings>('/settings/company', { method: 'PUT', body: JSON.stringify(settings) })
export const getDocumentDefaults = () => apiRequest<DocumentDefaults>('/settings/documents')
export const updateDocumentDefaults = (settings: Omit<DocumentDefaults, 'updatedAt'>) => apiRequest<DocumentDefaults>('/settings/documents', { method: 'PUT', body: JSON.stringify(settings) })
export const getDocumentNumberingRules = () => apiRequest<DocumentNumberingRule[]>('/settings/numbering')
export const updateDocumentNumberingRules = (rules: Array<Omit<DocumentNumberingRule, 'updatedAt'>>) => apiRequest<DocumentNumberingRule[]>('/settings/numbering', { method: 'PUT', body: JSON.stringify({ rules }) })
export const previewDocumentNumber = (documentType: DocumentNumberingType, documentDate: string) => apiRequest<DocumentNumberPreview>('/settings/numbering/' + documentType + '/preview?documentDate=' + encodeURIComponent(documentDate))
export const reserveDocumentNumber = (documentType: DocumentNumberingType, documentDate: string) => apiRequest<DocumentNumberPreview>('/settings/numbering/' + documentType + '/reserve', { method: 'POST', body: JSON.stringify({ documentDate }) })
export const listBusinessOptions = (type: BusinessOptionType) => apiRequest<BusinessOption[]>(`/settings/options?type=${encodeURIComponent(type)}`)
export const createBusinessOption = (type: BusinessOptionType, name: string) => apiRequest<BusinessOption>('/settings/options', { method: 'POST', body: JSON.stringify({ type, name }) })
export const renameBusinessOption = (id: string, name: string, version: number) => apiRequest<BusinessOption>(`/settings/options/${id}`, { method: 'PUT', body: JSON.stringify({ name, version }) })
export const setBusinessOptionActive = (id: string, isActive: boolean, version: number) => apiRequest<BusinessOption>(`/settings/options/${id}/active`, { method: 'POST', body: JSON.stringify({ isActive, version }) })
export const reorderBusinessOptions = (type: BusinessOptionType, options: BusinessOption[]) => apiRequest<BusinessOption[]>('/settings/options/order', { method: 'PUT', body: JSON.stringify({ type, items: options.map(({ id, version }) => ({ id, version })) }) })
export const deleteBusinessOption = (id: string, version: number) => apiRequest<void>(`/settings/options/${id}?version=${version}`, { method: 'DELETE' })
