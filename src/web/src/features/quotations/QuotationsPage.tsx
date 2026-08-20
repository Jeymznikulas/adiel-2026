import type { FormEvent } from 'react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { DocumentContentFormSectionPortal } from '../../components/ui/DocumentContentFields'
import { DocumentFormScaffold } from '../../components/ui/DocumentFormScaffold'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { VoidRecordDialog } from '../../components/ui/VoidRecordDialog'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { TableControls, useTableView } from '../../components/ui/TableControls'
import { usePersistentState } from '../../components/ui/usePersistentState'
import { appendSystemLog } from '../../services/activityLog'
import { isActiveRecord, notifyLifecycleChanged, withArchived, withVoided } from '../../services/recordLifecycle'
import { PurchaseOrderClientPickerDialog } from '../purchase-orders/PurchaseOrderClientPickerDialog'
import { loadDocumentDefaults, nextDocumentNumber } from '../settings/settingsStorage'
import { QuotationPricingDialog, type QuotationFeeDraft } from './QuotationPricingDialog'
import { QuotationPricingFormSectionPortal } from './QuotationPricingFormSection'
import { QuotationProfile } from './QuotationProfile'
import { QuotationApprovalDialog } from './QuotationApprovalDialog'

export type QuotationStatus = 'Draft' | 'For Approval' | 'Approved' | 'Rejected' | 'Voided'
type ClientContact = { id: string; name: string; email: string; phone: string }
type Client = { id: string; name: string; status: string; address: string; industry: string; contactPerson: string; email: string; phone: string; contacts: ClientContact[] }
type CatalogVariant = { id: string; name: string; value: string; photo: string; productCode: string; unitOfMeasure: string; status: string; rawCost: number; sellingPrice: number }
type CatalogItem = { id: string; photo: string; name: string; category: string; brand: string; unitOfMeasure: string; productCode: string; status: string; rawCost: number; sellingPrice: number; variants: CatalogVariant[] }

export type QuotationLine = {
  id: string
  itemId: string
  variantId: string
  photo: string
  itemName: string
  variantLabel: string
  productCode: string
  unitOfMeasure: string
  quantity: number
  unitPrice: number
  unitCost: number
}

export type QuotationCharge = { id: string; label: string; amount: number }

export type Quotation = {
  id: string
  dateCreated: string
  quotationNumber: string
  clientId: string
  clientName: string
  contactId: string
  contactPerson: string
  subject: string
  projectLocation: string
  leadTime: string
  notes: string
  terms: string
  items: QuotationLine[]
  subtotalAmount: number
  vatEnabled: boolean
  vatAmount: number
  otherCharges: QuotationCharge[]
  totalAmount: number
  estimatedProfit: number
  status: QuotationStatus
  approvedAt: string
  createdAt: string
  updatedAt: string
}

type QuotationDraft = Omit<Quotation, 'id' | 'items' | 'subtotalAmount' | 'vatAmount' | 'otherCharges' | 'totalAmount' | 'estimatedProfit' | 'approvedAt' | 'createdAt' | 'updatedAt'> & {
  items: Array<Omit<QuotationLine, 'quantity' | 'unitPrice'> & { quantity: string; unitPrice: string }>
  otherCharges: QuotationFeeDraft[]
}

type QuotationsPageProps = { currentUsername: string }
type QuotationViewMode = 'table' | 'cards'

const storageKey = 'adiel.quotations'
const clientStorageKey = 'adiel.clients'
const itemStorageKey = 'adiel.items'
const statuses: QuotationStatus[] = ['Draft', 'For Approval', 'Approved', 'Rejected', 'Voided']
const statusOptions = [
  { value: 'Draft' as const, dotClassName: 'bg-slate-400', toneClassName: 'border-slate-200 bg-slate-100 text-slate-600' },
  { value: 'For Approval' as const, dotClassName: 'bg-amber-500', toneClassName: 'border-amber-100 bg-amber-50 text-amber-700' },
  { value: 'Approved' as const, dotClassName: 'bg-emerald-500', toneClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  { value: 'Rejected' as const, dotClassName: 'bg-red-500', toneClassName: 'border-red-100 bg-red-50 text-red-600' },
  { value: 'Voided' as const, dotClassName: 'bg-slate-500', toneClassName: 'border-slate-200 bg-slate-100 text-slate-600' },
]
const formStatusOptions = statusOptions.filter((option) => option.value === 'Draft')
const filterOptions = [{ value: 'All statuses' }, ...statusOptions]
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function ProductPhoto({ photo, name, className = 'size-11' }: { photo: string; name: string; className?: string }) {
  return photo ? <img className={`${className} shrink-0 object-cover`} src={photo} alt="" /> : <span className={`${className} grid shrink-0 place-items-center bg-[linear-gradient(145deg,#eef3fb,#e3eaf5)] text-[10px] font-extrabold text-brand-blue`}>{name.split(/\s+/).map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'IT'}</span>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function statusTone(status: QuotationStatus) {
  if (status === 'Approved') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'Rejected') return 'border-red-100 bg-red-50 text-red-600'
  if (status === 'Voided') return 'border-slate-200 bg-slate-100 text-slate-600'
  return 'border-amber-100 bg-amber-50 text-amber-700'
}

function RejectionReasonDialog({ quotationNumber, onClose, onConfirm }: { quotationNumber: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quotation-rejection-title"><button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close rejection dialog" /><form className="relative w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) onConfirm(reason.trim()) }}><header className="border-b border-slate-100 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-500">Approval decision</p><h2 className="mt-1.5 text-lg font-extrabold text-brand-blue" id="quotation-rejection-title">Reject {quotationNumber}</h2><p className="mt-1 text-xs leading-5 text-slate-400">Add a clear reason so the quotation can be corrected and resubmitted.</p></header><div className="p-5"><label className={labelClassName} htmlFor="quotation-rejection-reason">Reason for rejection</label><textarea className="min-h-28 w-full resize-y rounded-xl border border-slate-200 p-3.5 text-sm text-brand-blue outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50" id="quotation-rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Revise the delivery cost and payment terms." autoFocus required /></div><footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-white" type="button" onClick={onClose}>Cancel</button><button className="h-10 rounded-xl bg-red-600 px-5 text-xs font-bold text-white disabled:opacity-40" type="submit" disabled={!reason.trim()}>Reject quotation</button></footer></form></div>
}

function QuotationCard({ quotation, index, onEdit, onView }: { quotation: Quotation; index: number; onEdit: () => void; onView: () => void }) {
  const margin = quotation.subtotalAmount ? (quotation.estimatedProfit / quotation.subtotalAmount) * 100 : 0
  const warningCount = Number(quotation.items.some((item) => item.unitPrice === 0)) + Number(quotation.estimatedProfit < 0)

  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_14px_34px_-28px_rgba(0,20,76,0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-blue/15 hover:shadow-[0_20px_40px_-28px_rgba(0,20,76,0.42)] animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}>
    <div className="flex-1 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-extrabold text-brand-blue">{quotation.quotationNumber}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">Created {formatDate(quotation.dateCreated)}</p></div><span className={`inline-flex shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold ${statusTone(quotation.status)}`}>{quotation.status}</span></div>
      <div className="mt-4 border-t border-slate-100 pt-4"><h3 className="truncate text-sm font-extrabold text-slate-700">{quotation.clientName}</h3><p className="mt-1 truncate text-[10px] text-slate-400">{quotation.contactPerson || 'No contact person'}</p><p className="mt-3 line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 text-slate-500">{quotation.subject || 'No quotation subject'}</p></div>
      <dl className="mt-4 grid grid-cols-3 gap-2"><div className="min-w-0 rounded-xl bg-blue-50/55 p-3"><dt className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">Total</dt><dd className="mt-1.5 truncate text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(quotation.totalAmount)}</dd></div><div className="min-w-0 rounded-xl bg-emerald-50/60 p-3"><dt className="text-[8px] font-bold uppercase tracking-[0.08em] text-emerald-600/70">Profit</dt><dd className={`mt-1.5 truncate text-xs font-extrabold tabular-nums ${quotation.estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPeso(quotation.estimatedProfit)}</dd></div><div className="min-w-0 rounded-xl bg-violet-50/60 p-3"><dt className="text-[8px] font-bold uppercase tracking-[0.08em] text-violet-600/70">Margin</dt><dd className={`mt-1.5 text-xs font-extrabold tabular-nums ${margin >= 0 ? 'text-violet-700' : 'text-red-600'}`}>{margin.toFixed(1)}%</dd></div></dl>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] font-semibold text-slate-400"><span>{quotation.items.length} line item{quotation.items.length === 1 ? '' : 's'}</span><span className="size-1 rounded-full bg-slate-300" /><span className="truncate">{quotation.leadTime || 'No lead time'}</span>{warningCount ? <><span className="size-1 rounded-full bg-amber-400" /><span className="font-bold text-amber-600">{warningCount} pricing warning{warningCount === 1 ? '' : 's'}</span></> : null}</div>
    </div>
    <footer className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/45 px-4 py-3 sm:px-5"><p className="truncate text-[9px] font-semibold text-slate-400">{quotation.status === 'For Approval' ? 'Waiting for review' : `Status: ${quotation.status}`}</p><div className="flex shrink-0 gap-1.5"><button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 transition hover:border-brand-blue/20 hover:bg-blue-50 hover:text-brand-blue" type="button" onClick={onEdit}><Icon className="size-3" path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />Edit</button><button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-blue px-3 text-[10px] font-bold text-white transition hover:-translate-y-0.5" type="button" onClick={onView}>View<Icon className="size-3" path="m9 18 6-6-6-6" /></button></div></footer>
  </article>
}

function loadClients(): Client[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(clientStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const saved = value as Partial<Client>
      if (typeof saved.id !== 'string' || typeof saved.name !== 'string') return []
      const contacts = Array.isArray(saved.contacts) ? saved.contacts.flatMap((contact) => typeof contact?.id === 'string' && typeof contact.name === 'string' ? [{ id: contact.id, name: contact.name, email: typeof contact.email === 'string' ? contact.email : '', phone: typeof contact.phone === 'string' ? contact.phone : '' }] : []) : []
      if (!contacts.length && typeof saved.contactPerson === 'string' && saved.contactPerson) contacts.push({ id: `${saved.id}-primary`, name: saved.contactPerson, email: typeof saved.email === 'string' ? saved.email : '', phone: typeof saved.phone === 'string' ? saved.phone : '' })
      const primary = contacts[0]
      return [{ id: saved.id, name: saved.name, status: typeof saved.status === 'string' ? saved.status : 'Active', address: typeof saved.address === 'string' ? saved.address : '', industry: typeof saved.industry === 'string' ? saved.industry : '', contactPerson: primary?.name ?? '', email: primary?.email ?? '', phone: primary?.phone ?? '', contacts }]
    }).sort((left, right) => left.name.localeCompare(right.name))
  } catch { return [] }
}

function loadItems(): CatalogItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(itemStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const saved = value as Partial<CatalogItem>
      if (typeof saved.id !== 'string' || typeof saved.name !== 'string') return []
      const baseUnit = typeof saved.unitOfMeasure === 'string' ? saved.unitOfMeasure : 'Piece'
      const baseCode = typeof saved.productCode === 'string' ? saved.productCode : ''
      const variants = Array.isArray(saved.variants) ? saved.variants.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const variant = entry as Partial<CatalogVariant>
        if (typeof variant.id !== 'string' || typeof variant.name !== 'string' || typeof variant.value !== 'string') return []
        return [{ id: variant.id, name: variant.name, value: variant.value, photo: typeof variant.photo === 'string' ? variant.photo : '', productCode: typeof variant.productCode === 'string' ? variant.productCode : baseCode, unitOfMeasure: typeof variant.unitOfMeasure === 'string' ? variant.unitOfMeasure : baseUnit, status: typeof variant.status === 'string' ? variant.status : 'Active', rawCost: typeof variant.rawCost === 'number' ? variant.rawCost : 0, sellingPrice: typeof variant.sellingPrice === 'number' ? variant.sellingPrice : 0 }]
      }) : []
      return [{ id: saved.id, photo: typeof saved.photo === 'string' ? saved.photo : '', name: saved.name, category: typeof saved.category === 'string' ? saved.category : '', brand: typeof saved.brand === 'string' ? saved.brand : '', unitOfMeasure: baseUnit, productCode: baseCode, status: typeof saved.status === 'string' ? saved.status : 'Active', rawCost: typeof saved.rawCost === 'number' ? saved.rawCost : 0, sellingPrice: typeof saved.sellingPrice === 'number' ? saved.sellingPrice : 0, variants }]
    }).sort((left, right) => left.name.localeCompare(right.name))
  } catch { return [] }
}

function loadQuotations(): Quotation[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const saved = value as Partial<Quotation>
      if (typeof saved.id !== 'string' || typeof saved.quotationNumber !== 'string' || !Array.isArray(saved.items)) return []
      const items = saved.items
      const subtotalAmount = items.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0)
      const vatEnabled = saved.vatEnabled === true
      const vatAmount = vatEnabled ? subtotalAmount * 0.12 : 0
      const otherCharges = Array.isArray(saved.otherCharges) ? saved.otherCharges.filter((charge): charge is QuotationCharge => typeof charge?.id === 'string' && typeof charge.label === 'string' && typeof charge.amount === 'number') : []
      const totalAmount = subtotalAmount + vatAmount + otherCharges.reduce((total, charge) => total + charge.amount, 0)
      const estimatedProfit = items.reduce((total, line) => total + (Number(line.quantity) || 0) * ((Number(line.unitPrice) || 0) - (Number(line.unitCost) || 0)), 0)
      const status = statuses.includes(saved.status as QuotationStatus) ? saved.status as QuotationStatus : 'For Approval'
      return [{ ...(saved as Quotation), dateCreated: typeof saved.dateCreated === 'string' ? saved.dateCreated : new Date().toISOString().slice(0, 10), clientId: typeof saved.clientId === 'string' ? saved.clientId : '', contactId: typeof saved.contactId === 'string' ? saved.contactId : '', subject: typeof saved.subject === 'string' ? saved.subject : '', projectLocation: typeof saved.projectLocation === 'string' ? saved.projectLocation : '', leadTime: typeof saved.leadTime === 'string' ? saved.leadTime : '', notes: typeof saved.notes === 'string' ? saved.notes : '', terms: typeof saved.terms === 'string' ? saved.terms : loadDocumentDefaults().quotationTerms, status, approvedAt: typeof saved.approvedAt === 'string' ? saved.approvedAt : status === 'Approved' && typeof saved.updatedAt === 'string' ? saved.updatedAt : '', items, subtotalAmount, vatEnabled, vatAmount, otherCharges, totalAmount, estimatedProfit }]
    })
  } catch { return [] }
}

function quotationIsInActiveStatement(quotationId: string) {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem('adiel.statements-of-account') ?? '[]')
    if (!Array.isArray(parsed)) return false
    return parsed.some((value) => {
      if (typeof value !== 'object' || value === null) return false
      const statement = value as { status?: string; quotations?: Array<{ id?: string }> }
      return statement.status !== 'Cancelled' && Array.isArray(statement.quotations) && statement.quotations.some((quotation) => quotation.id === quotationId)
    })
  } catch {
    return false
  }
}

function emptyDraft(): QuotationDraft {
  return { dateCreated: new Date().toISOString().slice(0, 10), quotationNumber: '', clientId: '', clientName: '', contactId: '', contactPerson: '', subject: '', projectLocation: '', leadTime: '', notes: '', terms: '', items: [], vatEnabled: false, otherCharges: [], status: 'Draft' }
}

function quotationDraftFrom(quotation: Quotation, clients: Client[]): QuotationDraft {
  const client = clients.find((entry) => entry.id === quotation.clientId) ?? clients.find((entry) => entry.name.toLowerCase() === quotation.clientName.toLowerCase())
  const contact = client?.contacts.find((entry) => entry.id === quotation.contactId) ?? client?.contacts.find((entry) => entry.name === quotation.contactPerson)
  return { dateCreated: quotation.dateCreated, quotationNumber: quotation.quotationNumber, clientId: client?.id ?? '', clientName: quotation.clientName, contactId: contact?.id ?? '', contactPerson: quotation.contactPerson, subject: quotation.subject, projectLocation: quotation.projectLocation, leadTime: quotation.leadTime, notes: quotation.notes, terms: quotation.terms, items: quotation.items.map((line) => ({ ...line, quantity: String(line.quantity), unitPrice: String(line.unitPrice) })), vatEnabled: quotation.vatEnabled, otherCharges: quotation.otherCharges.map((charge) => ({ ...charge, amount: String(charge.amount) })), status: quotation.status }
}

export function QuotationsPage({ currentUsername }: QuotationsPageProps) {
  const [quotations, setQuotations] = useState<Quotation[]>(loadQuotations)
  const [clients, setClients] = useState<Client[]>(loadClients)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(loadItems)
  const initialQuery = new URLSearchParams(window.location.search)
  const openNewFromQuery = initialQuery.get('new') === '1'
  const openNewOnLoad = openNewFromQuery || window.location.pathname === '/quotations/new'
  const editQuotationIdOnLoad = /^\/quotations\/([^/]+)\/edit$/.exec(window.location.pathname)?.[1]
  const editQuotationOnLoad = editQuotationIdOnLoad ? quotations.find((quotation) => quotation.id === decodeURIComponent(editQuotationIdOnLoad) && quotation.status !== 'Approved') : undefined
  const reviewQuotationIdOnLoad = initialQuery.get('review') === '1' ? window.location.pathname.match(/^\/quotations\/([^/]+)$/)?.[1] : undefined
  const [draft, setDraft] = useState<QuotationDraft>(() => {
    if (editQuotationOnLoad) return quotationDraftFrom(editQuotationOnLoad, clients)
    const values = emptyDraft()
    if (!openNewOnLoad) return values
    const client = clients.find((entry) => entry.status === 'Active') ?? clients[0]
    values.quotationNumber = nextDocumentNumber('quotation', quotations.map((quotation) => quotation.quotationNumber), values.dateCreated)
    if (client) {
      values.clientId = client.id
      values.clientName = client.name
      values.contactId = client.contacts[0]?.id ?? ''
      values.contactPerson = client.contacts[0]?.name ?? ''
    }
    return values
  })
  const [editingId, setEditingId] = useState<string | null>(editQuotationOnLoad?.id ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(openNewOnLoad || Boolean(editQuotationOnLoad))
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(openNewOnLoad && !clients.some((entry) => entry.status === 'Active'))
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false)
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [search, setSearch] = usePersistentState('quotations.search', '')
  const [viewMode, setViewMode] = usePersistentState<QuotationViewMode>('quotations.view-mode', window.matchMedia('(max-width: 767px)').matches ? 'cards' : 'table', 'local')
  const [itemSearch, setItemSearch] = useState('')
  const [statusFilter, setStatusFilter] = usePersistentState('quotations.status', 'All statuses')
  const [formError, setFormError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [toast, setToast] = useState('')
  const [approvalReviewId, setApprovalReviewId] = useState<string | null>(() => reviewQuotationIdOnLoad ? decodeURIComponent(reviewQuotationIdOnLoad) : null)
  const [pendingRejectQuotationId, setPendingRejectQuotationId] = useState<string | null>(null)
  const [pendingVoidQuotationId, setPendingVoidQuotationId] = useState<string | null>(null)

  useEffect(() => {
    if (openNewFromQuery) {
      window.history.replaceState(null, '', '/quotations/new')
      setCurrentPath('/quotations/new')
      window.dispatchEvent(new Event('adiel:navigate'))
    } else if (reviewQuotationIdOnLoad) window.history.replaceState(null, '', window.location.pathname)
  }, [openNewFromQuery, reviewQuotationIdOnLoad])

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(quotations)); setStorageError('') }
    catch { setStorageError('Quotations could not be saved in browser storage.') }
  }, [quotations])

  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === clientStorageKey) setClients(loadClients())
      if (event.key === itemStorageKey) setCatalogItems(loadItems())
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', syncPath)
    window.addEventListener('adiel:navigate', syncPath)
    return () => {
      window.removeEventListener('popstate', syncPath)
      window.removeEventListener('adiel:navigate', syncPath)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!selectedId && !isPricingDialogOpen && !approvalReviewId && !isClientPickerOpen && !isItemPickerOpen) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [approvalReviewId, isClientPickerOpen, isItemPickerOpen, isPricingDialogOpen, selectedId])

  useLayoutEffect(() => {
    if (!selectedId) return
    window.history.pushState(null, '', `/quotations/${encodeURIComponent(selectedId)}`)
    window.dispatchEvent(new Event('adiel:navigate'))
    setSelectedId(null)
  }, [selectedId])

  const selectedClient = clients.find((client) => client.id === draft.clientId)
  const selectedQuotation = selectedId ? quotations.find((quotation) => quotation.id === selectedId) : undefined
  const encodedRouteQuotationId = /^\/quotations\/([^/]+)$/.exec(currentPath)?.[1]
  const routeQuotationId = encodedRouteQuotationId ? decodeURIComponent(encodedRouteQuotationId) : undefined
  const routeQuotation = routeQuotationId ? quotations.find((quotation) => quotation.id === routeQuotationId && isActiveRecord(quotation)) : undefined
  const approvalQuotation = approvalReviewId ? quotations.find((quotation) => quotation.id === approvalReviewId) : undefined
  const contactOptions = selectedClient?.contacts.length ? selectedClient.contacts.map((contact) => ({ value: contact.id, label: `${contact.name}${contact.phone ? ` · ${contact.phone}` : ''}` })) : [{ value: '', label: 'No contacts registered' }]
  const availableItems = useMemo(() => catalogItems.filter((item) => item.status === 'Active'), [catalogItems])
  const visibleCatalogItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase()
    return availableItems.filter((item) => !query || [item.name, item.productCode, item.category, item.brand].some((value) => value.toLowerCase().includes(query)))
  }, [availableItems, itemSearch])
  const draftSubtotal = draft.items.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0)
  const draftVatAmount = draft.vatEnabled ? draftSubtotal * 0.12 : 0
  const draftOtherChargesTotal = draft.otherCharges.reduce((total, charge) => total + (Number(charge.amount) || 0), 0)
  const draftTotal = draftSubtotal + draftVatAmount + draftOtherChargesTotal
  const draftProfit = draft.items.reduce((total, line) => total + (Number(line.quantity) || 0) * ((Number(line.unitPrice) || 0) - line.unitCost), 0)
  const draftMargin = draftSubtotal ? (draftProfit / draftSubtotal) * 100 : 0
  const activeQuotations = useMemo(() => quotations.filter(isActiveRecord), [quotations])
  const financialQuotations = useMemo(() => activeQuotations.filter((quotation) => quotation.status !== 'Voided'), [activeQuotations])

  const filteredQuotations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activeQuotations.filter((quotation) => (!query || [quotation.quotationNumber, quotation.clientName, quotation.contactPerson, quotation.subject, quotation.projectLocation].some((value) => value.toLowerCase().includes(query))) && (statusFilter === 'All statuses' || quotation.status === statusFilter)).sort((left, right) => right.dateCreated.localeCompare(left.dateCreated) || right.createdAt.localeCompare(left.createdAt))
  }, [activeQuotations, search, statusFilter])
  const quotationSortOptions = [
    { value: 'newest', label: 'Newest first', getValue: (quotation: Quotation) => quotation.dateCreated, direction: 'desc' as const },
    { value: 'oldest', label: 'Oldest first', getValue: (quotation: Quotation) => quotation.dateCreated, direction: 'asc' as const },
    { value: 'highest', label: 'Highest amount', getValue: (quotation: Quotation) => quotation.totalAmount, direction: 'desc' as const },
    { value: 'client', label: 'Client A-Z', getValue: (quotation: Quotation) => quotation.clientName, direction: 'asc' as const },
    { value: 'status', label: 'Status A-Z', getValue: (quotation: Quotation) => quotation.status, direction: 'asc' as const },
  ]
  const quotationTable = useTableView({ rows: filteredQuotations, storageKey: 'quotations.table', sortOptions: quotationSortOptions })
  const visibleQuotations = quotationTable.pageRows

  function makeQuotationNumber(date: string) {
    return nextDocumentNumber('quotation', quotations.map((quotation) => quotation.quotationNumber), date)
  }

  function openQuotationFormPage(path: string) {
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    window.dispatchEvent(new Event('adiel:navigate'))
  }

  function closeQuotationFormPage() {
    setIsFormOpen(false)
    setIsClientPickerOpen(false)
    setIsItemPickerOpen(false)
    window.history.replaceState(null, '', '/quotations')
    setCurrentPath('/quotations')
    window.dispatchEvent(new Event('adiel:navigate'))
  }

  function openNewQuotation() {
    const values = emptyDraft()
    const client = clients.find((entry) => entry.status === 'Active') ?? clients[0]
    values.quotationNumber = makeQuotationNumber(values.dateCreated)
    if (client) {
      values.clientId = client.id
      values.clientName = client.name
      values.contactId = client.contacts[0]?.id ?? ''
      values.contactPerson = client.contacts[0]?.name ?? ''
    }
    setDraft(values)
    setEditingId(null)
    setFormError('')
    setItemSearch('')
    setIsPricingDialogOpen(false)
    setIsFormOpen(true)
    setIsClientPickerOpen(!client)
    openQuotationFormPage('/quotations/new')
  }

  function openEditQuotation(quotation: Quotation) {
    if (quotation.status === 'Approved') {
      setToast(quotationIsInActiveStatement(quotation.id) ? 'This approved quotation is locked because it is already included in an SOA.' : 'Return this quotation to For Approval before editing it.')
      return
    }
    setDraft(quotationDraftFrom(quotation, clients))
    setEditingId(quotation.id)
    setSelectedId(null)
    setFormError('')
    setItemSearch('')
    setIsPricingDialogOpen(false)
    setIsFormOpen(true)
    openQuotationFormPage(`/quotations/${encodeURIComponent(quotation.id)}/edit`)
  }

  function duplicateQuotation(quotation: Quotation) {
    const dateCreated = new Date().toISOString().slice(0, 10)
    setDraft({ dateCreated, quotationNumber: makeQuotationNumber(dateCreated), clientId: quotation.clientId, clientName: quotation.clientName, contactId: quotation.contactId, contactPerson: quotation.contactPerson, subject: quotation.subject, projectLocation: quotation.projectLocation, leadTime: quotation.leadTime, notes: quotation.notes, terms: quotation.terms, items: quotation.items.map((line) => ({ ...line, id: crypto.randomUUID(), quantity: String(line.quantity), unitPrice: String(line.unitPrice) })), vatEnabled: quotation.vatEnabled, otherCharges: quotation.otherCharges.map((charge) => ({ ...charge, id: crypto.randomUUID(), amount: String(charge.amount) })), status: 'Draft' })
    setEditingId(null)
    setFormError('')
    setItemSearch('')
    setIsClientPickerOpen(false)
    setIsItemPickerOpen(false)
    setIsPricingDialogOpen(false)
    setIsFormOpen(true)
    openQuotationFormPage('/quotations/new')
  }

  function backToQuotationRegister() {
    window.history.pushState(null, '', '/quotations')
    window.dispatchEvent(new Event('adiel:navigate'))
  }

  function selectClient(clientId: string) {
    const client = clients.find((entry) => entry.id === clientId)
    if (!client) return
    const contact = client.contacts[0]
    setDraft((current) => ({ ...current, clientId: client.id, clientName: client.name, contactId: contact?.id ?? '', contactPerson: contact?.name ?? '' }))
    setIsClientPickerOpen(false)
    setFormError('')
  }

  function selectContact(contactId: string) {
    const contact = selectedClient?.contacts.find((entry) => entry.id === contactId)
    setDraft((current) => ({ ...current, contactId, contactPerson: contact?.name ?? '' }))
  }

  function addCatalogItem(item: CatalogItem) {
    const usedVariantIds = new Set(draft.items.filter((line) => line.itemId === item.id).map((line) => line.variantId))
    const variant = item.variants.find((entry) => entry.status === 'Active' && !usedVariantIds.has(entry.id))
    const useBase = !variant && !usedVariantIds.has('')
    if (!variant && !useBase) { setToast('All available options for this item are already added'); return }
    setDraft((current) => ({ ...current, items: [...current.items, { id: crypto.randomUUID(), itemId: item.id, variantId: variant?.id ?? '', photo: variant?.photo || item.photo, itemName: item.name, variantLabel: variant ? `${variant.name}: ${variant.value}` : '', productCode: variant?.productCode || item.productCode, unitOfMeasure: variant?.unitOfMeasure || item.unitOfMeasure, quantity: '1', unitPrice: String(variant?.sellingPrice ?? item.sellingPrice), unitCost: variant?.rawCost ?? item.rawCost }] }))
    setFormError('')
  }

  function selectLineVariant(lineId: string, variantId: string) {
    setDraft((current) => ({ ...current, items: current.items.map((line) => {
      if (line.id !== lineId) return line
      const item = availableItems.find((entry) => entry.id === line.itemId)
      const variant = item?.variants.find((entry) => entry.id === variantId)
      return variant ? { ...line, variantId, photo: variant.photo || item?.photo || '', variantLabel: `${variant.name}: ${variant.value}`, productCode: variant.productCode || item?.productCode || '', unitOfMeasure: variant.unitOfMeasure || item?.unitOfMeasure || 'Piece', unitPrice: String(variant.sellingPrice), unitCost: variant.rawCost } : { ...line, variantId: '', photo: item?.photo || '', variantLabel: '', productCode: item?.productCode || '', unitOfMeasure: item?.unitOfMeasure || 'Piece', unitPrice: String(item?.sellingPrice ?? 0), unitCost: item?.rawCost ?? 0 }
    }) }))
  }

  function saveQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const intent = submitter instanceof HTMLButtonElement ? submitter.dataset.intent : 'draft'
    const targetStatus: QuotationStatus = intent === 'submit' ? 'For Approval' : 'Draft'
    const client = clients.find((entry) => entry.id === draft.clientId)
    const contact = client?.contacts.find((entry) => entry.id === draft.contactId)
    if (targetStatus === 'For Approval' && (!client || !contact || !draft.subject.trim() || !draft.projectLocation.trim() || !draft.leadTime.trim() || !draft.items.length || draft.items.some((line) => Number(line.quantity) <= 0 || Number(line.unitPrice) < 0) || draft.otherCharges.some((charge) => !charge.label.trim() || Number(charge.amount) <= 0))) {
      setFormError('Complete the client, contact person, subject, project location, lead time, valid items, and every additional fee before submitting for approval. You can save the incomplete quotation as a draft.')
      return
    }
    const previous = editingId ? quotations.find((quotation) => quotation.id === editingId) : undefined
    const now = new Date().toISOString()
    const values: Quotation = { id: previous?.id ?? crypto.randomUUID(), dateCreated: draft.dateCreated, quotationNumber: draft.quotationNumber, clientId: client?.id ?? draft.clientId, clientName: client?.name ?? draft.clientName, contactId: contact?.id ?? draft.contactId, contactPerson: contact?.name ?? draft.contactPerson, subject: draft.subject.trim(), projectLocation: draft.projectLocation.trim(), leadTime: draft.leadTime.trim(), notes: draft.notes.trim(), terms: draft.terms.trim(), items: draft.items.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })), subtotalAmount: draftSubtotal, vatEnabled: draft.vatEnabled, vatAmount: draftVatAmount, otherCharges: draft.otherCharges.map((charge) => ({ ...charge, label: charge.label.trim(), amount: Number(charge.amount) })), totalAmount: draftTotal, estimatedProfit: draftProfit, status: targetStatus, approvedAt: '', createdAt: previous?.createdAt ?? now, updatedAt: now }
    setQuotations((current) => previous ? current.map((quotation) => quotation.id === previous.id ? values : quotation) : [values, ...current])
    appendSystemLog({ recordId: values.id, module: 'Quotations', action: previous ? 'Updated' : 'Created', entity: values.quotationNumber, description: `${previous ? 'Quotation updated' : 'Quotation created'} for ${values.clientName}.`, actor: currentUsername, tone: previous ? 'info' : 'success', amount: values.totalAmount, status: values.status })
    closeQuotationFormPage()
    setEditingId(null)
    setToast(targetStatus === 'For Approval' ? 'Quotation submitted for approval' : previous ? 'Quotation draft updated' : 'Quotation saved as draft')
  }

  function updateStatus(quotation: Quotation, status: QuotationStatus) {
    if (quotation.status === status) return
    if (status === 'Voided') {
      if (quotation.status === 'Approved' && quotationIsInActiveStatement(quotation.id)) {
        setToast('This quotation cannot be voided while it is included in an active SOA.')
        return
      }
      setPendingVoidQuotationId(quotation.id)
      return
    }
    if (status === 'Approved') {
      setApprovalReviewId(quotation.id)
      return
    }
    if (status === 'Rejected') {
      setPendingRejectQuotationId(quotation.id)
      return
    }
    if (quotation.status === 'Approved' && quotationIsInActiveStatement(quotation.id)) {
      setToast('This quotation is locked because it is already included in an active SOA.')
      return
    }
    setQuotations((current) => current.map((entry) => entry.id === quotation.id ? { ...entry, status, approvedAt: '', updatedAt: new Date().toISOString() } : entry))
    appendSystemLog({ recordId: quotation.id, module: 'Quotations', action: 'Status changed', entity: quotation.quotationNumber, description: `Quotation status changed from ${quotation.status} to ${status}.`, actor: currentUsername, tone: 'warning', amount: quotation.totalAmount, status })
    setToast(`Quotation marked ${status.toLowerCase()}`)
  }

  function approveQuotation(quotation: Quotation) {
    if (quotation.status === 'Approved') { setApprovalReviewId(null); return }
    const approvedAt = new Date().toISOString()
    setQuotations((current) => current.map((entry) => entry.id === quotation.id ? { ...entry, status: 'Approved', approvedAt, updatedAt: approvedAt } : entry))
    appendSystemLog({ recordId: quotation.id, module: 'Quotations', action: 'Status changed', entity: quotation.quotationNumber, description: `All ${quotation.items.length} quotation items were verified, approved, and locked for ${quotation.clientName}.`, actor: currentUsername, tone: 'success', amount: quotation.totalAmount, status: 'Approved' })
    setApprovalReviewId(null)
    setToast('Quotation approved and locked successfully.')
  }

  function rejectQuotation(reason: string) {
    const quotation = quotations.find((entry) => entry.id === pendingRejectQuotationId)
    if (!quotation) return
    const updatedAt = new Date().toISOString()
    setQuotations((current) => current.map((entry) => entry.id === quotation.id ? { ...entry, status: 'Rejected', approvedAt: '', updatedAt } : entry))
    appendSystemLog({ recordId: quotation.id, module: 'Quotations', action: 'Status changed', entity: quotation.quotationNumber, description: `Quotation rejected. Reason: ${reason}`, actor: currentUsername, tone: 'danger', amount: quotation.totalAmount, status: 'Rejected' })
    setPendingRejectQuotationId(null)
    setToast('Quotation rejected with a recorded reason')
  }

  function confirmVoidQuotation(reason: string, archiveAfterVoiding: boolean) {
    const quotation = quotations.find((entry) => entry.id === pendingVoidQuotationId)
    if (!quotation) return
    setQuotations((current) => current.map((entry) => entry.id === quotation.id ? (archiveAfterVoiding ? withArchived(withVoided({ ...entry, status: 'Voided' as const, approvedAt: '', updatedAt: new Date().toISOString() }, currentUsername, reason), currentUsername) : withVoided({ ...entry, status: 'Voided' as const, approvedAt: '', updatedAt: new Date().toISOString() }, currentUsername, reason)) : entry))
    notifyLifecycleChanged()
    appendSystemLog({ recordId: quotation.id, module: 'Quotations', action: 'Voided', entity: quotation.quotationNumber, description: `Quotation voided: ${reason}${archiveAfterVoiding ? ' It was archived after voiding.' : ''}`, actor: currentUsername, tone: 'danger', amount: quotation.totalAmount, status: 'Voided' })
    setPendingVoidQuotationId(null)
    setToast(archiveAfterVoiding ? 'Quotation voided and archived' : 'Quotation voided')
    if (archiveAfterVoiding) backToQuotationRegister()
  }

  function archiveQuotation(quotation: Quotation) {
    setQuotations((current) => current.map((entry) => entry.id === quotation.id ? withArchived(entry, currentUsername) : entry))
    notifyLifecycleChanged()
    appendSystemLog({ recordId: quotation.id, module: 'Quotations', action: 'Archived', entity: quotation.quotationNumber, description: 'Quotation was archived with its client and SOA links retained.', actor: currentUsername, tone: 'info', amount: quotation.totalAmount, status: quotation.status })
    setToast('Quotation archived')
    backToQuotationRegister()
  }

  function removeUnapprovedQuotationItems(quotation: Quotation, itemIds: string[]) {
    const removedIds = new Set(itemIds)
    const removedItems = quotation.items.filter((item) => removedIds.has(item.id))
    const remainingItems = quotation.items.filter((item) => !removedIds.has(item.id))
    if (!removedItems.length) return
    if (!remainingItems.length) {
      setToast('A quotation must retain at least one item.')
      return
    }
    const subtotalAmount = remainingItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
    const vatAmount = quotation.vatEnabled ? subtotalAmount * 0.12 : 0
    const chargesTotal = quotation.otherCharges.reduce((total, charge) => total + charge.amount, 0)
    const totalAmount = subtotalAmount + vatAmount + chargesTotal
    const estimatedProfit = remainingItems.reduce((total, item) => total + item.quantity * (item.unitPrice - item.unitCost), 0)
    const updatedAt = new Date().toISOString()
    setQuotations((current) => current.map((entry) => entry.id === quotation.id ? { ...entry, items: remainingItems, subtotalAmount, vatAmount, totalAmount, estimatedProfit, status: 'For Approval', approvedAt: '', updatedAt } : entry))
    const removedNames = removedItems.map((item) => item.variantLabel ? `${item.itemName} (${item.variantLabel})` : item.itemName).join(', ')
    appendSystemLog({ recordId: quotation.id, module: 'Quotations', action: 'Updated', entity: quotation.quotationNumber, description: `${removedItems.length} unapproved item${removedItems.length === 1 ? '' : 's'} removed during final review: ${removedNames}. Total revised from ${formatPeso(quotation.totalAmount)} to ${formatPeso(totalAmount)}.`, actor: currentUsername, tone: 'warning', amount: totalAmount, status: 'For Approval' })
    setToast(`${removedItems.length} unapproved item${removedItems.length === 1 ? '' : 's'} removed and totals recalculated.`)
  }

  const approvalDialog = approvalQuotation ? <QuotationApprovalDialog quotation={approvalQuotation} onClose={() => setApprovalReviewId(null)} onEdit={() => { setApprovalReviewId(null); openEditQuotation(approvalQuotation) }} onApprove={() => approveQuotation(approvalQuotation)} onRemoveItems={(itemIds) => removeUnapprovedQuotationItems(approvalQuotation, itemIds)} /> : null

  const summaryCards = [
    { label: 'Total quotations', value: activeQuotations.length, color: 'text-brand-blue', dot: 'bg-brand-blue' },
    { label: 'Quoted amount', value: formatPeso(financialQuotations.reduce((total, quotation) => total + quotation.totalAmount, 0)), color: 'text-violet-700', dot: 'bg-violet-500' },
    { label: 'Est. net profit', value: formatPeso(financialQuotations.reduce((total, quotation) => total + quotation.estimatedProfit, 0)), color: 'text-emerald-700', dot: 'bg-emerald-500' },
    { label: 'Approved', value: activeQuotations.filter((quotation) => quotation.status === 'Approved').length, color: 'text-emerald-600', dot: 'bg-emerald-500' },
    { label: 'For approval', value: activeQuotations.filter((quotation) => quotation.status === 'For Approval').length, color: 'text-amber-600', dot: 'bg-amber-500' },
    { label: 'Rejected', value: activeQuotations.filter((quotation) => quotation.status === 'Rejected').length, color: 'text-red-600', dot: 'bg-red-500' },
  ]

  if (routeQuotation && !isFormOpen) return <><QuotationProfile quotation={routeQuotation} onBack={backToQuotationRegister} onEdit={() => openEditQuotation(routeQuotation)} onDuplicate={() => duplicateQuotation(routeQuotation)} onArchive={() => archiveQuotation(routeQuotation)} onStatusChange={(status) => updateStatus(routeQuotation, status)} onCreateStatement={() => { window.history.pushState(null, '', `/statement-of-account?new=1\u0026quotationId=${encodeURIComponent(routeQuotation.id)}`); window.dispatchEvent(new Event('adiel:navigate')) }} />{approvalDialog}{pendingRejectQuotationId ? <RejectionReasonDialog quotationNumber={quotations.find((entry) => entry.id === pendingRejectQuotationId)?.quotationNumber ?? 'quotation'} onClose={() => setPendingRejectQuotationId(null)} onConfirm={rejectQuotation} /> : null}{pendingVoidQuotationId ? <VoidRecordDialog recordLabel="quotation" onClose={() => setPendingVoidQuotationId(null)} onConfirm={confirmVoidQuotation} /> : null}<SuccessToast message={toast} /></>

  if (routeQuotationId && !routeQuotation && !isFormOpen) return <div className="grid min-h-[28rem] place-items-center text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-300"><Icon className="size-6" path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6" /></span><h2 className="mt-4 text-xl font-extrabold text-brand-blue">Quotation not found</h2><p className="mt-2 text-xs text-slate-400">This quotation may no longer be available.</p><button className="mt-5 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={backToQuotationRegister}>Back to quotations</button></div></div>

  return <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center" aria-label="Quotation summary">
      <div><div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Client quotations</p></div><h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Quotations</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Create quotations, check approvals, and see expected profit before work starts.</p></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{summaryCards.map((card, index) => <article className="min-w-28 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3.5 shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] transition duration-300 hover:-translate-y-1 hover:border-brand-blue/15" style={{ animationDelay: `${index * 45}ms` }} key={card.label}><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${card.dot}`} /><p className="truncate text-[9px] font-bold uppercase tracking-[0.06em] text-slate-500">{card.label}</p></div><p className={`mt-2 truncate text-lg font-extrabold tracking-[-0.035em] ${card.color}`}>{card.value}</p></article>)}</div>
    </SummarySurface>
    {storageError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{storageError}</div> : null}

    <TableControls tableId="quotations-table" storageKey="quotations.table" columns={viewMode === 'table' ? [{ index: 1, label: 'Date' }, { index: 2, label: 'Quotation number', required: true }, { index: 3, label: 'Client' }, { index: 4, label: 'Status' }, { index: 5, label: 'Total amount' }, { index: 6, label: 'Estimated profit' }, { index: 7, label: 'Actions', required: true }] : []} sortKey={quotationTable.sortKey} sortOptions={quotationSortOptions} onSortChange={quotationTable.setSortKey} page={quotationTable.page} pageCount={quotationTable.pageCount} pageSize={quotationTable.pageSize} itemLabel={viewMode === 'cards' ? 'cards' : 'rows'} onPageChange={quotationTable.setPage} onPageSizeChange={quotationTable.setPageSize} total={quotationTable.total} />

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]">
      <header className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-sm"><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition focus:border-brand-blue/40 focus:bg-white" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quotation, client, subject, or location..." /></div><div className="flex flex-wrap gap-2"><AnimatedDropdown className="min-w-44" size="filter" fullWidth={false} value={statusFilter} options={filterOptions} onChange={setStatusFilter} ariaLabel="Filter quotations by status" />{search || statusFilter !== 'All statuses' ? <button className="h-10 rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-slate-100" type="button" onClick={() => { setSearch(''); setStatusFilter('All statuses') }}>Clear</button> : null}<div className="inline-flex h-10 rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Quotation layout"><button className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition ${viewMode === 'table' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-400 hover:text-brand-blue'}`} type="button" onClick={() => setViewMode('table')} aria-pressed={viewMode === 'table'} title="Table view"><Icon className="size-3.5" path="M4 5h16v14H4V5ZM4 10h16M9 5v14M15 5v14" /><span className="hidden sm:inline">Table</span></button><button className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition ${viewMode === 'cards' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-400 hover:text-brand-blue'}`} type="button" onClick={() => setViewMode('cards')} aria-pressed={viewMode === 'cards'} title="Card view"><Icon className="size-3.5" path="M4 4h6v7H4V4Zm10 0h6v7h-6V4ZM4 15h6v5H4v-5Zm10 0h6v5h-6v-5Z" /><span className="hidden sm:inline">Cards</span></button></div><button className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition hover:-translate-y-0.5 sm:flex-none" type="button" onClick={openNewQuotation}><Icon className="size-4 transition-transform group-hover:rotate-90" path="M12 5v14M5 12h14" />New quotation</button></div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><div><h3 className="text-sm font-bold text-brand-blue">All quotations</h3><p className="mt-0.5 text-[11px] text-slate-400">Amounts and approval status</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{visibleQuotations.length} records</span></div></header>
      {visibleQuotations.length ? viewMode === 'table' ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] table-fixed text-left" id="quotations-table"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400"><th className="w-[12%] px-4 py-3.5">Date created</th><th className="w-[15%] px-4 py-3.5">Quotation number</th><th className="w-[19%] px-4 py-3.5">Client name</th><th className="w-[13%] px-4 py-3.5">Status</th><th className="w-[14%] px-4 py-3.5 text-right">Total amount</th><th className="w-[14%] px-4 py-3.5 text-right">Estimated profit</th><th className="w-[13%] px-4 py-3.5 text-right">Actions</th></tr></thead><tbody>{visibleQuotations.map((quotation, index) => <tr className="border-b border-slate-100 transition hover:bg-slate-50/75 animate-[po-row-enter_320ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${Math.min(index * 35, 175)}ms` }} key={quotation.id}><td className="px-4 py-4 text-xs font-semibold text-slate-600">{formatDate(quotation.dateCreated)}</td><td className="px-4 py-4 font-mono text-xs font-extrabold text-brand-blue">{quotation.quotationNumber}</td><td className="px-4 py-4"><p className="truncate text-xs font-extrabold text-slate-700">{quotation.clientName}</p><p className="mt-1 truncate text-[10px] text-slate-400">{quotation.contactPerson}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${statusTone(quotation.status)}`}>{quotation.status}</span></td><td className="px-4 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(quotation.totalAmount)}</td><td className={`px-4 py-4 text-right text-xs font-extrabold tabular-nums ${quotation.estimatedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPeso(quotation.estimatedProfit)}</td><td className="px-4 py-4"><div className="flex justify-end gap-1.5"><button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 transition hover:border-brand-blue/20 hover:bg-blue-50 hover:text-brand-blue" type="button" onClick={() => openEditQuotation(quotation)}><Icon className="size-3" path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />Edit</button><button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-blue px-3 text-[10px] font-bold text-white transition hover:-translate-y-0.5" type="button" onClick={() => setSelectedId(quotation.id)}>View<Icon className="size-3" path="m9 18 6-6-6-6" /></button></div></td></tr>)}</tbody></table></div> : <div className="grid gap-3 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{visibleQuotations.map((quotation, index) => <QuotationCard quotation={quotation} index={index} onEdit={() => openEditQuotation(quotation)} onView={() => setSelectedId(quotation.id)} key={quotation.id} />)}</div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Icon className="size-6" path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h5" /></span><h3 className="mt-4 text-lg font-bold text-brand-blue">{quotations.length ? 'No quotations found' : 'Create your first quotation'}</h3><p className="mt-2 text-xs text-slate-400">{quotations.length ? 'Clear the current filters to see more records.' : 'Build a professional proposal using registered clients and catalog items.'}</p><button className="mt-5 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={openNewQuotation}>New quotation</button></div></div>}
    </section>

    {isFormOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quotation-form-title"><button className="absolute inset-0" type="button" onClick={() => setIsFormOpen(false)} aria-label="Close quotation form" /><form className="relative my-6 w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.36)]" onSubmit={saveQuotation}><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Quotation</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="quotation-form-title">{editingId ? 'Edit quotation' : 'New quotation'}</h2><p className="mt-1 text-xs text-slate-400">Client, project, prices, and expected profit</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsFormOpen(false)} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">{formError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{formError}</div> : null}<div className="grid gap-6 lg:grid-cols-2"><section><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Client information</h3><p className="text-[10px] text-slate-400">Selected from Clients</p></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClassName}>Client name</label><button className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 text-left transition hover:border-brand-blue/25 hover:bg-blue-50/30 focus:outline-none focus:ring-4 focus:ring-brand-blue/[0.05]" type="button" onClick={() => setIsClientPickerOpen(true)}><span className="min-w-0"><span className={`block truncate text-sm font-bold ${selectedClient ? 'text-brand-blue' : 'text-slate-300'}`}>{selectedClient?.name ?? 'Select a registered client'}</span>{selectedClient ? <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-400">{selectedClient.industry || 'Industry not provided'} · {selectedClient.status}</span> : null}</span><span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-brand-orange">Choose<Icon className="size-3" path="m9 18 6-6-6-6" /></span></button></div><div className="sm:col-span-2"><label className={labelClassName}>Contact person</label><AnimatedDropdown value={draft.contactId} options={contactOptions} onChange={selectContact} ariaLabel="Client contact person" /></div></div></section><section><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Quotation details</h3><p className="text-[10px] text-slate-400">Number, date, and approval status</p></div></div><div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>Quotation number</label><input className={`${fieldClassName} bg-slate-50 font-mono font-extrabold`} value={draft.quotationNumber} readOnly /></div><div><label className={labelClassName}>Date created</label><div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-600">{formatDate(draft.dateCreated)}</div></div><div className="sm:col-span-2"><label className={labelClassName}>Status</label><AnimatedDropdown value={draft.status} options={formStatusOptions} onChange={(status) => setDraft((current) => ({ ...current, status }))} ariaLabel="Quotation status" /></div></div></section></div><section className="mt-6 border-t border-slate-100 pt-5"><div className="grid gap-4 lg:grid-cols-2"><div><label className={labelClassName} htmlFor="quotation-subject">Subject</label><input className={fieldClassName} id="quotation-subject" value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="What this quotation is for" required /></div><div><label className={labelClassName} htmlFor="quotation-location">Project location</label><input className={fieldClassName} id="quotation-location" value={draft.projectLocation} onChange={(event) => setDraft((current) => ({ ...current, projectLocation: event.target.value }))} placeholder="Complete project or delivery location" required /></div><div className="lg:col-span-2"><label className={labelClassName} htmlFor="quotation-lead-time">Lead time</label><input className={fieldClassName} id="quotation-lead-time" value={draft.leadTime} onChange={(event) => setDraft((current) => ({ ...current, leadTime: event.target.value }))} placeholder="Example: 7–10 working days after approval" required /></div></div></section><section className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Quotation items</h3><p className="mt-1 text-[10px] text-slate-400">Prices and costs come from Items.</p></div><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 text-[11px] font-bold text-violet-700 transition hover:-translate-y-0.5 hover:bg-violet-100 disabled:opacity-40" type="button" onClick={() => { setItemSearch(''); setIsItemPickerOpen(true) }} disabled={!availableItems.length}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Browse items</button></div>{draft.items.length ? <div className="mt-4 space-y-3">{draft.items.map((line, index) => { const item = availableItems.find((entry) => entry.id === line.itemId); const variantOptions = [{ value: '', label: 'Base item' }, ...(item?.variants.filter((variant) => variant.status === 'Active').map((variant) => ({ value: variant.id, label: `${variant.name}: ${variant.value}` })) ?? [])]; const subtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0); const profit = (Number(line.quantity) || 0) * ((Number(line.unitPrice) || 0) - line.unitCost); return <article className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/55 p-4 lg:grid-cols-[2rem_1.45fr_1fr_0.5fr_0.72fr_0.72fr_auto] lg:items-end" key={line.id}><span className="grid size-8 place-items-center rounded-lg bg-white text-[10px] font-extrabold text-violet-600 shadow-sm">{index + 1}</span><div><label className={labelClassName}>Item</label><div className="flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2"><ProductPhoto photo={line.photo} name={line.itemName} className="size-8 rounded-lg" /><div className="min-w-0"><p className="truncate text-[11px] font-extrabold text-brand-blue">{line.itemName}</p><p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">{line.productCode || 'No product code'} · {line.unitOfMeasure}</p></div></div></div><div><label className={labelClassName}>Variant</label><AnimatedDropdown value={line.variantId} options={variantOptions} onChange={(variantId) => selectLineVariant(line.id, variantId)} ariaLabel={`Variant ${index + 1}`} /></div><div><label className={labelClassName}>Qty</label><input className={fieldClassName} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => setDraft((current) => ({ ...current, items: current.items.map((entry) => entry.id === line.id ? { ...entry, quantity: event.target.value } : entry) }))} required /></div><div><label className={labelClassName}>Unit price</label><input className={fieldClassName} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setDraft((current) => ({ ...current, items: current.items.map((entry) => entry.id === line.id ? { ...entry, unitPrice: event.target.value } : entry) }))} required /></div><div><p className={labelClassName}>Subtotal</p><p className="flex h-11 flex-col justify-center text-xs font-extrabold text-brand-blue"><span>{formatPeso(subtotal)}</span><span className={`mt-0.5 text-[9px] ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPeso(profit)} profit</span></p></div><button className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600" type="button" onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== line.id) }))} aria-label={`Remove ${line.itemName}`}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></article>})}</div> : <button className="mt-4 grid min-h-28 w-full place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 text-center" type="button" onClick={() => setIsItemPickerOpen(true)} disabled={!availableItems.length}><span><span className="mx-auto grid size-9 place-items-center rounded-xl bg-white text-violet-600 shadow-sm"><Icon path="M12 5v14M5 12h14" /></span><span className="mt-2 block text-xs font-bold text-slate-500">No items added</span><span className="mt-1 block text-[10px] text-slate-400">Choose items to start this quotation.</span></span></button>}</section><section className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Quoted total</p><p className="mt-2 text-lg font-extrabold text-brand-blue">{formatPeso(draftTotal)}</p></div><div className="rounded-2xl bg-emerald-50/65 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-600">Estimated net profit</p><p className={`mt-2 text-lg font-extrabold ${draftProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPeso(draftProfit)}</p></div><div className="rounded-2xl bg-violet-50/65 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-violet-600">Estimated margin</p><p className={`mt-2 text-lg font-extrabold ${draftMargin >= 0 ? 'text-violet-700' : 'text-red-600'}`}>{draftMargin.toFixed(1)}%</p></div></section></div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Quotation total</p><p className="mt-1 text-lg font-extrabold text-brand-blue">{formatPeso(draftTotal)}</p></div><div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5 disabled:opacity-40" type="submit" disabled={!clients.length || !availableItems.length}>{editingId ? 'Save changes' : 'Create quotation'}</button></div></footer></form></div> : null}

    {isFormOpen ? <QuotationPricingFormSectionPortal subtotal={draftSubtotal} vatEnabled={draft.vatEnabled} fees={draft.otherCharges} onVatChange={(vatEnabled) => setDraft((current) => ({ ...current, vatEnabled }))} onFeesChange={(otherCharges) => setDraft((current) => ({ ...current, otherCharges }))} /> : null}
    {isFormOpen ? <DocumentContentFormSectionPortal dialogTitleId="quotation-form-title" idPrefix="quotation-document" notes={draft.notes} terms={draft.terms} defaultTerms={loadDocumentDefaults().quotationTerms} onNotesChange={(notes) => setDraft((current) => ({ ...current, notes }))} onTermsChange={(terms) => setDraft((current) => ({ ...current, terms }))} /> : null}
    {isFormOpen ? <DocumentFormScaffold dialogTitleId="quotation-form-title" breakdown={[{ label: 'Subtotal', value: formatPeso(draftSubtotal) }, { label: 'VAT', value: formatPeso(draftVatAmount), muted: !draft.vatEnabled }]} totalLabel="Total" totalValue={formatPeso(draftTotal)} helperText="Save an incomplete quotation as a draft, or submit a complete one for approval." backLabel="Back to quotations" onCancel={closeQuotationFormPage} actions={[{ label: 'Save Draft', intent: 'draft' }, { label: 'Submit for Approval', intent: 'submit', tone: 'primary', disabled: !clients.length || !availableItems.length }]} /> : null}
    {selectedQuotation && !isPricingDialogOpen ? <button className="fixed bottom-6 right-6 z-[70] inline-flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-[0_16px_36px_-16px_rgba(0,20,76,0.8)] transition hover:-translate-y-0.5" type="button" onClick={() => setIsPricingDialogOpen(true)}><Icon className="size-3.5" path="M4 4h16v16H4V4M8 9h8M8 13h8M8 17h5" />Pricing breakdown</button> : null}
    {selectedQuotation && isPricingDialogOpen ? <QuotationPricingDialog subtotal={selectedQuotation.subtotalAmount} vatEnabled={selectedQuotation.vatEnabled} fees={selectedQuotation.otherCharges.map((charge) => ({ ...charge, amount: String(charge.amount) }))} readOnly onVatChange={() => undefined} onFeesChange={() => undefined} onClose={() => setIsPricingDialogOpen(false)} /> : null}

    {selectedQuotation ? <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quotation-detail-title"><button className="absolute inset-0" type="button" onClick={() => setSelectedId(null)} aria-label="Close quotation details" /><section className="relative my-6 w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.36)]"><header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Quotation</p><h2 className="mt-1.5 font-mono text-xl font-extrabold text-brand-blue" id="quotation-detail-title">{selectedQuotation.quotationNumber}</h2><p className="mt-1 text-xs text-slate-400">Created {formatDate(selectedQuotation.dateCreated)} for {selectedQuotation.clientName}</p></div><div className="flex items-center gap-2"><AnimatedDropdown className="min-w-40" size="filter" fullWidth={false} value={selectedQuotation.status} options={statusOptions} onChange={(status) => updateStatus(selectedQuotation, status)} ariaLabel="Quotation status" /><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-brand-blue hover:bg-blue-50" type="button" onClick={() => openEditQuotation(selectedQuotation)}><Icon className="size-3.5" path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />Edit</button><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setSelectedId(null)} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></div></header><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5"><div className="grid gap-3 lg:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4 lg:col-span-2"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Client</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedQuotation.clientName}</p><p className="mt-1 text-xs text-slate-500">{selectedQuotation.contactPerson}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Lead time</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedQuotation.leadTime}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Project location</p><p className="mt-2 text-xs font-bold leading-5 text-slate-600">{selectedQuotation.projectLocation}</p></div></div><div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/45 px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-brand-blue">Subject</p><p className="mt-1 text-sm font-semibold text-slate-600">{selectedQuotation.subject}</p></div><div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[760px] table-fixed text-left"><thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="w-[7%] px-4 py-3 text-center">#</th><th className="w-[37%] px-4 py-3">Item</th><th className="w-[12%] px-4 py-3">Unit</th><th className="w-[12%] px-4 py-3 text-right">Qty</th><th className="w-[16%] px-4 py-3 text-right">Unit price</th><th className="w-[16%] px-4 py-3 text-right">Amount</th></tr></thead><tbody>{selectedQuotation.items.map((line, index) => <tr className="border-t border-slate-100" key={line.id}><td className="px-4 py-3 text-center text-xs font-bold text-brand-blue">{index + 1}</td><td className="px-4 py-3"><div className="flex items-center gap-3"><ProductPhoto photo={line.photo} name={line.itemName} className="size-10 rounded-xl" /><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-700">{line.itemName}</p><p className="mt-1 truncate text-[9px] text-slate-400">{line.productCode}{line.variantLabel ? ` · ${line.variantLabel}` : ''}</p></div></div></td><td className="px-4 py-3 text-xs text-slate-600">{line.unitOfMeasure}</td><td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600">{line.quantity}</td><td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600">{formatPeso(line.unitPrice)}</td><td className="px-4 py-3 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(line.quantity * line.unitPrice)}</td></tr>)}</tbody></table></div><div className="ml-auto mt-4 grid w-full max-w-xl gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Total amount</p><p className="mt-1.5 text-sm font-extrabold text-brand-blue">{formatPeso(selectedQuotation.totalAmount)}</p></div><div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-[9px] font-bold uppercase text-emerald-600">Est. profit</p><p className={`mt-1.5 text-sm font-extrabold ${selectedQuotation.estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPeso(selectedQuotation.estimatedProfit)}</p></div><div className="rounded-xl bg-violet-50/70 p-3"><p className="text-[9px] font-bold uppercase text-violet-600">Est. margin</p><p className="mt-1.5 text-sm font-extrabold text-violet-700">{selectedQuotation.totalAmount ? ((selectedQuotation.estimatedProfit / selectedQuotation.totalAmount) * 100).toFixed(1) : '0.0'}%</p></div></div></div></section></div> : null}

    {isFormOpen && isClientPickerOpen ? <PurchaseOrderClientPickerDialog clients={clients} selectedClientId={draft.clientId} onSelect={selectClient} onClose={() => setIsClientPickerOpen(false)} /> : null}
    {isFormOpen && isItemPickerOpen ? <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quotation-item-picker-title"><button className="absolute inset-0" type="button" onClick={() => setIsItemPickerOpen(false)} aria-label="Close item picker" /><section className="relative my-6 flex max-h-[calc(100svh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]"><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Items catalog</p><h2 className="mt-1.5 text-xl font-bold text-brand-blue" id="quotation-item-picker-title">Choose quotation items</h2><p className="mt-1 text-xs text-slate-400">Active products and variants with current selling prices</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setIsItemPickerOpen(false)} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="border-b border-slate-100 px-6 py-4"><div className="relative"><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none focus:border-brand-blue/40 focus:bg-white" type="search" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search item, code, brand, or category..." autoFocus /></div></div><div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 p-5">{visibleCatalogItems.length ? <div className="grid gap-3 sm:grid-cols-2">{visibleCatalogItems.map((item, index) => { const addedCount = draft.items.filter((line) => line.itemId === item.id).length; const profit = item.sellingPrice - item.rawCost; return <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_28px_-25px_rgba(0,20,76,0.5)] transition hover:-translate-y-0.5 hover:border-brand-blue/20" style={{ animationDelay: `${Math.min(index * 35, 175)}ms` }} key={item.id}><ProductPhoto photo={item.photo} name={item.name} className="size-16 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-brand-blue">{item.name}</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-400">{item.productCode || 'No product code'} · {item.unitOfMeasure}</p><div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">{item.variants.length} variants</span><span className="text-[10px] font-extrabold text-brand-blue">{formatPeso(item.sellingPrice)}</span><span className={`text-[9px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPeso(profit)} profit</span></div></div><button className="h-9 shrink-0 rounded-xl bg-brand-blue px-3 text-[10px] font-bold text-white transition hover:-translate-y-0.5" type="button" onClick={() => addCatalogItem(item)}>{addedCount ? 'Add option' : 'Add'}</button></article>})}</div> : <div className="grid min-h-60 place-items-center text-center"><div><h3 className="text-sm font-bold text-brand-blue">No matching active items</h3><button className="mt-2 text-xs font-bold text-brand-orange" type="button" onClick={() => setItemSearch('')}>Clear search</button></div></div>}</div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4"><p className="text-[10px] font-semibold text-slate-400">Add the same product again to quote another variant.</p><button className="h-10 rounded-xl bg-brand-blue px-5 text-xs font-bold text-white" type="button" onClick={() => setIsItemPickerOpen(false)}>Done</button></footer></section></div> : null}
    {approvalDialog}
    {pendingRejectQuotationId ? <RejectionReasonDialog quotationNumber={quotations.find((entry) => entry.id === pendingRejectQuotationId)?.quotationNumber ?? 'quotation'} onClose={() => setPendingRejectQuotationId(null)} onConfirm={rejectQuotation} /> : null}
    <SuccessToast message={toast} />
  </div>
}
