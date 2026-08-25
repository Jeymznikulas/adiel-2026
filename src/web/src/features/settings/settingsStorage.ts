import type { LateChargePolicy } from '../statement-of-account/statementOfAccountTypes'
import { getCompanySettings, getDocumentDefaults, getDocumentNumberingRules, previewDocumentNumber as getDocumentNumberPreview, reserveDocumentNumber as reserveDocumentNumberFromApi, updateCompanySettings, updateDocumentDefaults, updateDocumentNumberingRules, type CompanySettings as ApiCompanySettings, type DocumentDefaults as ApiDocumentDefaults, type DocumentNumberingRule as ApiDocumentNumberingRule, type DocumentNumberingType as ApiDocumentNumberingType } from '../../services/api/settings'

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

export type BusinessSettingsTab = 'expense-categories' | 'payment-methods' | 'client-industries' | 'supplier-categories' | 'item-categories'

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

let companyCache: CompanyProfile = { ...defaultCompanyProfile }
let documentCache: DocumentDefaults = { ...defaultDocumentDefaults }
let lateChargeCache: LateChargePolicy = { ...defaultLateChargePolicy }
let numberingCache: DocumentNumberingSettings = { ...defaultDocumentNumbering }
let companyVersion = 0
let documentVersion = 0
let numberingVersions: Record<DocumentNumberingType, number> = { quotation: 0, purchaseOrder: 0, statementOfAccount: 0 }

function cacheCompany(settings: ApiCompanySettings) {
  companyCache = { companyName: settings.companyName, address: settings.address, mainOfficeNumber: settings.mainOfficeNumber, clientRelationsNumber: settings.clientRelationsNumber, accountsNumber: settings.accountsNumber, newAccountsNumber: settings.newAccountsNumber, email: settings.email, tin: settings.tin }
  companyVersion = settings.version
}

function cacheDocuments(settings: ApiDocumentDefaults) {
  documentCache = { quotationTerms: settings.quotationTerms, purchaseOrderTerms: settings.purchaseOrderTerms, statementPaymentInstructions: settings.statementPaymentInstructions, pdfFooter: settings.pdfFooter }
  lateChargeCache = { enabled: settings.lateChargeEnabled, graceDays: settings.lateChargeGraceDays, type: settings.lateChargeType, value: settings.lateChargeValue }
  documentVersion = settings.version
}

const apiDocumentTypes: Record<DocumentNumberingType, ApiDocumentNumberingType> = {
  quotation: 'quotation',
  purchaseOrder: 'purchase_order',
  statementOfAccount: 'statement_of_account',
}

const appDocumentTypes = Object.fromEntries(Object.entries(apiDocumentTypes).map(([type, apiType]) => [apiType, type])) as Record<ApiDocumentNumberingType, DocumentNumberingType>

function cacheDocumentNumbering(rules: ApiDocumentNumberingRule[]) {
  const nextCache = { ...defaultDocumentNumbering }
  const nextVersions = { ...numberingVersions }
  for (const rule of rules) {
    const type = appDocumentTypes[rule.documentType]
    if (!type) continue
    nextCache[type] = { prefix: rule.prefix, startingNumber: rule.startingNumber, digits: rule.digits, includeYear: rule.includeYear, resetYearly: rule.resetYearly }
    nextVersions[type] = rule.version
  }
  numberingCache = nextCache
  numberingVersions = nextVersions
}

export async function hydrateSettingsCache() {
  const [company, documents, numbering] = await Promise.all([getCompanySettings(), getDocumentDefaults(), getDocumentNumberingRules()])
  cacheCompany(company)
  cacheDocuments(documents)
  cacheDocumentNumbering(numbering)
  window.dispatchEvent(new Event('adiel:settings-changed'))
  return { company, documents, numbering }
}

export function loadCompanyProfile(): CompanyProfile { return { ...companyCache } }
export function loadDocumentDefaults(): DocumentDefaults { return { ...documentCache } }
export function loadLateChargePolicy(): LateChargePolicy { return { ...lateChargeCache } }
export function getCachedSettingsVersions() { return { companyVersion, documentVersion } }

export async function saveCompanyProfile(profile: CompanyProfile, version = companyVersion) {
  const saved = await updateCompanySettings({ ...profile, version })
  cacheCompany(saved)
  window.dispatchEvent(new Event('adiel:settings-changed'))
  return saved
}

export async function saveDocumentDefaults(defaults: DocumentDefaults, policy = lateChargeCache, version = documentVersion) {
  const saved = await updateDocumentDefaults({ ...defaults, lateChargeEnabled: policy.enabled, lateChargeGraceDays: policy.graceDays, lateChargeType: policy.type, lateChargeValue: policy.value, version })
  cacheDocuments(saved)
  window.dispatchEvent(new Event('adiel:settings-changed'))
  return saved
}

export async function saveLateChargePolicy(policy: LateChargePolicy, version = documentVersion) {
  return saveDocumentDefaults(documentCache, policy, version)
}

export function loadDocumentNumbering(): DocumentNumberingSettings {
  return {
    quotation: { ...numberingCache.quotation },
    purchaseOrder: { ...numberingCache.purchaseOrder },
    statementOfAccount: { ...numberingCache.statementOfAccount },
  }
}

export async function refreshDocumentNumbering() {
  cacheDocumentNumbering(await getDocumentNumberingRules())
  window.dispatchEvent(new Event('adiel:settings-changed'))
  return loadDocumentNumbering()
}

export async function saveDocumentNumbering(settings: DocumentNumberingSettings) {
  const saved = await updateDocumentNumberingRules((Object.keys(apiDocumentTypes) as DocumentNumberingType[]).map((type) => ({
    documentType: apiDocumentTypes[type],
    prefix: settings[type].prefix.trim().toUpperCase(),
    startingNumber: settings[type].startingNumber,
    digits: settings[type].digits,
    includeYear: settings[type].includeYear,
    resetYearly: settings[type].resetYearly,
    version: numberingVersions[type],
  })))
  cacheDocumentNumbering(saved)
  window.dispatchEvent(new Event('adiel:settings-changed'))
  return loadDocumentNumbering()
}

export async function previewDocumentNumber(type: DocumentNumberingType, date: string) {
  return (await getDocumentNumberPreview(apiDocumentTypes[type], date)).number
}

export async function reserveDocumentNumber(type: DocumentNumberingType, date: string) {
  return (await reserveDocumentNumberFromApi(apiDocumentTypes[type], date)).number
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
