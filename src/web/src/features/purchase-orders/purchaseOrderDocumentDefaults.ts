export const defaultPurchaseOrderTerms = [
  'All supplied items must match the specifications and quantities stated in this purchase order.',
  'Prices are inclusive of all agreed charges unless separately itemized in this document.',
  'The supplier must reference the PO number on all delivery receipts and invoices.',
  'Delivery schedules or substitutions require prior written approval from ADIEL Construction Supplies.',
].join('\n')

export type PurchaseOrderCompanyProfile = {
  companyName: string
  address: string
  mainOfficeNumber: string
  clientRelationsNumber: string
  accountsNumber: string
  newAccountsNumber: string
  email: string
  tin: string
}

const profileStorageKey = 'adiel.po-company-profile'

export const defaultPurchaseOrderCompanyProfile: PurchaseOrderCompanyProfile = {
  companyName: 'ADIEL CONSTRUCTION SUPPLIES',
  address: '',
  mainOfficeNumber: '',
  clientRelationsNumber: '',
  accountsNumber: '',
  newAccountsNumber: '',
  email: '',
  tin: '',
}

export function loadPurchaseOrderCompanyProfile(): PurchaseOrderCompanyProfile {
  try {
    const saved = JSON.parse(window.localStorage.getItem(profileStorageKey) ?? '{}') as Partial<PurchaseOrderCompanyProfile>
    return Object.fromEntries(Object.entries(defaultPurchaseOrderCompanyProfile).map(([key, fallback]) => [key, typeof saved[key as keyof PurchaseOrderCompanyProfile] === 'string' ? saved[key as keyof PurchaseOrderCompanyProfile] : fallback])) as PurchaseOrderCompanyProfile
  } catch { return defaultPurchaseOrderCompanyProfile }
}

export function savePurchaseOrderCompanyProfile(profile: PurchaseOrderCompanyProfile) {
  window.localStorage.setItem(profileStorageKey, JSON.stringify(profile))
}
