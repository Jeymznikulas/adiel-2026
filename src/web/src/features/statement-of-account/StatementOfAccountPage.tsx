import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { appendSystemLog } from '../../services/activityLog'
import { PurchaseOrderClientPickerDialog } from '../purchase-orders/PurchaseOrderClientPickerDialog'
import { PaymentArrangementDialog, type PaymentArrangementValues } from './PaymentArrangementDialog'
import { PaymentScheduleOverview } from './PaymentScheduleOverview'
import { getNextScheduleEntry } from './statementPaymentSchedule'
import { StatementOfAccountProfile } from './StatementOfAccountProfile'
import type { PaymentArrangement, PaymentFrequency, PaymentScheduleEntry, StatementOfAccount, StatementPayment, StatementQuotation, StatementStatus } from './statementOfAccountTypes'

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
}

type PaymentDraft = {
  date: string
  amount: string
  method: string
  referenceNumber: string
  notes: string
}

type StatementOfAccountPageProps = { currentUsername: string }

const statementStorageKey = 'adiel.statements-of-account'
const clientStorageKey = 'adiel.clients'
const quotationStorageKey = 'adiel.quotations'
const statuses: StatementStatus[] = ['Draft', 'Issued', 'Partially Settled', 'Settled', 'Overdue', 'Cancelled']
const paymentArrangements: PaymentArrangement[] = ['Full payment', 'Installment', 'Custom schedule']
const paymentFrequencies: PaymentFrequency[] = ['Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly', 'Custom']
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
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(clientStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const client = value as Partial<Client>
      if (typeof client.id !== 'string' || typeof client.name !== 'string') return []
      return [{ id: client.id, name: client.name, status: client.status ?? 'Active', address: client.address ?? '', industry: client.industry ?? '', contactPerson: client.contactPerson ?? '', email: client.email ?? '', phone: client.phone ?? '' }]
    })
  } catch {
    return []
  }
}

function loadQuotations(): SourceQuotation[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(quotationStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const quotation = value as Partial<SourceQuotation>
      if (typeof quotation.id !== 'string' || typeof quotation.quotationNumber !== 'string' || typeof quotation.clientId !== 'string') return []
      return [{
        id: quotation.id,
        dateCreated: quotation.dateCreated ?? '',
        quotationNumber: quotation.quotationNumber,
        clientId: quotation.clientId,
        clientName: quotation.clientName ?? '',
        contactPerson: quotation.contactPerson ?? '',
        subject: quotation.subject ?? '',
        projectLocation: quotation.projectLocation ?? '',
        items: Array.isArray(quotation.items) ? quotation.items : [],
        subtotalAmount: Number(quotation.subtotalAmount) || 0,
        vatEnabled: Boolean(quotation.vatEnabled),
        vatAmount: Number(quotation.vatAmount) || 0,
        otherCharges: Array.isArray(quotation.otherCharges) ? quotation.otherCharges : [],
        totalAmount: Number(quotation.totalAmount) || 0,
        status: quotation.status ?? 'For Approval',
      }]
    })
  } catch {
    return []
  }
}

function loadStatements(): StatementOfAccount[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(statementStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const saved = value as Partial<StatementOfAccount>
      if (typeof saved.id !== 'string' || typeof saved.soaNumber !== 'string') return []
      const quotations = Array.isArray(saved.quotations) ? saved.quotations : []
      const payments = Array.isArray(saved.payments) ? saved.payments : []
      const totalCharges = quotations.reduce((total, quotation) => total + (Number(quotation.totalAmount) || 0), 0)
      const totalPayments = payments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0)
      const openingBalance = Number(saved.openingBalance) || 0
      const accountTotal = openingBalance + totalCharges
      const paymentArrangement = paymentArrangements.includes(saved.paymentArrangement as PaymentArrangement) ? saved.paymentArrangement as PaymentArrangement : 'Full payment'
      const paymentFrequency = paymentFrequencies.includes(saved.paymentFrequency as PaymentFrequency) ? saved.paymentFrequency as PaymentFrequency : 'Custom'
      const savedSchedule = Array.isArray(saved.paymentSchedule) ? saved.paymentSchedule.filter((entry): entry is PaymentScheduleEntry => typeof entry?.id === 'string' && typeof entry.label === 'string' && typeof entry.dueDate === 'string' && typeof entry.amount === 'number' && entry.amount > 0) : []
      const paymentSchedule = savedSchedule.length ? savedSchedule : [{ id: `legacy-${saved.id}`, label: 'Full payment', dueDate: saved.dueDate ?? saved.statementDate ?? '', amount: accountTotal }]
      const nextScheduledPayment = getNextScheduleEntry(paymentSchedule, totalPayments)
      return [{
        id: saved.id,
        soaNumber: saved.soaNumber,
        statementDate: saved.statementDate ?? new Date().toISOString().slice(0, 10),
        coverageFrom: saved.coverageFrom ?? saved.statementDate ?? '',
        coverageTo: saved.coverageTo ?? saved.statementDate ?? '',
        dueDate: nextScheduledPayment?.dueDate ?? saved.dueDate ?? saved.statementDate ?? '',
        clientId: saved.clientId ?? '',
        clientName: saved.clientName ?? '',
        contactPerson: saved.contactPerson ?? '',
        quotations,
        openingBalance,
        totalCharges,
        payments,
        totalPayments,
        balance: Math.max(0, openingBalance + totalCharges - totalPayments),
        paymentArrangement,
        paymentFrequency,
        paymentSchedule,
        status: statuses.includes(saved.status as StatementStatus) ? saved.status as StatementStatus : 'Draft',
        notes: saved.notes ?? '',
        createdAt: saved.createdAt ?? new Date().toISOString(),
        updatedAt: saved.updatedAt ?? new Date().toISOString(),
      }]
    })
  } catch {
    return []
  }
}

function effectiveStatus(statement: StatementOfAccount): StatementStatus {
  if (statement.status === 'Cancelled' || statement.status === 'Draft') return statement.status
  if (statement.balance <= 0) return 'Settled'
  if (statement.dueDate && statement.dueDate < new Date().toISOString().slice(0, 10)) return 'Overdue'
  if (statement.totalPayments > 0) return 'Partially Settled'
  return statement.status === 'Overdue' ? 'Issued' : statement.status
}

function statusTone(status: StatementStatus) {
  if (status === 'Settled') return 'bg-emerald-50 text-emerald-700'
  if (status === 'Partially Settled') return 'bg-amber-50 text-amber-700'
  if (status === 'Overdue') return 'bg-red-50 text-red-600'
  if (status === 'Issued') return 'bg-sky-50 text-sky-700'
  return 'bg-slate-100 text-slate-600'
}

export function StatementOfAccountPage({ currentUsername }: StatementOfAccountPageProps) {
  const [statements, setStatements] = useState<StatementOfAccount[]>(loadStatements)
  const [clients, setClients] = useState<Client[]>(loadClients)
  const [quotations, setQuotations] = useState<SourceQuotation[]>(loadQuotations)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All statuses')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<StatementDraft>(() => emptyDraft([], []))
  const [formError, setFormError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [toast, setToast] = useState('')
  const [paymentStatementId, setPaymentStatementId] = useState<string | null>(null)
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(() => emptyPayment())
  const [paymentError, setPaymentError] = useState('')
  const [isPaymentArrangementOpen, setIsPaymentArrangementOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  function makeNumber(date: string) {
    const year = date.slice(0, 4)
    const highest = statements.reduce((maximum, statement) => {
      const match = statement.soaNumber.match(new RegExp(`^SOA-${year}-(\\d+)$`))
      return Math.max(maximum, match ? Number(match[1]) : 0)
    }, 0)
    return `SOA-${year}-${String(highest + 1).padStart(3, '0')}`
  }

  function emptyDraft(statementList = statements, clientList = clients): StatementDraft {
    const today = new Date().toISOString().slice(0, 10)
    const year = today.slice(0, 4)
    const highest = statementList.reduce((maximum, statement) => {
      const match = statement.soaNumber.match(new RegExp(`^SOA-${year}-(\\d+)$`))
      return Math.max(maximum, match ? Number(match[1]) : 0)
    }, 0)
    const firstClient = clientList.find((client) => client.status === 'Active')
    return { soaNumber: `SOA-${year}-${String(highest + 1).padStart(3, '0')}`, statementDate: today, coverageFrom: today, coverageTo: today, dueDate: datePlusDays(today, 30), clientId: firstClient?.id ?? '', contactPerson: firstClient?.contactPerson ?? '', quotationIds: [], openingBalance: '0', paymentArrangement: 'Full payment', paymentFrequency: 'Custom', paymentSchedule: [], status: 'Draft', notes: '' }
  }

  function emptyPayment(): PaymentDraft {
    return { date: new Date().toISOString().slice(0, 10), amount: '', method: 'Bank transfer', referenceNumber: '', notes: '' }
  }

  useEffect(() => {
    function refreshData() {
      setClients(loadClients())
      setQuotations(loadQuotations())
    }
    function handleNavigation() { setCurrentPath(window.location.pathname) }
    window.addEventListener('storage', refreshData)
    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('adiel:navigate', handleNavigation)
    return () => {
      window.removeEventListener('storage', refreshData)
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('adiel:navigate', handleNavigation)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(statementStorageKey, JSON.stringify(statements))
      setStorageError('')
    } catch {
      setStorageError('Statements could not be saved in this browser. Free some storage and try again.')
    }
  }, [statements])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const routeMatch = currentPath.match(/^\/statement-of-account\/([^/]+)$/)
  const profileId = routeMatch?.[1]
  const profileStatement = profileId ? statements.find((statement) => statement.id === decodeURIComponent(profileId)) : undefined
  const selectedClient = clients.find((client) => client.id === draft.clientId)
  const editingStatement = editingId ? statements.find((statement) => statement.id === editingId) : undefined
  const usedQuotationIds = useMemo(() => new Set(statements.filter((statement) => statement.id !== editingId && statement.status !== 'Cancelled').flatMap((statement) => statement.quotations.map((quotation) => quotation.id))), [editingId, statements])
  const eligibleQuotations = useMemo(() => quotations.filter((quotation) => quotation.status === 'Approved' && quotation.clientId === draft.clientId && (!usedQuotationIds.has(quotation.id) || draft.quotationIds.includes(quotation.id))).sort((left, right) => right.dateCreated.localeCompare(left.dateCreated)), [draft.clientId, draft.quotationIds, quotations, usedQuotationIds])
  const selectedQuotations = eligibleQuotations.filter((quotation) => draft.quotationIds.includes(quotation.id))
  const draftQuotationTotal = selectedQuotations.reduce((total, quotation) => total + quotation.totalAmount, 0)
  const draftOpeningBalance = Number(draft.openingBalance) || 0
  const draftTotal = draftQuotationTotal + draftOpeningBalance
  const filteredStatements = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...statements].filter((statement) => {
      const status = effectiveStatus(statement)
      const matchesStatus = statusFilter === 'All statuses' || status === statusFilter
      const matchesSearch = !query || [statement.soaNumber, statement.clientName, statement.contactPerson, ...statement.quotations.map((quotation) => quotation.quotationNumber)].some((value) => value.toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    }).sort((left, right) => right.statementDate.localeCompare(left.statementDate))
  }, [search, statements, statusFilter])

  const totalReceivables = statements.filter((statement) => statement.status !== 'Cancelled').reduce((total, statement) => total + statement.balance, 0)
  const totalPayments = statements.reduce((total, statement) => total + statement.totalPayments, 0)
  const overdueCount = statements.filter((statement) => effectiveStatus(statement) === 'Overdue').length
  const settledCount = statements.filter((statement) => effectiveStatus(statement) === 'Settled').length

  function navigate(path: string) {
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    window.dispatchEvent(new Event('adiel:navigate'))
  }

  function openNew() {
    setEditingId(null)
    setDraft(emptyDraft())
    setIsPaymentArrangementOpen(false)
    setFormError('')
    setIsFormOpen(true)
  }

  function openEdit(statement: StatementOfAccount) {
    setEditingId(statement.id)
    setDraft({ soaNumber: statement.soaNumber, statementDate: statement.statementDate, coverageFrom: statement.coverageFrom, coverageTo: statement.coverageTo, dueDate: statement.dueDate, clientId: statement.clientId, contactPerson: statement.contactPerson, quotationIds: statement.quotations.map((quotation) => quotation.id), openingBalance: String(statement.openingBalance), paymentArrangement: statement.paymentArrangement, paymentFrequency: statement.paymentFrequency, paymentSchedule: statement.paymentSchedule, status: statement.status, notes: statement.notes })
    setFormError('')
    setIsPaymentArrangementOpen(false)
    setIsFormOpen(true)
  }

  function selectClient(clientId: string) {
    const client = clients.find((entry) => entry.id === clientId)
    setDraft((current) => ({ ...current, clientId, contactPerson: client?.contactPerson ?? '', quotationIds: [] }))
    setIsClientPickerOpen(false)
  }

  function toggleQuotation(quotationId: string) {
    setDraft((current) => ({ ...current, quotationIds: current.quotationIds.includes(quotationId) ? current.quotationIds.filter((id) => id !== quotationId) : [...current.quotationIds, quotationId] }))
  }

  function snapshotQuotation(quotation: SourceQuotation): StatementQuotation {
    return {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      dateCreated: quotation.dateCreated,
      subject: quotation.subject,
      projectLocation: quotation.projectLocation,
      subtotalAmount: quotation.subtotalAmount,
      vatEnabled: quotation.vatEnabled,
      vatAmount: quotation.vatAmount,
      otherCharges: quotation.otherCharges.map((charge) => ({ ...charge })),
      totalAmount: quotation.totalAmount,
      items: quotation.items.map((line) => ({ id: crypto.randomUUID(), quotationId: quotation.id, quotationNumber: quotation.quotationNumber, itemId: line.itemId, variantId: line.variantId, photo: line.photo, itemName: line.itemName, variantLabel: line.variantLabel, productCode: line.productCode, unitOfMeasure: line.unitOfMeasure, quantity: line.quantity, unitPrice: line.unitPrice, amount: line.quantity * line.unitPrice })),
    }
  }

  function saveStatement(event: FormEvent) {
    event.preventDefault()
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

  function confirmPaymentArrangement(arrangementValues: PaymentArrangementValues) {
    const client = clients.find((entry) => entry.id === draft.clientId)
    if (!client) return
    const sourceQuotations = quotations.filter((quotation) => draft.quotationIds.includes(quotation.id) && quotation.status === 'Approved' && quotation.clientId === client.id)
    if (sourceQuotations.length !== draft.quotationIds.length || sourceQuotations.some((quotation) => usedQuotationIds.has(quotation.id))) {
      setIsPaymentArrangementOpen(false)
      setFormError('One or more quotations are no longer available. Refresh your selection and try again.')
      return
    }
    const now = new Date().toISOString()
    const quotationSnapshots = sourceQuotations.map(snapshotQuotation)
    const payments = editingStatement?.payments ?? []
    const openingBalance = Number(draft.openingBalance) || 0
    const totalCharges = quotationSnapshots.reduce((total, quotation) => total + quotation.totalAmount, 0)
    const totalPayments = payments.reduce((total, payment) => total + payment.amount, 0)
    const balance = Math.max(0, openingBalance + totalCharges - totalPayments)
    let status = draft.status
    if (status !== 'Cancelled' && status !== 'Draft' && totalPayments > 0) status = balance <= 0 ? 'Settled' : 'Partially Settled'
    const nextPayment = getNextScheduleEntry(arrangementValues.paymentSchedule, totalPayments)
    const statementValues: StatementOfAccount = { id: editingStatement?.id ?? crypto.randomUUID(), soaNumber: editingStatement?.soaNumber ?? makeNumber(draft.statementDate), statementDate: draft.statementDate, coverageFrom: draft.coverageFrom, coverageTo: draft.coverageTo, dueDate: nextPayment?.dueDate ?? arrangementValues.paymentSchedule.at(-1)?.dueDate ?? draft.dueDate, clientId: client.id, clientName: client.name, contactPerson: draft.contactPerson.trim() || client.contactPerson, quotations: quotationSnapshots, openingBalance, totalCharges, payments, totalPayments, balance, paymentArrangement: arrangementValues.paymentArrangement, paymentFrequency: arrangementValues.paymentFrequency, paymentSchedule: arrangementValues.paymentSchedule, status, notes: draft.notes.trim(), createdAt: editingStatement?.createdAt ?? now, updatedAt: now }
    setStatements((current) => editingStatement ? current.map((statement) => statement.id === editingStatement.id ? statementValues : statement) : [statementValues, ...current])
    appendSystemLog({ module: 'Statements of Account', action: editingStatement ? 'Updated' : 'Created', recordId: statementValues.id, entity: statementValues.soaNumber, description: `${editingStatement ? 'Updated' : 'Created'} for ${statementValues.clientName} with a ${statementValues.paymentArrangement.toLowerCase()} arrangement.`, actor: currentUsername, amount: statementValues.balance, status: statementValues.status, tone: editingStatement ? 'info' : 'success' })
    setDraft((current) => ({ ...current, ...arrangementValues, dueDate: statementValues.dueDate }))
    setIsPaymentArrangementOpen(false)
    setIsFormOpen(false)
    setEditingId(null)
    setToast(editingStatement ? 'Statement and payment arrangement updated.' : 'Statement created with its payment arrangement.')
    if (profileStatement) navigate(`/statement-of-account/${statementValues.id}`)
  }

  function updateStatementStatus(statement: StatementOfAccount, status: StatementStatus) {
    const previousStatus = statement.status
    setStatements((current) => current.map((entry) => entry.id === statement.id ? { ...entry, status, updatedAt: new Date().toISOString() } : entry))
    appendSystemLog({ module: 'Statements of Account', action: 'Status changed', recordId: statement.id, entity: statement.soaNumber, description: `Status changed from ${previousStatus} to ${status}.`, actor: currentUsername, amount: statement.balance, status, tone: status === 'Settled' ? 'success' : status === 'Overdue' ? 'warning' : 'info' })
    setToast(`Statement marked ${status.toLowerCase()}.`)
  }

  function openPayment(statement: StatementOfAccount) {
    setPaymentStatementId(statement.id)
    const nextPayment = getNextScheduleEntry(statement.paymentSchedule, statement.totalPayments)
    setPaymentDraft({ ...emptyPayment(), amount: nextPayment ? String(Math.min(nextPayment.balance, statement.balance)) : '' })
    setPaymentError('')
  }

  function recordPayment(event: FormEvent) {
    event.preventDefault()
    const statement = statements.find((entry) => entry.id === paymentStatementId)
    const amount = Number(paymentDraft.amount)
    if (!statement || !paymentDraft.date || amount <= 0 || amount > statement.balance) {
      setPaymentError(`Enter a payment between ${formatPeso(0.01)} and ${formatPeso(statement?.balance ?? 0)}.`)
      return
    }
    const payment: StatementPayment = { id: crypto.randomUUID(), date: paymentDraft.date, amount, method: paymentDraft.method, referenceNumber: paymentDraft.referenceNumber.trim(), notes: paymentDraft.notes.trim(), createdAt: new Date().toISOString() }
    const totalPayments = statement.totalPayments + amount
    const balance = Math.max(0, statement.openingBalance + statement.totalCharges - totalPayments)
    const status: StatementStatus = balance <= 0 ? 'Settled' : 'Partially Settled'
    const nextPayment = getNextScheduleEntry(statement.paymentSchedule, totalPayments)
    setStatements((current) => current.map((entry) => entry.id === statement.id ? { ...entry, payments: [payment, ...entry.payments], totalPayments, balance, dueDate: nextPayment?.dueDate ?? entry.dueDate, status, updatedAt: new Date().toISOString() } : entry))
    appendSystemLog({ module: 'Statements of Account', action: 'Payment recorded', recordId: statement.id, entity: statement.soaNumber, description: `${payment.method} payment recorded for ${statement.clientName}.`, actor: currentUsername, amount, status, tone: 'success' })
    setPaymentStatementId(null)
    setToast('Payment recorded and account balance updated.')
  }

  if (profileStatement && !isFormOpen) {
    return <><div className="space-y-5"><StatementOfAccountProfile statement={profileStatement} effectiveStatus={effectiveStatus(profileStatement)} onBack={() => navigate('/statement-of-account')} onEdit={() => openEdit(profileStatement)} onRecordPayment={() => openPayment(profileStatement)} onStatusChange={(status) => updateStatementStatus(profileStatement, status)} /><PaymentScheduleOverview statement={profileStatement} /></div>{renderPaymentDialog()}<SuccessToast message={toast} /></>
  }

  function renderPaymentDialog() {
    const statement = statements.find((entry) => entry.id === paymentStatementId)
    if (!statement) return null
    return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title"><button className="absolute inset-0" type="button" onClick={() => setPaymentStatementId(null)} aria-label="Close payment form" /><form className="relative my-6 w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]" onSubmit={recordPayment}><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600">Account payment</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="payment-dialog-title">Record payment</h2><p className="mt-1 text-xs text-slate-400">{statement.soaNumber} · Balance {formatPeso(statement.balance)}</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setPaymentStatementId(null)}><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="space-y-4 px-6 py-5">{paymentError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{paymentError}</div> : null}<div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>Payment date</label><AnimatedDatePicker value={paymentDraft.date} onChange={(date) => setPaymentDraft((current) => ({ ...current, date }))} ariaLabel="Payment date" required /></div><div><label className={labelClassName} htmlFor="payment-amount">Amount</label><input className={fieldClassName} id="payment-amount" type="number" min="0.01" max={statement.balance} step="0.01" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" required /></div><div><label className={labelClassName}>Payment method</label><AnimatedDropdown value={paymentDraft.method} options={paymentMethodOptions} onChange={(method) => setPaymentDraft((current) => ({ ...current, method }))} ariaLabel="Payment method" /></div><div><label className={labelClassName} htmlFor="payment-reference">Reference number</label><input className={fieldClassName} id="payment-reference" value={paymentDraft.referenceNumber} onChange={(event) => setPaymentDraft((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="Check or transaction number" /></div></div><div><label className={labelClassName} htmlFor="payment-notes">Notes</label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-brand-blue outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="payment-notes" value={paymentDraft.notes} onChange={(event) => setPaymentDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal payment note" /></div></div><footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setPaymentStatementId(null)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white" type="submit">Record payment</button></footer></form></div>
  }

  return <div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-96 bg-[radial-gradient(circle_at_100%_0%,rgba(14,165,233,0.1),transparent_62%)]" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">Accounts receivable</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-brand-blue">Statement of Account</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Combine approved quotations for one client, review every item, and monitor payments and balances in one clear account record.</p></div><button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_12px_28px_-14px_rgba(0,20,76,0.75)] transition hover:-translate-y-0.5" type="button" onClick={openNew}><Icon path="M12 5v14M5 12h14" />Create statement</button></div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total statements" value={String(statements.length)} tone="blue" /><Metric label="Receivables" value={formatPeso(totalReceivables)} tone="orange" /><Metric label="Overdue" value={String(overdueCount)} tone="red" /><Metric label="Settled" value={String(settledCount)} tone="green" /><Metric label="Payments received" value={formatPeso(totalPayments)} tone="violet" /></div>
    </SummarySurface>
    {storageError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{storageError}</div> : null}
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-sm font-extrabold text-brand-blue">SOA register</h3><p className="mt-1 text-[10px] text-slate-400">All client statements, quotation records, and balances</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Icon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs font-medium text-brand-blue outline-none focus:border-brand-blue/30 sm:w-64" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SOA, client, quotation..." /></div><AnimatedDropdown className="sm:min-w-44" size="filter" value={statusFilter} options={filterOptions} onChange={setStatusFilter} ariaLabel="Filter statement status" /></div></header>
      {filteredStatements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-5 py-3.5">Statement date</th><th className="px-5 py-3.5">SOA number</th><th className="px-5 py-3.5">Client</th><th className="px-5 py-3.5">Coverage</th><th className="px-5 py-3.5 text-center">Records</th><th className="px-5 py-3.5 text-right">Total charges</th><th className="px-5 py-3.5 text-right">Balance</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Action</th></tr></thead><tbody>{filteredStatements.map((statement) => { const status = effectiveStatus(statement); const itemCount = statement.quotations.reduce((total, quotation) => total + quotation.items.length, 0); return <tr className="border-t border-slate-100 transition hover:bg-blue-50/25" key={statement.id}><td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDate(statement.statementDate)}</td><td className="px-5 py-4 font-mono text-xs font-extrabold text-brand-blue">{statement.soaNumber}</td><td className="px-5 py-4"><p className="text-xs font-extrabold text-slate-700">{statement.clientName}</p><p className="mt-1 text-[9px] text-slate-400">{statement.contactPerson || 'No contact person'}</p></td><td className="px-5 py-4 text-[10px] font-semibold text-slate-500">{formatDate(statement.coverageFrom)} – {formatDate(statement.coverageTo)}</td><td className="px-5 py-4 text-center"><p className="text-xs font-extrabold text-brand-blue">{statement.quotations.length} quotation{statement.quotations.length === 1 ? '' : 's'}</p><p className="mt-1 text-[9px] text-slate-400">{itemCount} items</p></td><td className="px-5 py-4 text-right text-xs font-bold tabular-nums text-slate-600">{formatPeso(statement.totalCharges)}</td><td className={`px-5 py-4 text-right text-xs font-extrabold tabular-nums ${statement.balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatPeso(statement.balance)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-lg px-2.5 py-1 text-[9px] font-bold ${statusTone(status)}`}>{status}</span></td><td className="px-5 py-4 text-right"><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:bg-blue-50" type="button" onClick={() => navigate(`/statement-of-account/${statement.id}`)}>View<Icon className="size-3" path="m9 18 6-6-6-6" /></button></td></tr> })}</tbody></table></div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-brand-blue"><Icon className="size-5" path="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" /></span><h3 className="mt-4 text-base font-bold text-brand-blue">{statements.length ? 'No matching statements' : 'Create your first statement'}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{statements.length ? 'Try clearing the current search or status filter.' : 'Select a client and combine one or more approved quotations into a professional account record.'}</p>{!statements.length ? <button className="mt-5 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={openNew}>Create statement</button> : null}</div></div>}
    </section>
    {isFormOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="soa-form-title"><button className="absolute inset-0" type="button" onClick={() => setIsFormOpen(false)} aria-label="Close statement form" /><form className="relative my-6 w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]" onSubmit={saveStatement}><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Client account record</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="soa-form-title">{editingId ? 'Edit statement' : 'New statement of account'}</h2><p className="mt-1 text-xs text-slate-400">Link approved quotations and confirm the account period.</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setIsFormOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">{formError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{formError}</div> : null}<div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><section><SectionTitle icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" title="Client account" detail="Connected to the Client Directory" /><label className={labelClassName}>Client name</label><button className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 text-left transition hover:border-brand-blue/25 hover:bg-blue-50/30" type="button" onClick={() => setIsClientPickerOpen(true)}><span><span className={`block text-sm font-bold ${selectedClient ? 'text-brand-blue' : 'text-slate-300'}`}>{selectedClient?.name ?? 'Select a registered client'}</span>{selectedClient ? <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">{selectedClient.industry || 'Industry not provided'} · {selectedClient.status}</span> : null}</span><span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-orange">Choose<Icon className="size-3" path="m9 18 6-6-6-6" /></span></button><div className="mt-4"><label className={labelClassName} htmlFor="soa-contact">Contact person</label><input className={fieldClassName} id="soa-contact" value={draft.contactPerson} onChange={(event) => setDraft((current) => ({ ...current, contactPerson: event.target.value }))} placeholder="Auto-filled from client" /></div></section><section><SectionTitle icon="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" title="Statement identity" detail="Automatic number and account schedule" /><div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>SOA number</label><input className={`${fieldClassName} bg-slate-50 font-mono font-extrabold`} value={draft.soaNumber} readOnly /></div><div><label className={labelClassName}>Status</label><AnimatedDropdown value={draft.status} options={statusOptions} onChange={(status) => setDraft((current) => ({ ...current, status }))} ariaLabel="Statement status" /></div><div><label className={labelClassName}>Statement date</label><AnimatedDatePicker value={draft.statementDate} onChange={(statementDate) => setDraft((current) => ({ ...current, statementDate, dueDate: datePlusDays(statementDate, 30) }))} ariaLabel="Statement date" required /></div><div><label className={labelClassName}>Due date</label><AnimatedDatePicker value={draft.dueDate} onChange={(dueDate) => setDraft((current) => ({ ...current, dueDate }))} ariaLabel="Due date" min={draft.statementDate} required /></div><div><label className={labelClassName}>Coverage from</label><AnimatedDatePicker value={draft.coverageFrom} onChange={(coverageFrom) => setDraft((current) => ({ ...current, coverageFrom }))} ariaLabel="Coverage start" required /></div><div><label className={labelClassName}>Coverage to</label><AnimatedDatePicker value={draft.coverageTo} onChange={(coverageTo) => setDraft((current) => ({ ...current, coverageTo }))} ariaLabel="Coverage end" min={draft.coverageFrom} required /></div></div></section></div><section className="mt-6 border-t border-slate-100 pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><SectionTitle icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6M8 13h8M8 17h5" title="Approved quotations" detail="Select one or more records for the same client" /><span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{draft.quotationIds.length} selected</span></div>{draft.clientId ? eligibleQuotations.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{eligibleQuotations.map((quotation) => { const selected = draft.quotationIds.includes(quotation.id); return <button className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${selected ? 'border-brand-orange bg-orange-50/45 ring-2 ring-brand-orange/[0.07]' : 'border-slate-200 bg-slate-50/45 hover:border-brand-blue/20'}`} type="button" onClick={() => toggleQuotation(quotation.id)} key={quotation.id}><div className="flex items-start gap-3"><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${selected ? 'border-brand-orange bg-brand-orange text-white' : 'border-slate-300 bg-white text-transparent'}`}><Icon className="size-3" path="m5 12 4 4L19 6" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-extrabold text-brand-blue">{quotation.quotationNumber}</p><p className="mt-1 text-[9px] text-slate-400">{formatDate(quotation.dateCreated)} · {quotation.items.length} items</p></div><strong className="text-sm text-brand-blue">{formatPeso(quotation.totalAmount)}</strong></div><p className="mt-3 truncate text-xs font-bold text-slate-700">{quotation.subject}</p><p className="mt-1 truncate text-[10px] text-slate-400">{quotation.projectLocation}</p></div></div></button>})}</div> : <EmptySelection title="No available approved quotations" detail="Approve a quotation for this client first, or check whether it is already assigned to another active statement." /> : <EmptySelection title="Select a client first" detail="Available approved quotations will appear here automatically." />}</section>{selectedQuotations.length ? <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200"><header className="flex items-center justify-between bg-slate-50/70 px-4 py-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Account items preview</h3><p className="mt-1 text-[9px] text-slate-400">All items included in the selected quotations</p></div><span className="text-[10px] font-bold text-slate-500">{selectedQuotations.reduce((total, quotation) => total + quotation.items.length, 0)} items</span></header><div className="max-h-72 overflow-auto"><table className="w-full min-w-[760px] text-left"><thead className="sticky top-0 bg-white"><tr className="text-[9px] font-bold uppercase text-slate-400"><th className="px-4 py-3">Quotation</th><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Unit price</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{selectedQuotations.flatMap((quotation) => quotation.items.map((item) => <tr className="border-t border-slate-100" key={`${quotation.id}-${item.id}`}><td className="px-4 py-3 font-mono text-[9px] font-bold text-violet-700">{quotation.quotationNumber}</td><td className="px-4 py-3"><p className="text-xs font-bold text-slate-700">{item.itemName}</p><p className="mt-1 text-[9px] text-slate-400">{item.productCode}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</p></td><td className="px-4 py-3 text-right text-xs text-slate-600">{item.quantity} {item.unitOfMeasure}</td><td className="px-4 py-3 text-right text-xs text-slate-600">{formatPeso(item.unitPrice)}</td><td className="px-4 py-3 text-right text-xs font-extrabold text-brand-blue">{formatPeso(item.quantity * item.unitPrice)}</td></tr>))}</tbody></table></div></section> : null}<div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 lg:grid-cols-[1fr_0.75fr]"><section><label className={labelClassName} htmlFor="soa-notes">Notes / remarks</label><textarea className="min-h-28 w-full resize-y rounded-xl border border-slate-200 p-3.5 text-sm text-brand-blue outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="soa-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal account notes or payment instructions" /><div className="mt-4"><label className={labelClassName} htmlFor="soa-opening">Previous / opening balance</label><input className={fieldClassName} id="soa-opening" type="number" min="0" step="0.01" value={draft.openingBalance} onChange={(event) => setDraft((current) => ({ ...current, openingBalance: event.target.value }))} /><p className="mt-1.5 text-[9px] text-slate-400">Use only for a balance that existed before the selected quotations.</p></div></section><aside className="rounded-2xl bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Account summary</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-white/65"><span>Opening balance</span><strong className="text-white">{formatPeso(draftOpeningBalance)}</strong></div><div className="flex justify-between text-white/65"><span>Quotation charges</span><strong className="text-white">{formatPeso(draftQuotationTotal)}</strong></div><div className="flex justify-between text-white/65"><span>Approved quotations</span><strong className="text-white">{selectedQuotations.length}</strong></div></div><div className="mt-5 border-t border-white/15 pt-5"><div className="flex items-end justify-between gap-4"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Statement total</span><strong className="text-2xl font-extrabold">{formatPeso(draftTotal)}</strong></div></div></aside></div></div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><p className="text-[10px] font-semibold text-slate-400">Quotation and item values are saved as a statement snapshot.</p><div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white disabled:opacity-40" type="submit" disabled={!clients.length}>{editingId ? 'Save changes' : 'Create statement'}</button></div></footer></form></div> : null}
    {isPaymentArrangementOpen ? <PaymentArrangementDialog totalAmount={draftTotal} statementDate={draft.statementDate} defaultDueDate={draft.dueDate} paymentArrangement={draft.paymentArrangement} paymentFrequency={draft.paymentFrequency} paymentSchedule={draft.paymentSchedule} isEditing={Boolean(editingStatement)} onConfirm={confirmPaymentArrangement} onClose={() => setIsPaymentArrangementOpen(false)} /> : null}
    {isClientPickerOpen ? <PurchaseOrderClientPickerDialog clients={clients} selectedClientId={draft.clientId} onSelect={selectClient} onClose={() => setIsClientPickerOpen(false)} /> : null}
    {renderPaymentDialog()}
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
