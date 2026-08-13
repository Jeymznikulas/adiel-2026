export type CompanyProfile = {
  companyName: string
  address: string
  mainOfficeNumber: string
  clientRelationsNumber: string
  accountsNumber: string
  newAccountsNumber: string
  email: string
  tin: string
}

export type DocumentDefaults = {
  quotationTerms: string
  purchaseOrderTerms: string
  statementPaymentInstructions: string
  pdfFooter: string
}

const companyProfileStorageKey = 'adiel.company-profile'
const legacyCompanyProfileStorageKey = 'adiel.po-company-profile'
const documentDefaultsStorageKey = 'adiel.document-defaults'

export const defaultCompanyProfile: CompanyProfile = {
  companyName: 'ADIEL CONSTRUCTION SUPPLIES',
  address: '',
  mainOfficeNumber: '',
  clientRelationsNumber: '',
  accountsNumber: '',
  newAccountsNumber: '',
  email: '',
  tin: '',
}

export const defaultDocumentDefaults: DocumentDefaults = {
  quotationTerms: [
    'Prices and availability are valid only for the scope shown in this quotation.',
    'Changes to quantities, specifications, or delivery location may require a revised quotation.',
  ].join('\n'),
  purchaseOrderTerms: [
    'All supplied items must match the specifications and quantities stated in this purchase order.',
    'Prices are inclusive of all agreed charges unless separately itemized in this document.',
    'The supplier must reference the PO number on all delivery receipts and invoices.',
    'Delivery schedules or substitutions require prior written approval from ADIEL Construction Supplies.',
  ].join('\n'),
  statementPaymentInstructions: 'Please include the SOA number as the payment reference and send proof of payment to the accounts contact shown above.',
  pdfFooter: 'Generated electronically by the ADIEL Operations System.',
}

function normalizeRecord<T extends Record<string, string>>(saved: unknown, defaults: T): T {
  if (typeof saved !== 'object' || saved === null) return { ...defaults }
  const record = saved as Partial<Record<keyof T, unknown>>
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof record[key] === 'string' ? record[key] : fallback])) as T
}

function readStorage(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'null') as unknown
  } catch {
    return null
  }
}

export function loadCompanyProfile(): CompanyProfile {
  const current = readStorage(companyProfileStorageKey)
  if (current) return normalizeRecord(current, defaultCompanyProfile)

  const legacy = readStorage(legacyCompanyProfileStorageKey)
  const migrated = normalizeRecord(legacy, defaultCompanyProfile)
  if (legacy) {
    try {
      window.localStorage.setItem(companyProfileStorageKey, JSON.stringify(migrated))
    } catch {
      // The migrated values still remain available for this session.
    }
  }
  return migrated
}

export function saveCompanyProfile(profile: CompanyProfile) {
  window.localStorage.setItem(companyProfileStorageKey, JSON.stringify(profile))
  window.dispatchEvent(new Event('adiel:settings-changed'))
}

export function loadDocumentDefaults(): DocumentDefaults {
  return normalizeRecord(readStorage(documentDefaultsStorageKey), defaultDocumentDefaults)
}

export function saveDocumentDefaults(defaults: DocumentDefaults) {
  window.localStorage.setItem(documentDefaultsStorageKey, JSON.stringify(defaults))
  window.dispatchEvent(new Event('adiel:settings-changed'))
}
