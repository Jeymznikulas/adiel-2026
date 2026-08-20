import type { FormEvent } from 'react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ChartLoadingState } from '../../components/charts/ChartSupport'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { VoidRecordDialog } from '../../components/ui/VoidRecordDialog'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { TableControls, useTableView } from '../../components/ui/TableControls'
import { usePersistentState } from '../../components/ui/usePersistentState'
import { WorkflowHeader } from '../../components/ui/WorkflowHeader'
import { ExpenseSettingsDialog, type ExpenseOption, type ExpenseOptionKind } from './ExpenseSettingsDialog'
import { appendSystemLog } from '../../services/activityLog'
import { isActiveRecord, notifyLifecycleChanged, withArchived, withVoided } from '../../services/recordLifecycle'
import { navigateToBusinessSettings } from '../settings/settingsStorage'

const ExpenseTrendRechart = lazy(() => import('./ExpenseCharts').then((module) => ({ default: module.ExpenseTrendRechart })))
const ExpenseCategoryRechart = lazy(() => import('./ExpenseCharts').then((module) => ({ default: module.ExpenseCategoryRechart })))

type DateFilterMode = 'all' | 'month' | 'range'
type ExpenseStatus = 'Paid' | 'Verifying' | 'To pay' | 'Overdue' | 'Cancelled'

type Expense = {
  id: number
  date: string
  payee: string
  category: string
  description: string
  amount: number
  paymentMethod: string
  purchaser: string
  status: ExpenseStatus
  invoiceLink: string
  notes: string
  quotationId: string
  quotationNumber: string
  projectName: string
}

type ApprovedQuotationOption = {
  id: string
  quotationNumber: string
  clientName: string
  subject: string
  projectLocation: string
  status: string
}

type ExpenseDraft = Omit<Expense, 'id' | 'amount'> & {
  amount: string
}

type ExpensesPageProps = {
  currentUsername: string
}

const storageKey = 'adiel.expenses'
const quotationStorageKey = 'adiel.quotations'
const categoryStorageKey = 'adiel.expense-categories'
const paymentMethodStorageKey = 'adiel.expense-payment-methods'
const defaultCategoryNames = ['Materials', 'Transportation', 'Office supplies', 'Utilities', 'Meals', 'Equipment', 'Professional fees', 'Other']
const defaultPaymentMethodNames = ['Cash', 'GCash', 'Bank transfer', 'Credit card', 'Cheque', 'Other']
const expenseStatuses: ExpenseStatus[] = ['Paid', 'Verifying', 'To pay', 'Overdue', 'Cancelled']
const expenseStatusOptions = [
  { value: 'Paid' as const, dotClassName: 'bg-emerald-500', toneClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  { value: 'Verifying' as const, dotClassName: 'bg-amber-500', toneClassName: 'border-amber-100 bg-amber-50 text-amber-700' },
  { value: 'To pay' as const, dotClassName: 'bg-sky-500', toneClassName: 'border-sky-100 bg-sky-50 text-sky-700' },
  { value: 'Overdue' as const, dotClassName: 'bg-red-500', toneClassName: 'border-red-100 bg-red-50 text-red-600' },
  { value: 'Cancelled' as const, dotClassName: 'bg-slate-400', toneClassName: 'border-slate-200 bg-slate-100 text-slate-500' },
]
const currentMonth = new Date().toISOString().slice(0, 7)

function createDefaultOptions(prefix: string, names: string[]): ExpenseOption[] {
  return names.map((name, index) => ({ id: `${prefix}-${index + 1}`, name, isActive: true }))
}

const defaultCategoryOptions = createDefaultOptions('category', defaultCategoryNames)
const defaultPaymentMethodOptions = createDefaultOptions('payment', defaultPaymentMethodNames)
const emptyDraft: ExpenseDraft = {
  date: new Date().toISOString().slice(0, 10),
  payee: '',
  category: defaultCategoryNames[0] ?? 'Other',
  description: '',
  amount: '',
  paymentMethod: defaultPaymentMethodNames[0] ?? 'Other',
  purchaser: '',
  status: 'To pay',
  invoiceLink: '',
  notes: '',
  quotationId: '',
  quotationNumber: '',
  projectName: '',
}

function loadExpenses(): Expense[] {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return (parsed as Expense[]).map((expense) => ({
      ...expense,
      status: expenseStatuses.includes(expense.status) ? expense.status : 'To pay',
      quotationId: typeof expense.quotationId === 'string' ? expense.quotationId : '',
      quotationNumber: typeof expense.quotationNumber === 'string' ? expense.quotationNumber : '',
      projectName: typeof expense.projectName === 'string' ? expense.projectName : '',
    }))
  } catch {
    return []
  }
}

function loadApprovedQuotations(): ApprovedQuotationOption[] {
  try {
    const stored = window.localStorage.getItem(quotationStorageKey)
    const parsed: unknown = stored ? JSON.parse(stored) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is ApprovedQuotationOption => typeof value === 'object' && value !== null && (value as ApprovedQuotationOption).status === 'Approved')
      .map((quotation) => ({
        id: String(quotation.id),
        quotationNumber: String(quotation.quotationNumber ?? ''),
        clientName: String(quotation.clientName ?? ''),
        subject: String(quotation.subject ?? ''),
        projectLocation: String(quotation.projectLocation ?? ''),
        status: quotation.status,
      }))
      .sort((left, right) => right.quotationNumber.localeCompare(left.quotationNumber))
  } catch {
    return []
  }
}

function loadOptions(storageKey: string, defaults: ExpenseOption[]): ExpenseOption[] {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return defaults
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.length) return defaults
    const options = parsed.filter((item): item is ExpenseOption => typeof item === 'object' && item !== null && typeof (item as ExpenseOption).id === 'string' && typeof (item as ExpenseOption).name === 'string' && typeof (item as ExpenseOption).isActive === 'boolean')
    if (!options.length) return defaults
    return options.some((option) => option.isActive) ? options : options.map((option, index) => index === 0 ? { ...option, isActive: true } : option)
  } catch {
    return defaults
  }
}

function formatPeso(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function getInvoiceUrl(value: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

type ExpenseTrendPoint = {
  key: string
  monthLabel: string
  yearLabel: string
  fullLabel: string
  total: number
  isSelected: boolean
}

type ExpenseTrendRange = '3m' | '6m' | '1y' | 'all'
type ExpenseInsight = 'categories' | 'trend'

const expenseTrendRangeOptions = [
  { value: '3m', label: '3M', description: 'Last 3 months' },
  { value: '6m', label: '6M', description: 'Last 6 months' },
  { value: '1y', label: '1Y', description: 'Last 12 months' },
  { value: 'all', label: 'All', description: 'All recorded months' },
] as const

const expenseTrendHeadings: Record<ExpenseTrendRange, string> = {
  '3m': 'Three-month',
  '6m': 'Six-month',
  '1y': 'One-year',
  all: 'All-time',
}

type ExpenseCategoryPoint = {
  name: string
  total: number
  count: number
}

type ExpenseCategoryBreakdownProps = {
  categories: ExpenseCategoryPoint[]
  selectedMonthLabel: string
  selectedMonthTotal: number
  onClose: () => void
}

function ExpenseCategoryBreakdown({ categories, selectedMonthLabel, selectedMonthTotal, onClose }: ExpenseCategoryBreakdownProps) {
  const topCategory = categories[0]
  const topCategoryShare = topCategory && selectedMonthTotal > 0 ? (topCategory.total / selectedMonthTotal) * 100 : 0

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_-26px_rgba(0,20,76,0.35)] animate-[view-swap_300ms_cubic-bezier(0.22,1,0.36,1)] sm:p-5" id="expense-category-breakdown" aria-labelledby="expense-category-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Category consumption</p>
          <h4 className="mt-1.5 text-base font-bold tracking-[-0.02em] text-brand-blue" id="expense-category-heading">Where {selectedMonthLabel} spending went</h4>
          <p className="mt-1 text-xs text-slate-400">Each bar shows its share of the selected month's {formatPeso(selectedMonthTotal)} total.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {topCategory ? <span className="inline-flex max-w-full items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[10px] font-bold text-orange-700"><span className="size-1.5 shrink-0 rounded-full bg-brand-orange" /><span className="truncate">Largest: {topCategory.name}</span><span className="shrink-0 text-orange-500">{topCategoryShare.toFixed(1)}%</span></span> : null}
          <button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue" type="button" onClick={onClose}>
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
            Hide categories
          </button>
        </div>
      </div>

      {categories.length ? (
        <Suspense fallback={<ChartLoadingState className="mt-5 h-64" />}>
          <ExpenseCategoryRechart categories={categories} total={selectedMonthTotal} />
        </Suspense>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
          <p className="text-xs font-bold text-brand-blue">No category spending for {selectedMonthLabel}</p>
          <p className="mt-1 text-[11px] text-slate-400">Add an expense in this month to see which categories consume the budget.</p>
        </div>
      )}
    </section>
  )
}

type ExpenseTrendChartProps = {
  points: ExpenseTrendPoint[]
  range: ExpenseTrendRange
  selectedMonthLabel: string
  previousMonthLabel: string
  selectedMonthTotal: number
  previousMonthTotal: number
  onRangeChange: (range: ExpenseTrendRange) => void
  onClose: () => void
}

function ExpenseTrendChart({ points, range, selectedMonthLabel, previousMonthLabel, selectedMonthTotal, previousMonthTotal, onRangeChange, onClose }: ExpenseTrendChartProps) {
  const hasData = points.some((point) => point.total > 0)
  const amountChange = selectedMonthTotal - previousMonthTotal

  return (
    <div className="mt-6 border-t border-slate-100 pt-6 animate-[view-swap_300ms_cubic-bezier(0.22,1,0.36,1)]" id="expense-trend-chart">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Spending trend</p></div>
          <h3 className="mt-2 text-lg font-bold tracking-[-0.025em] text-brand-blue">{expenseTrendHeadings[range]} expense overview</h3>
          <p className="mt-1 text-xs text-slate-400">Monthly totals through {selectedMonthLabel}. The graph updates when you select another month.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Expense graph range">
            {expenseTrendRangeOptions.map((option) => (
              <button className={`h-7 rounded-lg px-2.5 text-[10px] font-bold transition ${range === option.value ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-brand-blue'}`} type="button" key={option.value} onClick={() => onRangeChange(option.value)} aria-pressed={range === option.value} title={option.description}>{option.label}</button>
            ))}
          </div>
          <button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue" type="button" onClick={onClose}>
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
            Hide graph
          </button>
        </div>
      </div>

      {hasData ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <figure className="min-w-0" aria-labelledby="expense-trend-caption">
            <Suspense fallback={<ChartLoadingState className="h-64" />}>
              <ExpenseTrendRechart points={points} />
            </Suspense>
            <figcaption className="sr-only" id="expense-trend-caption">Monthly expense totals for the selected {expenseTrendRangeOptions.find((option) => option.value === range)?.description.toLowerCase()} range through {selectedMonthLabel}.</figcaption>
          </figure>

          <aside className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_-24px_rgba(0,20,76,0.35)]" aria-label="Selected month comparison">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Selected comparison</p>
            <dl className="mt-4 space-y-3">
              <div className="rounded-xl bg-orange-50/70 p-3"><dt className="text-[10px] font-bold text-orange-600">{selectedMonthLabel}</dt><dd className="mt-1 truncate text-base font-extrabold tracking-[-0.025em] text-brand-blue" title={formatPeso(selectedMonthTotal)}>{formatPeso(selectedMonthTotal)}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold text-slate-500">{previousMonthLabel}</dt><dd className="mt-1 truncate text-sm font-bold text-slate-600" title={formatPeso(previousMonthTotal)}>{formatPeso(previousMonthTotal)}</dd></div>
              <div className="border-t border-slate-100 pt-3"><dt className="text-[10px] font-bold text-slate-400">Amount difference</dt><dd className={`mt-1 text-sm font-extrabold ${amountChange > 0 ? 'text-red-600' : amountChange < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{amountChange > 0 ? '+' : amountChange < 0 ? '−' : ''}{formatPeso(Math.abs(amountChange))}</dd></div>
            </dl>
          </aside>
        </div>
      ) : (
        <div className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center">
          <div>
            <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /></svg></span>
            <p className="mt-3 text-sm font-bold text-brand-blue">No expense trend yet</p>
            <p className="mt-1 text-xs text-slate-400">Add expenses dated within this period to populate the graph.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function ExpensesPage({ currentUsername }: ExpensesPageProps) {
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses)
  const [approvedQuotations, setApprovedQuotations] = useState<ApprovedQuotationOption[]>(loadApprovedQuotations)
  const [categoryOptions, setCategoryOptions] = useState<ExpenseOption[]>(() => loadOptions(categoryStorageKey, defaultCategoryOptions))
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<ExpenseOption[]>(() => loadOptions(paymentMethodStorageKey, defaultPaymentMethodOptions))
  const [searchQuery, setSearchQuery] = usePersistentState('expenses.search', '')
  const [dateFilterMode, setDateFilterMode] = usePersistentState<DateFilterMode>('expenses.date-mode', 'all')
  const [selectedMonth, setSelectedMonth] = usePersistentState('expenses.month', currentMonth)
  const [openInsight, setOpenInsight] = useState<ExpenseInsight | null>(null)
  const [trendRange, setTrendRange] = useState<ExpenseTrendRange>('6m')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [categoryFilter, setCategoryFilter] = usePersistentState('expenses.category', 'All')
  const initialQuery = new URLSearchParams(window.location.search)
  const openNewOnLoad = initialQuery.get('new') === '1'
  const linkedPoIdOnLoad = initialQuery.get('poId')
  const [isAddingExpense, setIsAddingExpense] = useState(openNewOnLoad)
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null)
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(() => linkedPoIdOnLoad ? expenses.find((expense) => expense.notes.includes(`PO ID: ${linkedPoIdOnLoad}`))?.id ?? null : null)
  const [toast, setToast] = useState('')
  const [pendingVoidExpenseId, setPendingVoidExpenseId] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<ExpenseOptionKind>('categories')
  const categories = categoryOptions.filter((option) => option.isActive).map((option) => option.name)
  const paymentMethods = paymentMethodOptions.filter((option) => option.isActive).map((option) => option.name)
  const [draft, setDraft] = useState<ExpenseDraft>(() => ({ ...emptyDraft, category: categories[0] ?? emptyDraft.category, paymentMethod: paymentMethods[0] ?? emptyDraft.paymentMethod, purchaser: currentUsername }))
  const isEditingExpense = editingExpenseId !== null
  const draftCategories = categories.includes(draft.category) ? categories : [draft.category, ...categories]
  const draftPaymentMethods = paymentMethods.includes(draft.paymentMethod) ? paymentMethods : [draft.paymentMethod, ...paymentMethods]

  useEffect(() => {
    if (openNewOnLoad || linkedPoIdOnLoad) window.history.replaceState(null, '', window.location.pathname)
  }, [linkedPoIdOnLoad, openNewOnLoad])
  const selectedExpense = selectedExpenseId === null ? undefined : expenses.find((expense) => expense.id === selectedExpenseId && isActiveRecord(expense))
  const projectOptions = useMemo(() => [
    { value: '', label: 'General operations (no project)' },
    ...approvedQuotations.map((quotation) => ({
      value: quotation.id,
      label: `${quotation.quotationNumber} · ${quotation.clientName}${quotation.subject ? ` — ${quotation.subject}` : ''}`,
    })),
  ], [approvedQuotations])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(expenses))
    } catch {
      // Expense tracking remains usable when browser storage is unavailable.
    }
  }, [expenses])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    try {
      window.localStorage.setItem(categoryStorageKey, JSON.stringify(categoryOptions))
      window.localStorage.setItem(paymentMethodStorageKey, JSON.stringify(paymentMethodOptions))
    } catch {
      // Custom options remain usable for the current session.
    }
  }, [categoryOptions, paymentMethodOptions])

  useEffect(() => {
    const refreshQuotations = (event: StorageEvent) => {
      if (event.key === quotationStorageKey) setApprovedQuotations(loadApprovedQuotations())
    }
    const refreshOnNavigate = () => setApprovedQuotations(loadApprovedQuotations())
    window.addEventListener('storage', refreshQuotations)
    window.addEventListener('adiel:navigate', refreshOnNavigate)
    return () => {
      window.removeEventListener('storage', refreshQuotations)
      window.removeEventListener('adiel:navigate', refreshOnNavigate)
    }
  }, [])

  const categoryFilterOptions = useMemo(() => Array.from(new Set([...categoryOptions.map((option) => option.name), ...expenses.map((expense) => expense.category)])), [categoryOptions, expenses])
  const usedCategories = useMemo(() => new Set(expenses.map((expense) => expense.category)), [expenses])
  const usedPaymentMethods = useMemo(() => new Set(expenses.map((expense) => expense.paymentMethod)), [expenses])

  const matchingExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return expenses.filter(isActiveRecord)
      .filter((expense) => {
        const matchesSearch = !query || [expense.payee, expense.category, expense.description, expense.paymentMethod, expense.purchaser, expense.status, expense.notes, expense.quotationNumber, expense.projectName]
          .some((value) => value.toLowerCase().includes(query))
        const matchesCategory = categoryFilter === 'All' || expense.category === categoryFilter
        const matchesDate = dateFilterMode === 'all'
          || (dateFilterMode === 'month' && expense.date.startsWith(selectedMonth))
          || (dateFilterMode === 'range' && (!fromDate || expense.date >= fromDate) && (!toDate || expense.date <= toDate))
        return matchesSearch && matchesCategory && matchesDate
      })
      .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id)
  }, [categoryFilter, dateFilterMode, expenses, fromDate, searchQuery, selectedMonth, toDate])

  const expenseSortOptions = [
    { value: 'newest', label: 'Newest first', getValue: (expense: Expense) => expense.date, direction: 'desc' as const },
    { value: 'oldest', label: 'Oldest first', getValue: (expense: Expense) => expense.date, direction: 'asc' as const },
    { value: 'highest', label: 'Highest amount', getValue: (expense: Expense) => expense.amount, direction: 'desc' as const },
    { value: 'payee', label: 'Payee A-Z', getValue: (expense: Expense) => expense.payee, direction: 'asc' as const },
    { value: 'category', label: 'Category A-Z', getValue: (expense: Expense) => expense.category, direction: 'asc' as const },
  ]
  const expenseTable = useTableView({ rows: matchingExpenses, storageKey: 'expenses.table', sortOptions: expenseSortOptions })
  const visibleExpenses = expenseTable.pageRows
  const activeExpenses = useMemo(() => expenses.filter(isActiveRecord).filter((expense) => expense.status !== 'Cancelled'), [expenses])
  const visibleTotal = useMemo(() => matchingExpenses.filter((expense) => expense.status !== 'Cancelled').reduce((sum, expense) => sum + expense.amount, 0), [matchingExpenses])
  const comparisonMonth = /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : currentMonth
  const [comparisonYear = new Date().getFullYear(), comparisonMonthNumber = new Date().getMonth() + 1] = comparisonMonth.split('-').map(Number)
  const previousMonthDate = new Date(comparisonYear, comparisonMonthNumber - 2, 1)
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`
  const selectedMonthTotal = useMemo(() => activeExpenses.filter((expense) => expense.date.startsWith(comparisonMonth)).reduce((sum, expense) => sum + expense.amount, 0), [activeExpenses, comparisonMonth])
  const selectedMonthProjectTotal = useMemo(() => activeExpenses.filter((expense) => expense.date.startsWith(comparisonMonth) && expense.quotationId).reduce((sum, expense) => sum + expense.amount, 0), [activeExpenses, comparisonMonth])
  const selectedMonthOperatingTotal = useMemo(() => activeExpenses.filter((expense) => expense.date.startsWith(comparisonMonth) && !expense.quotationId).reduce((sum, expense) => sum + expense.amount, 0), [activeExpenses, comparisonMonth])
  const selectedMonthCategories = useMemo<ExpenseCategoryPoint[]>(() => {
    const totalsByCategory = new Map<string, { total: number; count: number }>()
    activeExpenses.forEach((expense) => {
      if (!expense.date.startsWith(comparisonMonth)) return
      const current = totalsByCategory.get(expense.category) ?? { total: 0, count: 0 }
      totalsByCategory.set(expense.category, { total: current.total + expense.amount, count: current.count + 1 })
    })

    return Array.from(totalsByCategory, ([name, values]) => ({ name, ...values }))
      .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name))
  }, [activeExpenses, comparisonMonth])
  const previousMonthTotal = useMemo(() => activeExpenses.filter((expense) => expense.date.startsWith(previousMonth)).reduce((sum, expense) => sum + expense.amount, 0), [activeExpenses, previousMonth])
  const monthChangePercent = previousMonthTotal === 0 ? (selectedMonthTotal === 0 ? 0 : 100) : ((selectedMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
  const selectedMonthLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric' }).format(new Date(`${comparisonMonth}-01T00:00:00`))
  const previousMonthLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric' }).format(previousMonthDate)
  const monthlyTrend = useMemo<ExpenseTrendPoint[]>(() => {
    const totalsByMonth = new Map<string, number>()
    activeExpenses.forEach((expense) => {
      const month = expense.date.slice(0, 7)
      totalsByMonth.set(month, (totalsByMonth.get(month) ?? 0) + expense.amount)
    })

    const [year = new Date().getFullYear(), month = new Date().getMonth() + 1] = comparisonMonth.split('-').map(Number)
    const earliestMonth = Array.from(totalsByMonth.keys())
      .filter((key) => /^\d{4}-\d{2}$/.test(key) && key <= comparisonMonth)
      .sort()[0]
    const fixedMonthCount = trendRange === '3m' ? 3 : trendRange === '6m' ? 6 : 12
    const monthCount = trendRange === 'all' && earliestMonth
      ? Math.max(1, (year - Number(earliestMonth.slice(0, 4))) * 12 + month - Number(earliestMonth.slice(5, 7)) + 1)
      : trendRange === 'all' ? 1 : fixedMonthCount

    return Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(year, month - 1 - (monthCount - 1 - index), 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return {
        key,
        monthLabel: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date),
        yearLabel: String(date.getFullYear()),
        fullLabel: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(date),
        total: totalsByMonth.get(key) ?? 0,
        isSelected: key === comparisonMonth,
      }
    })
  }, [activeExpenses, comparisonMonth, trendRange])
  const activeFilterCount = Number(dateFilterMode !== 'all') + Number(categoryFilter !== 'All')

  function getOptions(kind: ExpenseOptionKind) {
    return kind === 'categories' ? categoryOptions : paymentMethodOptions
  }

  function updateOptions(kind: ExpenseOptionKind, update: (current: ExpenseOption[]) => ExpenseOption[]) {
    if (kind === 'categories') setCategoryOptions(update)
    else setPaymentMethodOptions(update)
  }

  function addOption(kind: ExpenseOptionKind, value: string) {
    const name = value.trim()
    const options = getOptions(kind)
    if (!name || options.some((option) => option.name.toLowerCase() === name.toLowerCase())) return false
    updateOptions(kind, (current) => [...current, { id: `${kind}-${Date.now()}`, name, isActive: true }])
    return true
  }

  function renameOption(kind: ExpenseOptionKind, id: string, value: string) {
    const name = value.trim()
    const options = getOptions(kind)
    const option = options.find((item) => item.id === id)
    if (!option || !name || options.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) return false
    const previousName = option.name
    updateOptions(kind, (current) => current.map((item) => item.id === id ? { ...item, name } : item))
    setExpenses((current) => current.map((expense) => kind === 'categories' && expense.category === previousName
      ? { ...expense, category: name }
      : kind === 'paymentMethods' && expense.paymentMethod === previousName ? { ...expense, paymentMethod: name } : expense))
    setDraft((current) => kind === 'categories' && current.category === previousName
      ? { ...current, category: name }
      : kind === 'paymentMethods' && current.paymentMethod === previousName ? { ...current, paymentMethod: name } : current)
    if (kind === 'categories' && categoryFilter === previousName) setCategoryFilter(name)
    return true
  }

  function moveOption(kind: ExpenseOptionKind, id: string, direction: -1 | 1) {
    updateOptions(kind, (current) => {
      const index = current.findIndex((option) => option.id === id)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= current.length) return current
      const next = [...current]
      const source = next[index]
      const target = next[destination]
      if (!source || !target) return current
      next[index] = target
      next[destination] = source
      return next
    })
  }

  function toggleOption(kind: ExpenseOptionKind, id: string) {
    const options = getOptions(kind)
    const option = options.find((item) => item.id === id)
    if (!option || (option.isActive && options.filter((item) => item.isActive).length === 1)) return
    const replacement = options.find((item) => item.id !== id && item.isActive)?.name ?? option.name
    updateOptions(kind, (current) => current.map((item) => item.id === id ? { ...item, isActive: !item.isActive } : item))
    if (option.isActive) setDraft((current) => kind === 'categories' && current.category === option.name
      ? { ...current, category: replacement }
      : kind === 'paymentMethods' && current.paymentMethod === option.name ? { ...current, paymentMethod: replacement } : current)
  }

  function deleteOption(kind: ExpenseOptionKind, id: string) {
    const options = getOptions(kind)
    const option = options.find((item) => item.id === id)
    if (!option || options.length === 1 || (option.isActive && options.filter((item) => item.isActive).length === 1) || expenses.some((expense) => kind === 'categories' ? expense.category === option.name : expense.paymentMethod === option.name)) return
    const remaining = options.filter((item) => item.id !== id)
    const replacement = remaining.find((item) => item.isActive)?.name ?? remaining[0]?.name ?? option.name
    updateOptions(kind, () => remaining)
    setDraft((current) => kind === 'categories' && current.category === option.name
      ? { ...current, category: replacement }
      : kind === 'paymentMethods' && current.paymentMethod === option.name ? { ...current, paymentMethod: replacement } : current)
    if (kind === 'categories' && categoryFilter === option.name) setCategoryFilter('All')
  }

  function openSettings(tab: ExpenseOptionKind) {
    setSettingsTab(tab)
    setIsSettingsOpen(false)
    navigateToBusinessSettings(tab === 'categories' ? 'expense-categories' : 'payment-methods')
  }

  function openExpenseDialog() {
    setEditingExpenseId(null)
    setDraft({ ...emptyDraft, date: new Date().toISOString().slice(0, 10), category: categories[0] ?? emptyDraft.category, paymentMethod: paymentMethods[0] ?? emptyDraft.paymentMethod, purchaser: currentUsername })
    setIsAddingExpense(true)
  }

  function openEditExpense(expense: Expense) {
    setSelectedExpenseId(null)
    setEditingExpenseId(expense.id)
    setDraft({
      date: expense.date,
      payee: expense.payee,
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      purchaser: expense.purchaser,
      status: expense.status,
      invoiceLink: expense.invoiceLink,
      notes: expense.notes,
      quotationId: expense.quotationId,
      quotationNumber: expense.quotationNumber,
      projectName: expense.projectName,
    })
    setIsAddingExpense(true)
  }

  function closeExpenseDialog() {
    setIsAddingExpense(false)
    setEditingExpenseId(null)
  }

  function clearFilters() {
    setSearchQuery('')
    setDateFilterMode('all')
    setSelectedMonth(currentMonth)
    setFromDate('')
    setToDate('')
    setCategoryFilter('All')
  }

  function updateExpenseStatus(id: number, status: ExpenseStatus) {
    const expense = expenses.find((item) => item.id === id)
    if (status === 'Cancelled' && expense?.status !== 'Cancelled') {
      setPendingVoidExpenseId(id)
      return
    }
    setExpenses((current) => current.map((expense) => expense.id === id ? { ...expense, status } : expense))
    setToast('Expense status updated')
    if (expense) appendSystemLog({ recordId: String(id), module: 'Expenses', action: 'Status changed', entity: expense.payee, description: `Expense status changed from ${expense.status} to ${status}.`, actor: currentUsername, tone: status === 'Paid' ? 'success' : status === 'Overdue' ? 'warning' : 'info', amount: expense.amount, status })
  }

  function confirmVoidExpense(reason: string, archiveAfterVoiding: boolean) {
    const expense = expenses.find((entry) => entry.id === pendingVoidExpenseId)
    if (!expense) return
    setExpenses((current) => current.map((entry) => entry.id === expense.id ? (archiveAfterVoiding ? withArchived(withVoided({ ...entry, status: 'Cancelled' as const }, currentUsername, reason), currentUsername) : withVoided({ ...entry, status: 'Cancelled' as const }, currentUsername, reason)) : entry))
    notifyLifecycleChanged()
    appendSystemLog({ recordId: String(expense.id), module: 'Expenses', action: 'Voided', entity: expense.payee, description: `Expense voided: ${reason}${archiveAfterVoiding ? ' It was archived after voiding.' : ''}`, actor: currentUsername, tone: 'danger', amount: expense.amount, status: 'Cancelled' })
    setPendingVoidExpenseId(null)
    setToast(archiveAfterVoiding ? 'Expense voided and archived' : 'Expense voided')
  }

  function archiveExpense(id: number) {
    const expense = expenses.find((entry) => entry.id === id)
    if (!expense) return
    setExpenses((current) => current.map((entry) => entry.id === id ? withArchived(entry, currentUsername) : entry))
    notifyLifecycleChanged()
    appendSystemLog({ recordId: String(expense.id), module: 'Expenses', action: 'Archived', entity: expense.payee, description: 'Expense was archived with project and purchase-order links retained.', actor: currentUsername, tone: 'info', amount: expense.amount, status: expense.status })
    closeExpenseDialog()
    setSelectedExpenseId(null)
    setToast('Expense archived')
  }

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(draft.amount)
    if (!draft.date || !draft.payee.trim() || !draft.description.trim() || !draft.purchaser.trim() || !Number.isFinite(amount) || amount <= 0) return
    const wasEditing = editingExpenseId !== null
    const linkedQuotation = approvedQuotations.find((quotation) => quotation.id === draft.quotationId)

    const values = {
      date: draft.date,
      payee: draft.payee.trim(),
      category: draft.category,
      description: draft.description.trim(),
      amount,
      paymentMethod: draft.paymentMethod,
      purchaser: draft.purchaser.trim(),
      status: draft.status,
      invoiceLink: draft.invoiceLink.trim(),
      notes: draft.notes.trim(),
      quotationId: linkedQuotation?.id ?? '',
      quotationNumber: linkedQuotation?.quotationNumber ?? '',
      projectName: linkedQuotation ? (linkedQuotation.subject || linkedQuotation.clientName) : '',
    }
    const expenseId = editingExpenseId ?? Date.now()
    setExpenses((current) => editingExpenseId === null
      ? [{ id: expenseId, ...values }, ...current]
      : current.map((expense) => expense.id === editingExpenseId ? { id: expense.id, ...values } : expense))
    closeExpenseDialog()
    setToast(wasEditing ? 'Expense updated successfully' : 'Expense added successfully')
    appendSystemLog({ recordId: String(expenseId), module: 'Expenses', action: wasEditing ? 'Updated' : 'Created', entity: values.payee, description: wasEditing ? `Expense record updated: ${values.description}.` : values.description, actor: currentUsername, tone: values.status === 'Overdue' ? 'warning' : 'success', amount: values.amount, status: values.status })
  }

  const summaryCards = [
    { label: `${selectedMonthLabel} total`, value: formatPeso(selectedMonthTotal), detail: 'Selected month', accent: 'bg-brand-orange', valueClass: 'text-brand-blue', trend: null, insight: 'categories' as const },
    { label: 'Project costs', value: formatPeso(selectedMonthProjectTotal), detail: selectedMonthLabel, accent: 'bg-violet-500', valueClass: 'text-violet-700', trend: null, insight: null },
    { label: 'Operating expenses', value: formatPeso(selectedMonthOperatingTotal), detail: 'General operations', accent: 'bg-orange-500', valueClass: 'text-orange-700', trend: null, insight: null },
    {
      label: 'Month change',
      value: `${monthChangePercent > 0 ? '+' : ''}${monthChangePercent.toFixed(1)}%`,
      detail: `vs ${previousMonthLabel}`,
      accent: monthChangePercent > 0 ? 'bg-emerald-500' : monthChangePercent < 0 ? 'bg-red-500' : 'bg-slate-400',
      valueClass: monthChangePercent > 0 ? 'text-emerald-700' : monthChangePercent < 0 ? 'text-red-600' : 'text-slate-500',
      trend: monthChangePercent > 0 ? 'up' : monthChangePercent < 0 ? 'down' : 'flat',
      insight: 'trend' as const,
    },
  ]

  return (
    <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
      <SummarySurface>
        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Company spending</p></div>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Expenses</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Record expenses, attach invoices, and check spending by date.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 sm:gap-3 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const insight = card.insight
              const isOpen = openInsight === insight
              const actionLabel = insight === 'categories'
                ? isOpen ? 'Hide categories' : 'View categories'
                : isOpen ? 'Hide graph' : 'View graph'
              const content = (
                <>
                  <div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${card.accent}`} /><p className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{card.label}</p></div>
                  <div className="mt-2 flex items-center gap-2" title={card.value}>
                    {card.trend ? <span className={`grid size-6 shrink-0 place-items-center rounded-full ${card.trend === 'up' ? 'bg-emerald-100 text-emerald-700' : card.trend === 'down' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`} aria-hidden="true"><svg className={`size-3.5 ${card.trend === 'down' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={card.trend === 'flat' ? 'M5 12h14' : 'M12 19V5M5 12l7-7 7 7'} /></svg></span> : null}
                    <p className={`truncate text-lg font-bold tracking-[-0.035em] ${card.valueClass}`}>{card.value}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium text-slate-400">{card.detail}</p>
                    {insight ? <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.06em] text-brand-blue">{actionLabel}<svg className={`size-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span> : null}
                  </div>
                </>
              )

              if (!insight) return <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-4 py-3.5 shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] ring-1 ring-inset ring-white/70 sm:min-w-40 xl:min-w-44" key={card.label}>{content}</article>

              const controls = insight === 'categories' ? 'expense-category-breakdown' : 'expense-trend-chart'
              const ariaLabel = insight === 'categories'
                ? `${isOpen ? 'Hide' : 'Show'} category breakdown for ${selectedMonthLabel} expenses totaling ${card.value}.`
                : `${isOpen ? 'Hide' : 'Show'} expense trend graph. Current change is ${card.value} versus ${previousMonthLabel}.`

              return (
                <button className={`min-w-0 rounded-2xl border px-4 py-3.5 text-left shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] ring-1 ring-inset ring-white/70 transition-all hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-white hover:shadow-[0_12px_28px_-20px_rgba(0,20,76,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue sm:min-w-40 xl:min-w-44 ${isOpen ? 'border-brand-blue/20 bg-brand-blue/[0.035] ring-2 ring-brand-blue/[0.06]' : 'border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))]'}`} type="button" key={card.label} onClick={() => setOpenInsight((current) => current === insight ? null : insight)} aria-expanded={isOpen} aria-controls={controls} aria-label={ariaLabel}>
                  {content}
                </button>
              )
            })}
          </div>
        </div>

        {openInsight === 'categories' ? <ExpenseCategoryBreakdown categories={selectedMonthCategories} selectedMonthLabel={selectedMonthLabel} selectedMonthTotal={selectedMonthTotal} onClose={() => setOpenInsight(null)} /> : null}
        {openInsight === 'trend' ? <ExpenseTrendChart points={monthlyTrend} range={trendRange} selectedMonthLabel={selectedMonthLabel} previousMonthLabel={previousMonthLabel} selectedMonthTotal={selectedMonthTotal} previousMonthTotal={previousMonthTotal} onRangeChange={setTrendRange} onClose={() => setOpenInsight(null)} /> : null}
      </SummarySurface>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-blue/40 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.05]" type="search" placeholder="Search payee, description, purchaser..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search expenses" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AnimatedDropdown className="min-w-36" size="filter" fullWidth={false} value={categoryFilter} options={[{ value: 'All' }, ...categoryFilterOptions.map((value) => ({ value }))]} onChange={setCategoryFilter} ariaLabel="Filter by category" />
              {activeFilterCount ? <button className="h-10 rounded-xl px-3 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-brand-orange" type="button" onClick={clearFilters}>Clear filters</button> : null}
              <button className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-brand-blue" type="button" onClick={() => openSettings('categories')} aria-label="Open expense settings" title="Expense settings"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg></button>
              <button className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition-all hover:-translate-y-0.5 sm:flex-none" type="button" onClick={openExpenseDialog}><svg className="size-4 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add expense</button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="relative grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Filter expenses by date">
                <span className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(33.333333%_-_0.166667rem)] rounded-lg bg-brand-blue shadow-[0_5px_14px_-6px_rgba(0,20,76,0.7)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${dateFilterMode === 'month' ? 'translate-x-full' : dateFilterMode === 'range' ? 'translate-x-[200%]' : 'translate-x-0'}`} aria-hidden="true" />
                {([['all', 'All dates'], ['month', 'Month & year'], ['range', 'Date range']] as const).map(([mode, label]) => <button className={`relative z-10 whitespace-nowrap rounded-lg px-2.5 py-2 text-[10px] font-bold transition-colors duration-300 sm:px-3.5 sm:text-xs ${dateFilterMode === mode ? 'text-white' : 'text-slate-500 hover:text-brand-blue'}`} type="button" key={mode} onClick={() => setDateFilterMode(mode)} aria-pressed={dateFilterMode === mode}>{label}</button>)}
              </div>

              {dateFilterMode === 'month' ? (
                <div className="min-w-52 animate-[view-swap_300ms_cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity]"><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="expense-month">Select month and year</label><AnimatedDatePicker id="expense-month" mode="month" size="filter" value={selectedMonth} onChange={setSelectedMonth} ariaLabel="Select expense month and year" /></div>
              ) : null}
              {dateFilterMode === 'range' ? (
                <div className="grid flex-1 gap-3 animate-[view-swap_300ms_cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity] sm:grid-cols-2 lg:max-w-xl">
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="expense-from">From</label><AnimatedDatePicker id="expense-from" size="filter" value={fromDate} onChange={setFromDate} ariaLabel="Expense date range from" max={toDate || undefined} /></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="expense-to">To</label><AnimatedDatePicker id="expense-to" size="filter" value={toDate} onChange={setToDate} ariaLabel="Expense date range to" min={fromDate || undefined} /></div>
                </div>
              ) : null}
              <p className="ml-auto text-[11px] font-semibold text-slate-400">Showing <span className="text-brand-blue">{visibleExpenses.length}</span> of {expenses.length} entries</p>
            </div>
          </div>
        </div>

        <TableControls tableId="expenses-table" storageKey="expenses.table" columns={[{ index: 1, label: 'Date' }, { index: 2, label: 'Payee', required: true }, { index: 3, label: 'Category' }, { index: 4, label: 'Description' }, { index: 5, label: 'Amount' }, { index: 6, label: 'Payment method' }, { index: 7, label: 'Purchaser' }, { index: 8, label: 'Status' }, { index: 9, label: 'Invoice' }, { index: 10, label: 'Notes' }]} sortKey={expenseTable.sortKey} sortOptions={expenseSortOptions} onSortChange={expenseTable.setSortKey} page={expenseTable.page} pageCount={expenseTable.pageCount} pageSize={expenseTable.pageSize} onPageChange={expenseTable.setPage} onPageSizeChange={expenseTable.setPageSize} total={expenseTable.total} />

        <div className="overflow-hidden">
          <table className="w-full table-fixed border-collapse text-left [&_td]:px-2.5 [&_th]:px-2.5">
            <caption className="sr-only">Expense records</caption>
            <colgroup><col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[16%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[7%]" /><col className="w-[8%]" /></colgroup>
            <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[9px] font-bold uppercase leading-4 tracking-[0.05em] text-slate-500 sm:text-[10px]"><th className="px-3 py-3.5">Date</th><th className="px-2.5 py-3.5">Payee</th><th className="px-2.5 py-3.5">Category</th><th className="px-2.5 py-3.5">Brief description</th><th className="px-2.5 py-3.5 text-right">Amount (PHP)</th><th className="px-2.5 py-3.5">Payment method</th><th className="px-2.5 py-3.5">Purchaser</th><th className="px-2.5 py-3.5">Status</th><th className="px-2.5 py-3.5">Invoice</th><th className="px-2.5 py-3.5">Notes / remarks</th></tr></thead>
            <tbody>
              {visibleExpenses.map((expense) => {
                const invoiceUrl = getInvoiceUrl(expense.invoiceLink)
                return (
                  <tr className="border-b border-slate-100 transition-colors hover:bg-[#fbfcfe]" key={expense.id}>
                    <td className="border-l-4 border-l-brand-orange px-5 py-4 text-xs font-semibold text-slate-600">{formatDate(expense.date)}</td>
                    <td className="px-4 py-4"><button className="group/payee flex max-w-full items-center gap-1.5 text-left" type="button" onClick={() => setSelectedExpenseId(expense.id)} title={`View ${expense.payee} expense`}><span className="truncate text-sm font-bold text-brand-blue transition group-hover/payee:text-brand-orange">{expense.payee}</span><svg className="size-3 shrink-0 text-slate-300 opacity-0 transition group-hover/payee:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button></td>
                    <td className="px-4 py-4"><span className="inline-flex max-w-full truncate rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-700" title={expense.category}>{expense.category}</span></td>
                    <td className="px-4 py-4"><span className="block truncate text-xs font-medium text-slate-600" title={expense.description}>{expense.description}</span>{expense.quotationNumber ? <><span className="mt-1.5 inline-flex rounded-md bg-violet-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-700">Project cost</span><span className="mt-1 block truncate text-[9px] font-bold text-violet-600" title={`${expense.quotationNumber} · ${expense.projectName}`}>{expense.quotationNumber} · {expense.projectName}</span></> : <><span className="mt-1.5 inline-flex rounded-md bg-orange-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-orange-700">Operating expense</span><span className="mt-1 block truncate text-[9px] text-slate-400">General operations</span></>}</td>
                    <td className="px-4 py-4 text-right text-sm font-extrabold tabular-nums text-brand-blue">{formatPeso(expense.amount)}</td>
                    <td className="px-4 py-4"><span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">{expense.paymentMethod}</span></td>
                    <td className="px-4 py-4"><span className="block truncate text-xs font-semibold text-slate-700" title={expense.purchaser}>{expense.purchaser}</span></td>
                    <td className="px-4 py-4"><AnimatedDropdown size="compact" value={expense.status} options={expenseStatusOptions} onChange={(status) => updateExpenseStatus(expense.id, status)} ariaLabel={`Status for expense paid to ${expense.payee}`} /></td>

                    <td className="px-4 py-4">{invoiceUrl ? <a className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-brand-blue transition hover:bg-blue-50 hover:text-brand-orange" href={invoiceUrl} target="_blank" rel="noreferrer"><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>Open</a> : <span className="text-xs text-slate-300">—</span>}</td>
                    <td className="px-4 py-4"><span className="block truncate text-xs text-slate-500" title={expense.notes}>{expense.notes || '—'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!visibleExpenses.length ? (
          <div className="grid min-h-72 place-items-center border-t border-slate-100 p-8 text-center">
            <div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span><h3 className="mt-4 text-sm font-bold text-brand-blue">{expenses.length ? 'No matching expenses' : 'No expenses recorded'}</h3><p className="mt-1 text-xs text-slate-400">{expenses.length ? 'Adjust the search or date filters to see more entries.' : 'Add your first expense to begin tracking company spending.'}</p>{expenses.length ? <button className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 transition hover:border-slate-300 hover:text-brand-blue" type="button" onClick={clearFilters}>Clear filters</button> : <button className="mt-4 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white" type="button" onClick={openExpenseDialog}>Add first expense</button>}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-slate-400">Non-cancelled total for the current view</p><p className="text-lg font-extrabold tracking-[-0.025em] text-brand-blue">{formatPeso(visibleTotal)}</p></div>
        )}
      </section>

      {selectedExpense ? <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title"><button className="fixed inset-0" type="button" onClick={() => setSelectedExpenseId(null)} aria-label="Close expense details" /><div className="relative mx-auto my-6 w-full max-w-4xl space-y-4"><div className="flex justify-end"><button className="grid size-9 place-items-center rounded-xl bg-white text-slate-400 shadow-sm hover:text-brand-blue" type="button" onClick={() => setSelectedExpenseId(null)} aria-label="Close expense details"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div><WorkflowHeader eyebrow="Expense" recordNumber={`EXP-${selectedExpense.id}`} partyName={selectedExpense.payee} amount={formatPeso(selectedExpense.amount)} createdLabel={`Recorded ${formatDate(selectedExpense.date)}`} status={selectedExpense.status} steps={["Recorded", "Verifying", "To Pay", "Paid"]} currentStep={selectedExpense.status === 'Verifying' ? 1 : selectedExpense.status === 'To pay' || selectedExpense.status === 'Overdue' ? 2 : selectedExpense.status === 'Paid' ? 3 : 0} module="Expenses" recordId={String(selectedExpense.id)} primaryAction={selectedExpense.status === 'Verifying' ? { label: 'Mark To Pay', onClick: () => updateExpenseStatus(selectedExpense.id, 'To pay') } : selectedExpense.status === 'To pay' || selectedExpense.status === 'Overdue' ? { label: 'Mark Paid', onClick: () => updateExpenseStatus(selectedExpense.id, 'Paid') } : undefined} secondaryActions={selectedExpense.status === 'To pay' ? [{ label: 'Mark Overdue', tone: 'danger', onClick: () => updateExpenseStatus(selectedExpense.id, 'Overdue') }] : []} menuActions={[{ label: 'Edit', onClick: () => openEditExpense(selectedExpense), disabled: selectedExpense.status === 'Cancelled' }, ...(getInvoiceUrl(selectedExpense.invoiceLink) ? [{ label: 'Open invoice', onClick: () => window.open(getInvoiceUrl(selectedExpense.invoiceLink), '_blank', 'noopener,noreferrer') }] : []), { label: 'Archive', onClick: () => archiveExpense(selectedExpense.id) }, ...(selectedExpense.status !== 'Cancelled' ? [{ label: 'Void', tone: 'danger' as const, onClick: () => setPendingVoidExpenseId(selectedExpense.id) }] : [])]}><p className="text-sm leading-6 text-slate-500">{selectedExpense.description}</p></WorkflowHeader><section className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Category</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedExpense.category}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Payment method</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedExpense.paymentMethod}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Allocation</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedExpense.quotationNumber ? `${selectedExpense.quotationNumber} · ${selectedExpense.projectName}` : 'General operations'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Purchased by</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedExpense.purchaser}</p></div>{selectedExpense.notes ? <div className="rounded-xl bg-blue-50/55 p-4 sm:col-span-2"><p className="text-[9px] font-bold uppercase tracking-wider text-brand-blue">Notes</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{selectedExpense.notes}</p></div> : null}</section></div></div> : null}

      {isAddingExpense ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
          <button className="absolute inset-0" type="button" onClick={closeExpenseDialog} aria-label="Close expense form" />
          <form className="relative my-6 w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.28)]" onSubmit={saveExpense}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">{isEditingExpense ? 'Update expense' : 'New expense'}</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="expense-form-title">{isEditingExpense ? 'Edit expense' : 'Add an expense'}</h2><p className="mt-1 text-sm text-slate-500">{isEditingExpense ? 'Check and update the expense details below.' : 'Enter the expense details and attach the invoice if available.'}</p></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={closeExpenseDialog} aria-label="Close dialog"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>

            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-date">Date</label><AnimatedDatePicker id="new-expense-date" value={draft.date} onChange={(date) => setDraft((current) => ({ ...current, date }))} ariaLabel="Expense date" required /></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-payee">Payee</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-payee" value={draft.payee} onChange={(event) => setDraft((current) => ({ ...current, payee: event.target.value }))} placeholder="Supplier or recipient" autoFocus required /></div>
              <div><div className="mb-2 flex items-center justify-between gap-2"><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-category">Category</label><button className="text-[10px] font-bold text-brand-blue transition hover:text-brand-orange" type="button" onClick={() => openSettings('categories')}>Manage</button></div><AnimatedDropdown id="new-expense-category" value={draft.category ?? ''} options={draftCategories.filter((value): value is string => Boolean(value)).map((value) => ({ value }))} onChange={(category) => setDraft((current) => ({ ...current, category }))} ariaLabel="Expense category" /></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-amount">Amount (PHP)</label><div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span><input className="h-11 w-full rounded-xl border border-slate-200 pl-8 pr-3.5 text-sm font-semibold text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-amount" type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" required /></div></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Expense allocation</label><AnimatedDropdown value={draft.quotationId} options={projectOptions} onChange={(quotationId) => { const quotation = approvedQuotations.find((item) => item.id === quotationId); setDraft((current) => ({ ...current, quotationId, quotationNumber: quotation?.quotationNumber ?? '', projectName: quotation ? (quotation.subject || quotation.clientName) : '' })) }} ariaLabel="Expense allocation" /><p className="mt-1.5 text-[10px] text-slate-400">Project costs reduce that project’s profit. General operations still reduce company net profit.</p></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-description">Brief description</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What was purchased or paid for?" required /></div>
              <div><div className="mb-2 flex items-center justify-between gap-2"><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-method">Payment method</label><button className="text-[10px] font-bold text-brand-blue transition hover:text-brand-orange" type="button" onClick={() => openSettings('paymentMethods')}>Manage</button></div><AnimatedDropdown id="new-expense-method" value={draft.paymentMethod ?? ''} options={draftPaymentMethods.filter((value): value is string => Boolean(value)).map((value) => ({ value }))} onChange={(paymentMethod) => setDraft((current) => ({ ...current, paymentMethod }))} ariaLabel="Payment method" /></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-purchaser">Purchaser</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-purchaser" value={draft.purchaser} onChange={(event) => setDraft((current) => ({ ...current, purchaser: event.target.value }))} placeholder="Person who made the purchase" required /></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-status">Status</label><AnimatedDropdown id="new-expense-status" value={draft.status} options={expenseStatusOptions.filter((option) => option.value !== 'Cancelled')} onChange={(status) => setDraft((current) => ({ ...current, status }))} ariaLabel="Expense status" /></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-invoice">Invoice link <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-invoice" type="url" value={draft.invoiceLink} onChange={(event) => setDraft((current) => ({ ...current, invoiceLink: event.target.value }))} placeholder="https://drive.google.com/..." /></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-notes">Notes / remarks <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Add approval details, receipt references, or other context..." /></div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">{isEditingExpense && editingExpenseId !== null ? <button className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-500 hover:bg-slate-50" type="button" onClick={() => archiveExpense(editingExpenseId)}>Archive</button> : <span />}<div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={closeExpenseDialog}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">{isEditingExpense ? 'Save changes' : 'Save expense'}</button></div></div>
          </form>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <ExpenseSettingsDialog
          tab={settingsTab}
          categoryOptions={categoryOptions}
          paymentMethodOptions={paymentMethodOptions}
          usedCategories={usedCategories}
          usedPaymentMethods={usedPaymentMethods}
          onTabChange={setSettingsTab}
          onAdd={addOption}
          onRename={renameOption}
          onMove={moveOption}
          onToggle={toggleOption}
          onDelete={deleteOption}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : null}
      {pendingVoidExpenseId !== null ? <VoidRecordDialog recordLabel="expense" onClose={() => setPendingVoidExpenseId(null)} onConfirm={confirmVoidExpense} /> : null}
      <SuccessToast message={toast} />
    </div>
  )
}
