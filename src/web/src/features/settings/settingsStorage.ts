import type { LateChargePolicy } from '../statement-of-account/statementOfAccountTypes'

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

export type DocumentNumberingType = 'quotation' | 'purchaseOrder' | 'statementOfAccount'

export type DocumentNumberingRule = {
  prefix: string
  startingNumber: number
  digits: number
  includeYear: boolean
  resetYearly: boolean
}

export type DocumentNumberingSettings = Record<DocumentNumberingType, DocumentNumberingRule>

export type BusinessSettingsTab = 'expense-categories' | 'payment-methods' | 'client-industries' | 'item-categories'

const companyProfileStorageKey = 'adiel.company-profile'
const legacyCompanyProfileStorageKey = 'adiel.po-company-profile'
const documentDefaultsStorageKey = 'adiel.document-defaults'
const lateChargeDefaultsStorageKey = 'adiel.late-charge-defaults'
const documentNumberingStorageKey = 'adiel.document-numbering'

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

export const defaultLateChargePolicy: LateChargePolicy = {
  enabled: false,
  graceDays: 3,
  type: 'Percentage',
  value: 0,
}

export const defaultDocumentNumbering: DocumentNumberingSettings = {
  quotation: { prefix: 'QT', startingNumber: 1, digits: 3, includeYear: true, resetYearly: true },
  purchaseOrder: { prefix: 'PO', startingNumber: 1, digits: 3, includeYear: true, resetYearly: true },
  statementOfAccount: { prefix: 'SOA', startingNumber: 1, digits: 3, includeYear: true, resetYearly: true },
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

export function loadLateChargePolicy(): LateChargePolicy {
  const saved = readStorage(lateChargeDefaultsStorageKey)
  if (typeof saved !== 'object' || saved === null) return { ...defaultLateChargePolicy }
  const record = saved as Partial<LateChargePolicy>
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : defaultLateChargePolicy.enabled,
    graceDays: typeof record.graceDays === 'number' && Number.isFinite(record.graceDays) ? Math.max(0, Math.min(90, Math.round(record.graceDays))) : defaultLateChargePolicy.graceDays,
    type: record.type === 'Fixed amount' ? 'Fixed amount' : 'Percentage',
    value: typeof record.value === 'number' && Number.isFinite(record.value) ? Math.max(0, record.value) : defaultLateChargePolicy.value,
  }
}

export function saveLateChargePolicy(policy: LateChargePolicy) {
  window.localStorage.setItem(lateChargeDefaultsStorageKey, JSON.stringify(policy))
  window.dispatchEvent(new Event('adiel:settings-changed'))
}

function normalizeNumberingRule(saved: unknown, fallback: DocumentNumberingRule): DocumentNumberingRule {
  if (typeof saved !== 'object' || saved === null) return { ...fallback }
  const rule = saved as Partial<DocumentNumberingRule>
  return {
    prefix: typeof rule.prefix === 'string' && rule.prefix.trim() ? rule.prefix.trim().toUpperCase().slice(0, 12) : fallback.prefix,
    startingNumber: typeof rule.startingNumber === 'number' && Number.isFinite(rule.startingNumber) ? Math.max(1, Math.min(99_999_999, Math.round(rule.startingNumber))) : fallback.startingNumber,
    digits: typeof rule.digits === 'number' && Number.isFinite(rule.digits) ? Math.max(2, Math.min(8, Math.round(rule.digits))) : fallback.digits,
    includeYear: typeof rule.includeYear === 'boolean' ? rule.includeYear : fallback.includeYear,
    resetYearly: typeof rule.resetYearly === 'boolean' ? rule.resetYearly : fallback.resetYearly,
  }
}

export function loadDocumentNumbering(): DocumentNumberingSettings {
  const saved = readStorage(documentNumberingStorageKey)
  const record = typeof saved === 'object' && saved !== null ? saved as Partial<Record<DocumentNumberingType, unknown>> : {}
  return {
    quotation: normalizeNumberingRule(record.quotation, defaultDocumentNumbering.quotation),
    purchaseOrder: normalizeNumberingRule(record.purchaseOrder, defaultDocumentNumbering.purchaseOrder),
    statementOfAccount: normalizeNumberingRule(record.statementOfAccount, defaultDocumentNumbering.statementOfAccount),
  }
}

export function saveDocumentNumbering(settings: DocumentNumberingSettings) {
  const normalized: DocumentNumberingSettings = {
    quotation: normalizeNumberingRule(settings.quotation, defaultDocumentNumbering.quotation),
    purchaseOrder: normalizeNumberingRule(settings.purchaseOrder, defaultDocumentNumbering.purchaseOrder),
    statementOfAccount: normalizeNumberingRule(settings.statementOfAccount, defaultDocumentNumbering.statementOfAccount),
  }
  window.localStorage.setItem(documentNumberingStorageKey, JSON.stringify(normalized))
  window.dispatchEvent(new Event('adiel:settings-changed'))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function formatDocumentNumber(rule: DocumentNumberingRule, sequence: number, date: string) {
  const year = (date || new Date().toISOString()).slice(0, 4)
  const number = String(Math.max(1, Math.round(sequence))).padStart(rule.digits, '0')
  return [rule.prefix.trim().toUpperCase(), rule.includeYear ? year : '', number].filter(Boolean).join('-')
}

export function nextDocumentNumber(type: DocumentNumberingType, existingNumbers: string[], date: string, settings = loadDocumentNumbering()) {
  const rule = settings[type]
  const year = (date || new Date().toISOString()).slice(0, 4)
  const prefix = escapeRegExp(rule.prefix.trim().toUpperCase())
  const pattern = rule.includeYear
    ? new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`, 'i')
    : new RegExp(`^${prefix}-(\\d+)$`, 'i')
  let highest = rule.startingNumber - 1
  for (const existing of existingNumbers) {
    const match = pattern.exec(existing.trim())
    if (!match) continue
    if (rule.includeYear && rule.resetYearly && match[1] !== year) continue
    const sequence = Number(match[rule.includeYear ? 2 : 1])
    if (Number.isInteger(sequence)) highest = Math.max(highest, sequence)
  }
  const used = new Set(existingNumbers.map((value) => value.toUpperCase()))
  let sequence = Math.max(rule.startingNumber, highest + 1)
  let candidate = formatDocumentNumber(rule, sequence, date)
  while (used.has(candidate.toUpperCase())) {
    sequence += 1
    candidate = formatDocumentNumber(rule, sequence, date)
  }
  return candidate
}

export function navigateToBusinessSettings(tab: BusinessSettingsTab) {
  window.history.pushState(null, '', `/settings?section=options&tab=${tab}`)
  window.dispatchEvent(new Event('adiel:navigate'))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
