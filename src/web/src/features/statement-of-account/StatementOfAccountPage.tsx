import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { CreateRecordButton } from '../../components/ui/DirectoryHeader'
import { Button } from '../../components/ui/Button'
import { DocumentContentFormSectionPortal } from '../../components/ui/DocumentContentFields'
import { DocumentFormScaffold } from '../../components/ui/DocumentFormScaffold'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { VoidRecordDialog } from '../../components/ui/VoidRecordDialog'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { TableControls, useTableView } from '../../components/ui/TableControls'
import { RecordListSkeleton } from '../../components/ui/RecordListSkeleton'
import { usePersistentState } from '../../components/ui/usePersistentState'
import { listClients as fetchClients } from '../../services/api/clients'
import { listQuotations } from '../../services/api/quotations'
import { applyStatementLateCharge, archiveStatement as archiveStatementRequest, changeStatementStatus, createStatement, listStatements, recordStatementPayment, updateStatement, waiveStatementLateCharge, type SaveStatement, type Statement as ApiStatement } from '../../services/api/statements'
import { isActiveRecord } from '../../services/recordLifecycle'
import { PurchaseOrderClientPickerDialog } from '../purchase-orders/PurchaseOrderClientPickerDialog'
import { loadDocumentDefaults, loadLateChargePolicy } from '../settings/settingsStorage'
import { effectiveStatementStatus, scheduleLateChargePolicy, statementScheduleProgress, suggestedLateCharge } from './latePayment'
import { PaymentArrangementDialog, type PaymentArrangementValues } from './PaymentArrangementDialog'
import { PaymentScheduleOverview } from './PaymentScheduleOverview'
import { StatementOfAccountProfile } from './StatementOfAccountProfile'
import type { LateChargeType, PaymentArrangement, PaymentFrequency, PaymentScheduleEntry, StatementOfAccount, StatementStatus } from './statementOfAccountTypes'

type Client = {
  id: string
  name: string
  status: string
  address: string
  industry: string
  contactPerson: string
  email: string
  phone: string
}

type SourceQuotation = {
  id: string
  dateCreated: string
  quotationNumber: string
  clientId: string
  clientName: string
  contactPerson: string
  subject: string
  projectLocation: string
  items: Array<{
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
  }>
  subtotalAmount: number
  vatEnabled: boolean
  vatAmount: number
  otherCharges: Array<{ id: string; label: string; amount: number }>
  totalAmount: number
  status: string
}

type StatementDraft = {
  soaNumber: string
  statementDate: string
  coverageFrom: string
  coverageTo: string
  dueDate: string
  clientId: string
  contactPerson: string
  quotationIds: string[]
  openingBalance: string
  paymentArrangement: PaymentArrangement
  paymentFrequency: PaymentFrequency
  paymentSchedule: PaymentScheduleEntry[]
  status: StatementStatus
  notes: string
  terms: string
}

type PaymentDraft = {
  date: string
  amount: string
  method: string
  referenceNumber: string
  notes: string
}

type LateChargeDraft = {
  statementId: string
  scheduleEntryId: string
  type: LateChargeType
  rateValue: number
  finalAmount: number
  reason: string
}

type StatementOfAccountPageProps = { currentUsername: string }

const statuses: StatementStatus[] = ['Draft', 'Issued', 'Partially Settled', 'Settled', 'Overdue', 'Cancelled']
const statusOptions = statuses.map((value) => ({ value }))
const filterOptions = [{ value: 'All statuses' }, ...statusOptions]
const paymentMethodOptions = ['Bank transfer', 'Cash', 'Check', 'GCash', 'Other'].map((value) => ({ value }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  if (!value) return 'Not provided'
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function datePlusDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function loadClients(): Client[] {
  return []
}

// Phase 10 will replace the Collections consumer with its own API query.
export function loadStatements(): StatementOfAccount[] { return [] }

export function toStatement(value: ApiStatement): StatementOfAccount {
  return {
    id: value.id, soaNumber: value.soaNumber, statementDate: value.statementDate, coverageFrom: value.coverageFrom, coverageTo: value.coverageTo, dueDate: value.dueDate,
    clientId: value.clientId ?? '', clientName: value.clientName, contactPerson: value.contactPerson, openingBalance: value.openingBalance, totalCharges: value.totalCharges,
    payments: value.payments.map((payment) => ({ id: payment.id, date: payment.paymentDate, amount: payment.entryType === 'Reversal' ? -payment.amount : payment.amount, method: payment.method, referenceNumber: payment.referenceNumber, notes: payment.notes, principalAmount: payment.entryType === 'Reversal' ? -payment.principalAmount : payment.principalAmount, lateChargeAmount: payment.entryType === 'Reversal' ? -payment.lateChargeAmount : payment.lateChargeAmount, createdAt: payment.createdAt })), totalPayments: value.totalPayments, balance: value.balance, paymentArrangement: value.paymentArrangement, paymentFrequency: value.paymentFrequency,
    paymentSchedule: value.paymentSchedule.map((entry) => ({ id: entry.id, label: entry.label, dueDate: entry.dueDate, amount: entry.amount, lateChargePolicy: entry.lateChargeEnabled === null ? undefined : { enabled: entry.lateChargeEnabled, graceDays: entry.lateChargeGraceDays ?? value.lateChargeGraceDays, type: entry.lateChargeType ?? value.lateChargeType, value: entry.lateChargeValue ?? value.lateChargeValue } })),
    lateChargePolicy: { enabled: value.lateChargeEnabled, graceDays: value.lateChargeGraceDays, type: value.lateChargeType, value: value.lateChargeValue },
    lateCharges: value.lateCharges.map((charge) => ({ id: charge.id, scheduleEntryId: charge.scheduleId, appliedDate: charge.appliedDate, type: charge.type, rateValue: charge.rateValue, calculatedAmount: charge.calculatedAmount, amount: charge.amount, status: charge.status, reason: charge.reason, createdBy: charge.createdBy, createdAt: charge.createdAt, updatedAt: charge.updatedAt })),
    quotations: value.quotations.map((quotation) => ({ id: quotation.quotationId ?? quotation.id, quotationNumber: quotation.quotationNumber, dateCreated: quotation.quotationDate, subject: quotation.subject, projectLocation: quotation.projectLocation, subtotalAmount: quotation.subtotalAmount, vatEnabled: quotation.vatEnabled, vatAmount: quotation.vatAmount, otherCharges: quotation.charges.map((charge) => ({ id: charge.id, label: charge.label, amount: charge.amount })), totalAmount: quotation.totalAmount, items: quotation.items.map((item) => ({ id: item.id, quotationId: quotation.quotationId ?? quotation.id, quotationNumber: quotation.quotationNumber, itemId: item.itemId ?? '', variantId: item.variantId ?? '', photo: item.photo, itemName: item.itemName, variantLabel: item.variantLabel, productCode: item.productCode, unitOfMeasure: item.unitOfMeasure, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount })) })),
    status: value.status, notes: value.notes, terms: value.terms, createdAt: value.createdAt, updatedAt: value.updatedAt, archivedAt: value.archivedAt, voidReason: value.voidReason, version: value.version,
  }
}

function statementRequest(draft: StatementDraft, arrangement: PaymentArrangementValues, intent: SaveStatement['intent'], version?: number): SaveStatement {
  return { statementDate: draft.statementDate, coverageFrom: draft.coverageFrom, coverageTo: draft.coverageTo, dueDate: draft.dueDate, clientId: draft.clientId, contactPerson: draft.contactPerson.trim(), openingBalance: Number(draft.openingBalance), paymentArrangement: arrangement.paymentArrangement, paymentFrequency: arrangement.paymentFrequency, lateChargeEnabled: arrangement.lateChargePolicy.enabled, lateChargeGraceDays: arrangement.lateChargePolicy.graceDays, lateChargeType: arrangement.lateChargePolicy.type, lateChargeValue: arrangement.lateChargePolicy.value, notes: draft.notes.trim(), terms: draft.terms.trim(), quotationIds: draft.quotationIds, paymentSchedule: arrangement.paymentSchedule.map((entry) => ({ label: entry.label, dueDate: entry.dueDate, amount: entry.amount, lateChargeEnabled: entry.lateChargePolicy?.enabled ?? null, lateChargeGraceDays: entry.lateChargePolicy?.graceDays ?? null, lateChargeType: entry.lateChargePolicy?.type ?? null, lateChargeValue: entry.lateChargePolicy?.value ?? null })), intent, version }
}

function effectiveStatus(statement: StatementOfAccount): StatementStatus {
  return effectiveStatementStatus(statement)
}

function statusTone(status: StatementStatus) {
  if (status === 'Settled') return 'bg-emerald-50 text-emerald-700'
  if (status === 'Partially Settled') return 'bg-amber-50 text-amber-700'
  if (status === 'Overdue') return 'bg-red-50 text-red-600'
  if (status === 'Issued') return 'bg-sky-50 text-sky-700'
  return 'bg-slate-100 text-slate-600'
}

function statementDraftFrom(statement: StatementOfAccount): StatementDraft {
  return { soaNumber: statement.soaNumber, statementDate: statement.statementDate, coverageFrom: statement.coverageFrom, coverageTo: statement.coverageTo, dueDate: statement.dueDate, clientId: statement.clientId, contactPerson: statement.contactPerson, quotationIds: statement.quotations.map((quotation) => quotation.id), openingBalance: String(statement.openingBalance), paymentArrangement: statement.paymentArrangement, paymentFrequency: statement.paymentFrequency, paymentSchedule: statement.paymentSchedule, status: statement.status, notes: statement.notes, terms: statement.terms }
}

export function StatementOfAccountPage({ currentUsername: _currentUsername }: StatementOfAccountPageProps) {
  const [statements, setStatements] = useState<StatementOfAccount[]>([])
  const [clients, setClients] = useState<Client[]>(loadClients)
  const [quotations, setQuotations] = useState<SourceQuotation[]>([])
  const initialQuery = new URLSearchParams(window.location.search)
  const openNewFromQuery = initialQuery.get('new') === '1'
  const openNewOnLoad = openNewFromQuery || window.location.pathname === '/statement-of-account/new'
  const [sourceQuotationId] = useState(() => initialQuery.get('quotationId'))
  const editStatementIdOnLoad = /^\/statement-of-account\/([^/]+)\/edit$/.exec(window.location.pathname)?.[1]
  const editStatementOnLoad = editStatementIdOnLoad ? statements.find((statement) => statement.id === decodeURIComponent(editStatementIdOnLoad)) : undefined
  const [search, setSearch] = usePersistentState('statements.search', '')
  const [statusFilter, setStatusFilter] = usePersistentState<string>('statements.status', 'All statuses')
  const [isFormOpen, setIsFormOpen] = useState(openNewOnLoad || Boolean(editStatementOnLoad))
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(editStatementOnLoad?.id ?? null)
  const [draft, setDraft] = useState<StatementDraft>(() => {
    if (editStatementOnLoad) return statementDraftFrom(editStatementOnLoad)
    const values = emptyDraft(statements, clients)
    if (!openNewOnLoad || !sourceQuotationId) return values
    const quotation = quotations.find((entry) => entry.id === sourceQuotationId && entry.status === 'Approved')
    if (!quotation) return values
    const client = clients.find((entry) => entry.id === quotation.clientId)
    return { ...values, clientId: quotation.clientId, contactPerson: client?.contactPerson ?? '', quotationIds: [quotation.id] }
  })
  const [formError, setFormError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [isLoadingStatements, setIsLoadingStatements] = useState(true)
  const [hasLoadedStatements, setHasLoadedStatements] = useState(false)
  const statusMutationRef = useRef(false)
  const [toast, setToast] = useState('')
  const [pendingVoidStatementId, setPendingVoidStatementId] = useState<string | null>(null)
  const [paymentStatementId, setPaymentStatementId] = useState<string | null>(() => {
    if (new URLSearchParams(window.location.search).get('pay') !== '1') return null
    const routeId = window.location.pathname.match(/^\/statement-of-account\/([^/]+)$/)?.[1]
    return routeId ? decodeURIComponent(routeId) : null
  })
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(() => emptyPayment())
  const [paymentError, setPaymentError] = useState('')
  const [lateChargeDraft, setLateChargeDraft] = useState<LateChargeDraft | null>(() => {
    const scheduleEntryId = new URLSearchParams(window.location.search).get('charge')
    const routeId = window.location.pathname.match(/^\/statement-of-account\/([^/]+)$/)?.[1]
    const statement = routeId ? statements.find((entry) => entry.id === decodeURIComponent(routeId)) : undefined
    const schedule = statement && scheduleEntryId ? statementScheduleProgress(statement).find((entry) => entry.id === scheduleEntryId) : undefined
    if (!statement || !schedule) return null
    const existing = statement.lateCharges.find((charge) => charge.scheduleEntryId === schedule.id)
    const policy = scheduleLateChargePolicy(statement, schedule)
    return { statementId: statement.id, scheduleEntryId: schedule.id, type: existing?.type ?? policy.type, rateValue: existing?.rateValue ?? policy.value, finalAmount: existing?.amount ?? suggestedLateCharge(schedule.balance, { ...policy, enabled: true }), reason: existing?.reason ?? '' }
  })
  const [lateChargeError, setLateChargeError] = useState('')
  const [isPaymentArrangementOpen, setIsPaymentArrangementOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const statementSubmitIntent = useRef<'draft' | 'issue' | 'preserve'>('draft')
  const paymentIdempotencyKey = useRef<string | null>(null)

  function emptyDraft(_statementList = statements, clientList = clients): StatementDraft {
    const today = new Date().toISOString().slice(0, 10)
    const firstClient = clientList.find((client) => client.status === 'Active')
    return { soaNumber: 'Reserved on save', statementDate: today, coverageFrom: today, coverageTo: today, dueDate: datePlusDays(today, 30), clientId: firstClient?.id ?? '', contactPerson: firstClient?.contactPerson ?? '', quotationIds: [], openingBalance: '0', paymentArrangement: 'Full payment', paymentFrequency: 'Custom', paymentSchedule: [], status: 'Draft', notes: '', terms: '' }
  }

  function emptyPayment(): PaymentDraft {
    return { date: new Date().toISOString().slice(0, 10), amount: '', method: 'Bank transfer', referenceNumber: '', notes: '' }
  }

  useEffect(() => {
    if (openNewFromQuery) {
      window.history.replaceState(null, '', '/statement-of-account/new')
      setCurrentPath('/statement-of-account/new')
      window.dispatchEvent(new Event('adiel:navigate'))
    }
  }, [openNewFromQuery])

  useEffect(() => {
    function refreshData() {
      setIsLoadingStatements(true)
      void listStatements({ pageSize: 100 }).then((result) => { setStatements(result.items.map(toStatement)); setHasLoadedStatements(true) }).catch(() => setStorageError('Statements could not be loaded from the API.')).finally(() => setIsLoadingStatements(false))
      void fetchClients({ pageSize: 100 }).then((result) => setClients(result.items)).catch(() => setStorageError('Clients could not be loaded from the API.'))
      void listQuotations({ pageSize: 100 }).then((result) => setQuotations(result.items.map((quotation) => ({ id: quotation.id, dateCreated: quotation.quotationDate, quotationNumber: quotation.quotationNumber, clientId: quotation.clientId ?? '', clientName: quotation.clientName, contactPerson: quotation.contactPerson, subject: quotation.subject, projectLocation: quotation.projectLocation, items: quotation.lines.map((line) => ({ id: line.id, itemId: line.itemId ?? '', variantId: line.variantId ?? '', photo: line.photo, itemName: line.itemName, variantLabel: line.variantLabel, productCode: line.productCode, unitOfMeasure: line.unitOfMeasure, quantity: line.quantity, unitPrice: line.unitPrice })), subtotalAmount: quotation.subtotalAmount, vatEnabled: quotation.vatEnabled, vatAmount: quotation.vatAmount, otherCharges: quotation.charges.map((charge) => ({ id: charge.id, label: charge.label, amount: charge.amount })), totalAmount: quotation.totalAmount, status: quotation.status })))).catch(() => setStorageError('Quotations could not be loaded from the API.'))
    }
    function handleNavigation() { setCurrentPath(window.location.pathname) }
    refreshData()
    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('adiel:navigate', handleNavigation)
    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('adiel:navigate', handleNavigation)
    }
  }, [])

  useEffect(() => {
    void fetchClients({ pageSize: 100 }).then((result) => setClients(result.items)).catch(() => setStorageError('Clients could not be loaded from the API.'))
  }, [])

  useEffect(() => {
    if (!editStatementIdOnLoad || editingId) return
    const statement = statements.find((entry) => entry.id === decodeURIComponent(editStatementIdOnLoad))
    if (!statement) return
    setEditingId(statement.id); setDraft(statementDraftFrom(statement)); setIsFormOpen(true)
  }, [editStatementIdOnLoad, editingId, statements])

  useEffect(() => {
    if (!openNewOnLoad || editingId || !sourceQuotationId) return
    const quotation = quotations.find((entry) => entry.id === sourceQuotationId && entry.status === 'Approved')
    if (!quotation) return
    setDraft((current) => current.quotationIds.length ? current : { ...current, clientId: quotation.clientId, contactPerson: quotation.contactPerson, quotationIds: [quotation.id] })
  }, [editingId, openNewOnLoad, quotations, sourceQuotationId])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!paymentStatementId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      document.getElementById('payment-amount')?.focus()
    })
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
    }
  }, [paymentStatementId])

  const routeMatch = currentPath.match(/^\/statement-of-account\/([^/]+)$/)
  const profileId = routeMatch?.[1]
  const activeStatements = useMemo(() => statements.filter(isActiveRecord), [statements])
  const profileStatement = profileId ? activeStatements.find((statement) => statement.id === decodeURIComponent(profileId)) : undefined
  const selectedClient = clients.find((client) => client.id === draft.clientId)
  const editingStatement = editingId ? statements.find((statement) => statement.id === editingId) : undefined
  const usedQuotationIds = useMemo(() => new Set(activeStatements.filter((statement) => statement.id !== editingId && statement.status !== 'Cancelled').flatMap((statement) => statement.quotations.map((quotation) => quotation.id))), [activeStatements, editingId])
  const eligibleQuotations = useMemo(() => quotations.filter((quotation) => quotation.status === 'Approved' && quotation.clientId === draft.clientId && (!usedQuotationIds.has(quotation.id) || draft.quotationIds.includes(quotation.id))).sort((left, right) => right.dateCreated.localeCompare(left.dateCreated)), [draft.clientId, draft.quotationIds, quotations, usedQuotationIds])
  const selectedQuotations = eligibleQuotations.filter((quotation) => draft.quotationIds.includes(quotation.id))
  const draftQuotationTotal = selectedQuotations.reduce((total, quotation) => total + quotation.totalAmount, 0)
  const draftOpeningBalance = Number(draft.openingBalance) || 0
  const draftTotal = draftQuotationTotal + draftOpeningBalance
  const matchingStatements = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...activeStatements].filter((statement) => {
      const status = effectiveStatus(statement)
      const matchesStatus = statusFilter === 'All statuses' || status === statusFilter
      const matchesSearch = !query || [statement.soaNumber, statement.clientName, statement.contactPerson, ...statement.quotations.map((quotation) => quotation.quotationNumber)].some((value) => value.toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    }).sort((left, right) => right.statementDate.localeCompare(left.statementDate))
  }, [activeStatements, search, statusFilter])
  const statementSortOptions = [
    { value: 'newest', label: 'Newest first', getValue: (statement: StatementOfAccount) => statement.statementDate, direction: 'desc' as const },
    { value: 'oldest', label: 'Oldest first', getValue: (statement: StatementOfAccount) => statement.statementDate, direction: 'asc' as const },
    { value: 'balance', label: 'Highest balance', getValue: (statement: StatementOfAccount) => statement.balance, direction: 'desc' as const },
    { value: 'client', label: 'Client A-Z', getValue: (statement: StatementOfAccount) => statement.clientName, direction: 'asc' as const },
  ]
  const statementTable = useTableView({ rows: matchingStatements, storageKey: 'statements.table', sortOptions: statementSortOptions })
  const filteredStatements = statementTable.pageRows

  const totalReceivables = activeStatements.filter((statement) => statement.status !== 'Cancelled').reduce((total, statement) => total + statement.balance, 0)
  const totalPayments = activeStatements.reduce((total, statement) => total + statement.totalPayments, 0)
  const overdueCount = activeStatements.filter((statement) => effectiveStatus(statement) === 'Overdue').length
  const settledCount = activeStatements.filter((statement) => effectiveStatus(statement) === 'Settled').length

  function navigate(path: string) {
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    window.dispatchEvent(new Event('adiel:navigate'))
  }

  function closeStatementFormPage() {
    setIsFormOpen(false)
    setIsClientPickerOpen(false)
    setIsPaymentArrangementOpen(false)
    window.history.replaceState(null, '', '/statement-of-account')
    setCurrentPath('/statement-of-account')
    window.dispatchEvent(new Event('adiel:navigate'))
  }

  function openNew() {
    setEditingId(null)
    setDraft(emptyDraft())
    setIsPaymentArrangementOpen(false)
    setFormError('')
    setIsFormOpen(true)
    navigate('/statement-of-account/new')
  }

  function openEdit(statement: StatementOfAccount) {
    setEditingId(statement.id)
    setDraft(statementDraftFrom(statement))
    setFormError('')
    setIsPaymentArrangementOpen(false)
    setIsFormOpen(true)
    navigate(`/statement-of-account/${encodeURIComponent(statement.id)}/edit`)
  }

  function selectClient(clientId: string) {
    const client = clients.find((entry) => entry.id === clientId)
    setDraft((current) => ({ ...current, clientId, contactPerson: client?.contactPerson ?? '', quotationIds: [] }))
    setIsClientPickerOpen(false)
  }

  function toggleQuotation(quotationId: string) {
    setDraft((current) => ({ ...current, quotationIds: current.quotationIds.includes(quotationId) ? current.quotationIds.filter((id) => id !== quotationId) : [...current.quotationIds, quotationId] }))
  }

  function saveStatement(event: FormEvent) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const intent = submitter instanceof HTMLButtonElement ? submitter.dataset.intent : undefined
    statementSubmitIntent.current = intent === 'issue' ? 'issue' : intent === 'preserve' ? 'preserve' : 'draft'
    const client = clients.find((entry) => entry.id === draft.clientId)
    if (!client || !draft.quotationIds.length || !draft.statementDate || !draft.coverageFrom || !draft.coverageTo || !draft.dueDate || draft.coverageFrom > draft.coverageTo || Number(draft.openingBalance) < 0) {
      setFormError('Select a client and at least one approved quotation, then check the coverage dates and opening balance.')
      return
    }
    const sourceQuotations = quotations.filter((quotation) => draft.quotationIds.includes(quotation.id) && quotation.status === 'Approved' && quotation.clientId === client.id)
    if (sourceQuotations.length !== draft.quotationIds.length || sourceQuotations.some((quotation) => usedQuotationIds.has(quotation.id))) {
      setFormError('One or more quotations are no longer available. Refresh your selection and try again.')
      return
    }
    setFormError('')
    setIsPaymentArrangementOpen(true)
  }

  async function confirmPaymentArrangement(arrangementValues: PaymentArrangementValues) {
    const client = clients.find((entry) => entry.id === draft.clientId)
    if (!client) return
    const sourceQuotations = quotations.filter((quotation) => draft.quotationIds.includes(quotation.id) && quotation.status === 'Approved' && quotation.clientId === client.id)
    if (sourceQuotations.length !== draft.quotationIds.length || sourceQuotations.some((quotation) => usedQuotationIds.has(quotation.id))) {
      setIsPaymentArrangementOpen(false)
      setFormError('One or more quotations are no longer available. Refresh your selection and try again.')
      return
    }
    try {
      const intent = statementSubmitIntent.current
      const saved = editingStatement ? await updateStatement(editingStatement.id, statementRequest(draft, arrangementValues, intent, editingStatement.version)) : await createStatement(statementRequest(draft, arrangementValues, intent))
      const statement = toStatement(saved)
      setStatements((current) => editingStatement ? current.map((entry) => entry.id === editingStatement.id ? statement : entry) : [statement, ...current])
      setDraft((current) => ({ ...current, ...arrangementValues, dueDate: statement.dueDate }))
      setIsPaymentArrangementOpen(false); closeStatementFormPage(); setEditingId(null)
      setToast(intent === 'issue' ? 'Statement reviewed and issued.' : editingStatement ? 'Statement and payment arrangement updated.' : 'Statement saved as draft with its payment arrangement.')
      if (profileStatement) navigate(`/statement-of-account/${statement.id}`)
    } catch (failure) { setIsPaymentArrangementOpen(false); setFormError(failure instanceof Error ? failure.message : 'Statement could not be saved.') }
  }

  async function updateStatementStatus(statement: StatementOfAccount, status: StatementStatus) {
    if (statusMutationRef.current) return
    if (status === 'Cancelled' && statement.status !== 'Cancelled') {
      setPendingVoidStatementId(statement.id)
      return
    }
    statusMutationRef.current = true
    try { const saved = await changeStatementStatus(statement.id, { status, version: statement.version }); setStatements((current) => current.map((entry) => entry.id === statement.id ? toStatement(saved) : entry)); setToast(`Statement marked ${status.toLowerCase()}.`) }
    catch (failure) { setStorageError(failure instanceof Error ? failure.message : 'Statement status could not be changed.') }
    finally { statusMutationRef.current = false }
  }

  function openPayment(statement: StatementOfAccount) {
    setPaymentError('')
    setPaymentDraft(emptyPayment())
    paymentIdempotencyKey.current = crypto.randomUUID()
    setPaymentStatementId(statement.id)
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault()
    const statement = statements.find((entry) => entry.id === paymentStatementId)
    if (!statement) return
    try {
      const saved = await recordStatementPayment(statement.id, { paymentDate: paymentDraft.date, amount: Number(paymentDraft.amount), method: paymentDraft.method, referenceNumber: paymentDraft.referenceNumber.trim(), notes: paymentDraft.notes.trim(), idempotencyKey: paymentIdempotencyKey.current ?? (paymentIdempotencyKey.current = crypto.randomUUID()), version: statement.version })
      setStatements((current) => current.map((entry) => entry.id === saved.id ? toStatement(saved) : entry)); setPaymentStatementId(null); paymentIdempotencyKey.current = null; setToast('Payment recorded.')
    } catch (failure) { setPaymentError(failure instanceof Error ? failure.message : 'Payment could not be recorded.') }
  }

  async function confirmVoidStatement(reason: string, archiveAfterVoiding: boolean) {
    const statement = statements.find((entry) => entry.id === pendingVoidStatementId)
    if (!statement) return
    if (statusMutationRef.current) return
    statusMutationRef.current = true
    try { const saved = await changeStatementStatus(statement.id, { status: 'Cancelled', reason, version: statement.version, archiveAfterVoiding }); setStatements((current) => archiveAfterVoiding ? current.filter((entry) => entry.id !== statement.id) : current.map((entry) => entry.id === statement.id ? toStatement(saved) : entry)); setPendingVoidStatementId(null); setToast(archiveAfterVoiding ? 'Statement voided and archived' : 'Statement voided'); if (archiveAfterVoiding) navigate('/statement-of-account') }
    catch (failure) { setStorageError(failure instanceof Error ? failure.message : 'Statement could not be voided.') }
    finally { statusMutationRef.current = false }
  }

  async function archiveStatement(statement: StatementOfAccount) {
    try { await archiveStatementRequest(statement.id, statement.version); setStatements((current) => current.filter((entry) => entry.id !== statement.id)); setToast('Statement archived'); navigate('/statement-of-account') }
    catch (failure) { setStorageError(failure instanceof Error ? failure.message : 'Statement could not be archived.') }
  }

  function openLateCharge(statement: StatementOfAccount, scheduleEntryId: string) {
    const schedule = statementScheduleProgress(statement).find((entry) => entry.id === scheduleEntryId)
    if (!schedule) return
    const existing = statement.lateCharges.find((charge) => charge.scheduleEntryId === scheduleEntryId)
    const policy = scheduleLateChargePolicy(statement, schedule)
    setLateChargeDraft({
      statementId: statement.id,
      scheduleEntryId,
      type: existing?.type ?? policy.type,
      rateValue: existing?.rateValue ?? policy.value,
      finalAmount: existing?.amount ?? suggestedLateCharge(schedule.balance, { ...policy, enabled: true }),
      reason: existing?.reason ?? '',
    })
    setLateChargeError('')
  }

  async function applyLateCharge(event: FormEvent) {
    event.preventDefault()
    if (!lateChargeDraft) return
    const statement = statements.find((entry) => entry.id === lateChargeDraft.statementId)
    const schedule = statement ? statementScheduleProgress(statement).find((entry) => entry.id === lateChargeDraft.scheduleEntryId) : undefined
    if (!statement || !schedule || lateChargeDraft.rateValue <= 0 || lateChargeDraft.finalAmount <= 0) {
      setLateChargeError('Enter a rate or fixed value and a final charge greater than zero.')
      return
    }
    try { const saved = await applyStatementLateCharge(statement.id, schedule.id, statement.version); setStatements((current) => current.map((entry) => entry.id === statement.id ? toStatement(saved) : entry)); setLateChargeDraft(null); setToast('Backend-calculated late charge applied.') }
    catch (failure) { setLateChargeError(failure instanceof Error ? failure.message : 'Late charge could not be applied.') }
  }

  async function waiveLateCharge() {
    if (!lateChargeDraft) return
    const statement = statements.find((entry) => entry.id === lateChargeDraft.statementId)
    const schedule = statement ? statementScheduleProgress(statement).find((entry) => entry.id === lateChargeDraft.scheduleEntryId) : undefined
    if (!statement || !schedule) return
    if (!lateChargeDraft.reason.trim()) {
      setLateChargeError('Add a reason before waiving the late charge.')
      return
    }
    try { const saved = await waiveStatementLateCharge(statement.id, schedule.id, lateChargeDraft.reason, statement.version); setStatements((current) => current.map((entry) => entry.id === statement.id ? toStatement(saved) : entry)); setLateChargeDraft(null); setToast('Late charge waived.') }
    catch (failure) { setLateChargeError(failure instanceof Error ? failure.message : 'Late charge could not be waived.') }
  }

  if (profileStatement && !isFormOpen) {
    return <>{storageError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{storageError}</div> : null}<div className="space-y-5"><StatementOfAccountProfile statement={profileStatement} effectiveStatus={effectiveStatus(profileStatement)} onBack={() => navigate('/statement-of-account')} onEdit={() => openEdit(profileStatement)} onRecordPayment={() => openPayment(profileStatement)} onArchive={() => archiveStatement(profileStatement)} onStatusChange={(status) => updateStatementStatus(profileStatement, status)} /><PaymentScheduleOverview statement={profileStatement} onReviewLateCharge={(scheduleEntryId) => openLateCharge(profileStatement, scheduleEntryId)} /></div>{renderPaymentDialog()}{renderLateChargeDialog()}{pendingVoidStatementId ? <VoidRecordDialog recordLabel="statement of account" onClose={() => setPendingVoidStatementId(null)} onConfirm={confirmVoidStatement} /> : null}<SuccessToast message={toast} /></>
  }

  function renderPaymentDialog() {
    const statement = statements.find((entry) => entry.id === paymentStatementId)
    if (!statement) return null
    return <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title"><button className="absolute inset-0" type="button" onClick={() => setPaymentStatementId(null)} aria-label="Close payment form" /><form className="relative my-auto max-h-[calc(100svh-2rem)] w-full max-w-xl overflow-y-auto rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]" onSubmit={recordPayment}><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600">Account payment</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="payment-dialog-title">Record payment</h2><p className="mt-1 text-xs text-slate-400">{statement.soaNumber} · Balance {formatPeso(statement.balance)}</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setPaymentStatementId(null)}><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="space-y-4 px-6 py-5">{paymentError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{paymentError}</div> : null}<div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>Payment date</label><AnimatedDatePicker value={paymentDraft.date} onChange={(date) => setPaymentDraft((current) => ({ ...current, date }))} ariaLabel="Payment date" required /></div><div><label className={labelClassName} htmlFor="payment-amount">Amount</label><input className={fieldClassName} id="payment-amount" type="number" min="0.01" max={statement.balance} step="0.01" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" required /></div><div><label className={labelClassName}>Payment method</label><AnimatedDropdown value={paymentDraft.method} options={paymentMethodOptions} onChange={(method) => setPaymentDraft((current) => ({ ...current, method }))} ariaLabel="Payment method" /></div><div><label className={labelClassName} htmlFor="payment-reference">Reference number</label><input className={fieldClassName} id="payment-reference" value={paymentDraft.referenceNumber} onChange={(event) => setPaymentDraft((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="Check or transaction number" /></div></div><div><label className={labelClassName} htmlFor="payment-notes">Notes</label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-brand-blue outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="payment-notes" value={paymentDraft.notes} onChange={(event) => setPaymentDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal payment note" /></div></div><footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setPaymentStatementId(null)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white" type="submit">Record payment</button></footer></form></div>
  }

  function renderLateChargeDialog() {
    if (!lateChargeDraft) return null
    const statement = statements.find((entry) => entry.id === lateChargeDraft.statementId)
    const schedule = statement ? statementScheduleProgress(statement).find((entry) => entry.id === lateChargeDraft.scheduleEntryId) : undefined
    if (!statement || !schedule) return null
    const existing = statement.lateCharges.find((charge) => charge.scheduleEntryId === schedule.id)
    const schedulePolicy = scheduleLateChargePolicy(statement, schedule)
    const calculated = suggestedLateCharge(schedule.balance, { enabled: true, graceDays: schedulePolicy.graceDays, type: lateChargeDraft.type, value: lateChargeDraft.rateValue })
    const updateRate = (value: number) => setLateChargeDraft((current) => current ? { ...current, rateValue: value, finalAmount: suggestedLateCharge(schedule.balance, { enabled: true, graceDays: schedulePolicy.graceDays, type: current.type, value }) } : null)
    const updateType = (type: LateChargeType) => setLateChargeDraft((current) => current ? { ...current, type, finalAmount: suggestedLateCharge(schedule.balance, { enabled: true, graceDays: schedulePolicy.graceDays, type, value: current.rateValue }) } : null)
    return <div className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="late-charge-dialog-title">
      <button className="absolute inset-0" type="button" onClick={() => setLateChargeDraft(null)} aria-label="Close late charge form" />
      <form className="relative my-6 w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]" onSubmit={applyLateCharge}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-500">Overdue payment</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="late-charge-dialog-title">{existing ? 'Edit late charge' : 'Review late charge'}</h2><p className="mt-1 text-xs text-slate-400">{statement.soaNumber} · {schedule.label} · {schedule.daysLate} days late</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setLateChargeDraft(null)}><Icon path="M18 6 6 18M6 6l12 12" /></button></header>
        <div className="space-y-4 px-6 py-5">
          {lateChargeError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{lateChargeError}</div> : null}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div><p className="text-[9px] font-bold uppercase text-slate-400">Principal overdue</p><p className="mt-1.5 text-sm font-extrabold text-brand-blue">{formatPeso(schedule.balance)}</p></div><div><p className="text-[9px] font-bold uppercase text-slate-400">Grace ended</p><p className="mt-1.5 text-sm font-extrabold text-red-600">{formatDate(schedule.graceEndDate)}</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>Charge method</label><AnimatedDropdown value={lateChargeDraft.type} options={[{ value: 'Percentage' }, { value: 'Fixed amount' }]} onChange={updateType} ariaLabel="Late charge method" /></div><div><label className={labelClassName} htmlFor="late-charge-rate">{lateChargeDraft.type === 'Percentage' ? 'Interest rate (%)' : 'Fixed amount (PHP)'}</label><input className={fieldClassName} id="late-charge-rate" type="number" min="0" step="0.01" value={lateChargeDraft.rateValue} onChange={(event) => updateRate(Number(event.target.value))} required /></div><div><label className={labelClassName}>Calculated charge</label><div className="grid h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-500">{formatPeso(calculated)}</div></div><div><label className={labelClassName} htmlFor="late-charge-final">Final charge</label><input className={fieldClassName} id="late-charge-final" type="number" min="0.01" step="0.01" value={lateChargeDraft.finalAmount} onChange={(event) => setLateChargeDraft((current) => current ? { ...current, finalAmount: Number(event.target.value) } : null)} required /></div></div>
          <div><label className={labelClassName} htmlFor="late-charge-reason">Reason / note</label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-brand-blue outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="late-charge-reason" value={lateChargeDraft.reason} onChange={(event) => setLateChargeDraft((current) => current ? { ...current, reason: event.target.value } : null)} placeholder="Required when waiving; optional when applying" /></div>
          <p className="text-[10px] leading-5 text-slate-400">The final amount is editable for this overdue installment. Every apply, edit, and waiver is recorded in the activity log.</p>
        </div>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><div>{existing?.status === 'Applied' ? <button className="h-10 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-red-600 hover:bg-red-50" type="button" onClick={waiveLateCharge}>Waive charge</button> : null}</div><div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setLateChargeDraft(null)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white" type="submit">{existing ? 'Save charge' : 'Apply charge'}</button></div></footer>
      </form>
    </div>
  }

  return <div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-96 bg-[radial-gradient(circle_at_100%_0%,rgba(14,165,233,0.1),transparent_62%)]" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">Client balances</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-brand-blue">Statements of Account</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Combine approved quotations for one client and track payments and remaining balances.</p></div></div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total statements" value={String(statements.length)} tone="blue" /><Metric label="Receivables" value={formatPeso(totalReceivables)} tone="orange" /><Metric label="Overdue" value={String(overdueCount)} tone="red" /><Metric label="Settled" value={String(settledCount)} tone="green" /><Metric label="Payments received" value={formatPeso(totalPayments)} tone="violet" /></div>
    </SummarySurface>
    {storageError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{storageError}</div> : null}
    <TableControls tableId="statements-table" storageKey="statements.table" columns={[{ index: 1, label: 'Statement date' }, { index: 2, label: 'SOA number', required: true }, { index: 3, label: 'Client' }, { index: 4, label: 'Coverage' }, { index: 5, label: 'Records' }, { index: 6, label: 'Total charges' }, { index: 7, label: 'Balance' }, { index: 8, label: 'Status' }, { index: 9, label: 'Action', required: true }]} sortKey={statementTable.sortKey} sortOptions={statementSortOptions} onSortChange={statementTable.setSortKey} page={statementTable.page} pageCount={statementTable.pageCount} pageSize={statementTable.pageSize} onPageChange={statementTable.setPage} onPageSizeChange={statementTable.setPageSize} total={statementTable.total} />
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-sm font-extrabold text-brand-blue">SOA register</h3><p className="mt-1 text-[10px] text-slate-400">All client statements, quotation records, and balances</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Icon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs font-medium text-brand-blue outline-none focus:border-brand-blue/30 sm:w-64" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SOA, client, quotation..." /></div><AnimatedDropdown className="sm:min-w-44" size="filter" value={statusFilter} options={filterOptions} onChange={setStatusFilter} ariaLabel="Filter statement status" /><CreateRecordButton onClick={openNew}>Create statement</CreateRecordButton></div></header>
      {isLoadingStatements ? <RecordListSkeleton variant="table" rows={5} columns={9} /> : !hasLoadedStatements ? null : filteredStatements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-5 py-3.5">Statement date</th><th className="px-5 py-3.5">SOA number</th><th className="px-5 py-3.5">Client</th><th className="px-5 py-3.5">Coverage</th><th className="px-5 py-3.5 text-center">Records</th><th className="px-5 py-3.5 text-right">Total charges</th><th className="px-5 py-3.5 text-right">Balance</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Action</th></tr></thead><tbody>{filteredStatements.map((statement) => { const status = effectiveStatus(statement); const itemCount = statement.quotations.reduce((total, quotation) => total + quotation.items.length, 0); return <tr className="border-t border-slate-100 transition hover:bg-blue-50/25" key={statement.id}><td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDate(statement.statementDate)}</td><td className="px-5 py-4 font-mono text-xs font-extrabold text-brand-blue">{statement.soaNumber}</td><td className="px-5 py-4"><p className="text-xs font-extrabold text-slate-700">{statement.clientName}</p><p className="mt-1 text-[9px] text-slate-400">{statement.contactPerson || 'No contact person'}</p></td><td className="px-5 py-4 text-[10px] font-semibold text-slate-500">{formatDate(statement.coverageFrom)} – {formatDate(statement.coverageTo)}</td><td className="px-5 py-4 text-center"><p className="text-xs font-extrabold text-brand-blue">{statement.quotations.length} quotation{statement.quotations.length === 1 ? '' : 's'}</p><p className="mt-1 text-[9px] text-slate-400">{itemCount} items</p></td><td className="px-5 py-4 text-right text-xs font-bold tabular-nums text-slate-600">{formatPeso(statement.totalCharges)}</td><td className={`px-5 py-4 text-right text-xs font-extrabold tabular-nums ${statement.balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatPeso(statement.balance)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-lg px-2.5 py-1 text-[9px] font-bold ${statusTone(status)}`}>{status}</span></td><td className="px-5 py-4 text-right"><Button className="group" size="small" variant="secondary" trailingIcon={<Icon className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" path="m9 18 6-6-6-6" />} onClick={() => navigate(`/statement-of-account/${statement.id}`)}>View</Button></td></tr> })}</tbody></table></div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-brand-blue"><Icon className="size-5" path="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" /></span><h3 className="mt-4 text-base font-bold text-brand-blue">{statements.length ? 'No matching statements' : 'Create your first statement'}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{statements.length ? 'Try clearing the current search or status filter.' : 'Select a client and combine one or more approved quotations into a professional account record.'}</p>{!statements.length ? <Button className="group mt-5" variant="primary" leadingIcon={<Icon className="size-4 transition-transform duration-200 group-hover:rotate-90" path="M12 5v14M5 12h14" />} onClick={openNew}>Create statement</Button> : null}</div></div>}
    </section>
    {isFormOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="soa-form-title"><button className="absolute inset-0" type="button" onClick={() => setIsFormOpen(false)} aria-label="Close statement form" /><form className="relative my-6 w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]" onSubmit={saveStatement}><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Statement details</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="soa-form-title">{editingId ? 'Edit statement' : 'New statement of account'}</h2><p className="mt-1 text-xs text-slate-400">Choose approved quotations and set the dates.</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setIsFormOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">{formError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{formError}</div> : null}<div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><section><SectionTitle icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" title="Client account" detail="Selected from Clients" /><label className={labelClassName}>Client name</label><button className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 text-left transition hover:border-brand-blue/25 hover:bg-blue-50/30" type="button" onClick={() => setIsClientPickerOpen(true)}><span><span className={`block text-sm font-bold ${selectedClient ? 'text-brand-blue' : 'text-slate-300'}`}>{selectedClient?.name ?? 'Select a registered client'}</span>{selectedClient ? <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">{selectedClient.industry || 'Industry not provided'} · {selectedClient.status}</span> : null}</span><span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-orange">Choose<Icon className="size-3" path="m9 18 6-6-6-6" /></span></button><div className="mt-4"><label className={labelClassName} htmlFor="soa-contact">Contact person</label><input className={fieldClassName} id="soa-contact" value={draft.contactPerson} onChange={(event) => setDraft((current) => ({ ...current, contactPerson: event.target.value }))} placeholder="Auto-filled from client" /></div></section><section><SectionTitle icon="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" title="Statement details" detail="Number, status, and dates" /><div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>SOA number</label><input className={`${fieldClassName} bg-slate-50 font-mono font-extrabold`} value={draft.soaNumber} readOnly /></div><div><label className={labelClassName}>Status</label><AnimatedDropdown value={draft.status} options={statusOptions.filter((option) => option.value !== 'Cancelled')} onChange={(status) => setDraft((current) => ({ ...current, status }))} ariaLabel="Statement status" /></div><div><label className={labelClassName}>Statement date</label><AnimatedDatePicker value={draft.statementDate} onChange={(statementDate) => setDraft((current) => ({ ...current, statementDate, dueDate: datePlusDays(statementDate, 30) }))} ariaLabel="Statement date" required /></div><div><label className={labelClassName}>Due date</label><AnimatedDatePicker value={draft.dueDate} onChange={(dueDate) => setDraft((current) => ({ ...current, dueDate }))} ariaLabel="Due date" min={draft.statementDate} required /></div><div><label className={labelClassName}>Coverage from</label><AnimatedDatePicker value={draft.coverageFrom} onChange={(coverageFrom) => setDraft((current) => ({ ...current, coverageFrom }))} ariaLabel="Coverage start" required /></div><div><label className={labelClassName}>Coverage to</label><AnimatedDatePicker value={draft.coverageTo} onChange={(coverageTo) => setDraft((current) => ({ ...current, coverageTo }))} ariaLabel="Coverage end" min={draft.coverageFrom} required /></div></div></section></div><section className="mt-6 border-t border-slate-100 pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><SectionTitle icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6M8 13h8M8 17h5" title="Approved quotations" detail="Choose one or more quotations for this client" /><span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{draft.quotationIds.length} selected</span></div>{draft.clientId ? eligibleQuotations.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{eligibleQuotations.map((quotation) => { const selected = draft.quotationIds.includes(quotation.id); return <button className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${selected ? 'border-brand-orange bg-orange-50/45 ring-2 ring-brand-orange/[0.07]' : 'border-slate-200 bg-slate-50/45 hover:border-brand-blue/20'}`} type="button" onClick={() => toggleQuotation(quotation.id)} key={quotation.id}><div className="flex items-start gap-3"><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${selected ? 'border-brand-orange bg-brand-orange text-white' : 'border-slate-300 bg-white text-transparent'}`}><Icon className="size-3" path="m5 12 4 4L19 6" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-extrabold text-brand-blue">{quotation.quotationNumber}</p><p className="mt-1 text-[9px] text-slate-400">{formatDate(quotation.dateCreated)} · {quotation.items.length} items</p></div><strong className="text-sm text-brand-blue">{formatPeso(quotation.totalAmount)}</strong></div><p className="mt-3 truncate text-xs font-bold text-slate-700">{quotation.subject}</p><p className="mt-1 truncate text-[10px] text-slate-400">{quotation.projectLocation}</p></div></div></button>})}</div> : <EmptySelection title="No available approved quotations" detail="Approve a quotation for this client first, or check whether it is already assigned to another active statement." /> : <EmptySelection title="Select a client first" detail="Available approved quotations will appear here automatically." />}</section>{selectedQuotations.length ? <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200"><header className="flex items-center justify-between bg-slate-50/70 px-4 py-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Items in this statement</h3><p className="mt-1 text-[9px] text-slate-400">All items included in the selected quotations</p></div><span className="text-[10px] font-bold text-slate-500">{selectedQuotations.reduce((total, quotation) => total + quotation.items.length, 0)} items</span></header><div className="max-h-72 overflow-auto"><table className="w-full min-w-[760px] text-left"><thead className="sticky top-0 bg-white"><tr className="text-[9px] font-bold uppercase text-slate-400"><th className="px-4 py-3">Quotation</th><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Unit price</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{selectedQuotations.flatMap((quotation) => quotation.items.map((item) => <tr className="border-t border-slate-100" key={`${quotation.id}-${item.id}`}><td className="px-4 py-3 font-mono text-[9px] font-bold text-violet-700">{quotation.quotationNumber}</td><td className="px-4 py-3"><p className="text-xs font-bold text-slate-700">{item.itemName}</p><p className="mt-1 text-[9px] text-slate-400">{item.productCode}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</p></td><td className="px-4 py-3 text-right text-xs text-slate-600">{item.quantity} {item.unitOfMeasure}</td><td className="px-4 py-3 text-right text-xs text-slate-600">{formatPeso(item.unitPrice)}</td><td className="px-4 py-3 text-right text-xs font-extrabold text-brand-blue">{formatPeso(item.quantity * item.unitPrice)}</td></tr>))}</tbody></table></div></section> : null}<div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 lg:grid-cols-[1fr_0.75fr]"><section><label className={labelClassName} htmlFor="soa-notes">Notes / remarks</label><textarea className="min-h-28 w-full resize-y rounded-xl border border-slate-200 p-3.5 text-sm text-brand-blue outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="soa-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal account notes or payment instructions" /><div className="mt-4"><label className={labelClassName} htmlFor="soa-opening">Previous / opening balance</label><input className={fieldClassName} id="soa-opening" type="number" min="0" step="0.01" value={draft.openingBalance} onChange={(event) => setDraft((current) => ({ ...current, openingBalance: event.target.value }))} /><p className="mt-1.5 text-[9px] text-slate-400">Use only for a balance that existed before the selected quotations.</p></div></section><aside className="rounded-2xl bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Account summary</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-white/65"><span>Opening balance</span><strong className="text-white">{formatPeso(draftOpeningBalance)}</strong></div><div className="flex justify-between text-white/65"><span>Quotation charges</span><strong className="text-white">{formatPeso(draftQuotationTotal)}</strong></div><div className="flex justify-between text-white/65"><span>Approved quotations</span><strong className="text-white">{selectedQuotations.length}</strong></div></div><div className="mt-5 border-t border-white/15 pt-5"><div className="flex items-end justify-between gap-4"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Statement total</span><strong className="text-2xl font-extrabold">{formatPeso(draftTotal)}</strong></div></div></aside></div></div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><p className="text-[10px] font-semibold text-slate-400">The statement keeps a copy of the selected quotation amounts.</p><div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white disabled:opacity-40" type="submit" disabled={!clients.length}>{editingId ? 'Save changes' : 'Create statement'}</button></div></footer></form></div> : null}
    {isPaymentArrangementOpen ? <PaymentArrangementDialog totalAmount={draftTotal} statementDate={draft.statementDate} defaultDueDate={draft.dueDate} paymentArrangement={draft.paymentArrangement} paymentFrequency={draft.paymentFrequency} paymentSchedule={draft.paymentSchedule} lateChargePolicy={editingStatement?.lateChargePolicy ?? loadLateChargePolicy()} isEditing={Boolean(editingStatement)} onConfirm={confirmPaymentArrangement} onClose={() => setIsPaymentArrangementOpen(false)} /> : null}
    {isClientPickerOpen ? <PurchaseOrderClientPickerDialog clients={clients} selectedClientId={draft.clientId} onSelect={selectClient} onClose={() => setIsClientPickerOpen(false)} /> : null}
    {renderPaymentDialog()}
    {renderLateChargeDialog()}
    {isFormOpen ? <DocumentContentFormSectionPortal dialogTitleId="soa-form-title" hideExistingFieldId="soa-notes" idPrefix="soa-document" notes={draft.notes} terms={draft.terms} defaultTerms={loadDocumentDefaults().statementPaymentInstructions} notesPlaceholder="Add account-specific notes or remarks..." termsPlaceholder="Add one condition or payment instruction per line..." onNotesChange={(notes) => setDraft((current) => ({ ...current, notes }))} onTermsChange={(terms) => setDraft((current) => ({ ...current, terms }))} /> : null}
    {isFormOpen ? <DocumentFormScaffold dialogTitleId="soa-form-title" breakdown={[{ label: 'Opening balance', value: formatPeso(draftOpeningBalance), muted: draftOpeningBalance === 0 }, { label: 'Charges', value: formatPeso(draftQuotationTotal) }]} totalLabel="Total" totalValue={formatPeso(draftTotal)} helperText="The final action opens payment scheduling, where late interest remains optional." backLabel="Back to statements" onCancel={closeStatementFormPage} actions={editingId ? [{ label: 'Save changes', intent: 'preserve' }, ...(draft.status === 'Draft' ? [{ label: 'Review & Issue', intent: 'issue', tone: 'primary' as const }] : [])] : [{ label: 'Save Draft', intent: 'draft' }, { label: 'Review & Issue', intent: 'issue', tone: 'primary', disabled: !clients.length }]} /> : null}
    <SuccessToast message={toast} />
  </div>
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'orange' | 'red' | 'green' | 'violet' }) {
  const tones = { blue: 'border-blue-100 bg-blue-50/55 text-brand-blue', orange: 'border-orange-100 bg-orange-50/55 text-orange-700', red: 'border-red-100 bg-red-50/55 text-red-600', green: 'border-emerald-100 bg-emerald-50/55 text-emerald-700', violet: 'border-violet-100 bg-violet-50/55 text-violet-700' }
  return <article className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">{label}</p><p className="mt-2 text-lg font-extrabold tracking-[-0.03em]">{value}</p></article>
}

function SectionTitle({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return <div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Icon path={icon} /></span><div><h3 className="text-xs font-extrabold text-brand-blue">{title}</h3><p className="text-[10px] text-slate-400">{detail}</p></div></div>
}

function EmptySelection({ title, detail }: { title: string; detail: string }) {
  return <div className="mt-4 grid min-h-28 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/45 p-5 text-center"><div><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-1 max-w-lg text-[10px] leading-4 text-slate-400">{detail}</p></div></div>
}
