import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ExpenseSettingsDialog, type ExpenseOption, type ExpenseOptionKind } from './ExpenseSettingsDialog'

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
}

type ExpensesPageProps = {
  currentUsername: string
}

const storageKey = 'adiel.expenses'
const categoryStorageKey = 'adiel.expense-categories'
const paymentMethodStorageKey = 'adiel.expense-payment-methods'
const defaultCategoryNames = ['Materials', 'Transportation', 'Office supplies', 'Utilities', 'Meals', 'Equipment', 'Professional fees', 'Other']
const defaultPaymentMethodNames = ['Cash', 'GCash', 'Bank transfer', 'Credit card', 'Cheque', 'Other']
const expenseStatuses: ExpenseStatus[] = ['Paid', 'Verifying', 'To pay', 'Overdue', 'Cancelled']
const currentMonth = new Date().toISOString().slice(0, 7)

function createDefaultOptions(prefix: string, names: string[]): ExpenseOption[] {
  return names.map((name, index) => ({ id: `${prefix}-${index + 1}`, name, isActive: true }))
}

const defaultCategoryOptions = createDefaultOptions('category', defaultCategoryNames)
const defaultPaymentMethodOptions = createDefaultOptions('payment', defaultPaymentMethodNames)
const emptyDraft = {
  date: new Date().toISOString().slice(0, 10),
  payee: '',
  category: defaultCategoryNames[0],
  description: '',
  amount: '',
  paymentMethod: defaultPaymentMethodNames[0],
  purchaser: '',
  status: 'To pay' as ExpenseStatus,
  invoiceLink: '',
  notes: '',
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
    }))
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
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function ExpensesPage({ currentUsername }: ExpensesPageProps) {
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses)
  const [categoryOptions, setCategoryOptions] = useState<ExpenseOption[]>(() => loadOptions(categoryStorageKey, defaultCategoryOptions))
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<ExpenseOption[]>(() => loadOptions(paymentMethodStorageKey, defaultPaymentMethodOptions))
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [isAddingExpense, setIsAddingExpense] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<ExpenseOptionKind>('categories')
  const categories = categoryOptions.filter((option) => option.isActive).map((option) => option.name)
  const paymentMethods = paymentMethodOptions.filter((option) => option.isActive).map((option) => option.name)
  const [draft, setDraft] = useState(() => ({ ...emptyDraft, category: categories[0], paymentMethod: paymentMethods[0], purchaser: currentUsername }))
  const isEditingExpense = editingExpenseId !== null
  const draftCategories = categories.includes(draft.category) ? categories : [draft.category, ...categories]
  const draftPaymentMethods = paymentMethods.includes(draft.paymentMethod) ? paymentMethods : [draft.paymentMethod, ...paymentMethods]

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(expenses))
    } catch {
      // Expense tracking remains usable when browser storage is unavailable.
    }
  }, [expenses])

  useEffect(() => {
    try {
      window.localStorage.setItem(categoryStorageKey, JSON.stringify(categoryOptions))
      window.localStorage.setItem(paymentMethodStorageKey, JSON.stringify(paymentMethodOptions))
    } catch {
      // Custom options remain usable for the current session.
    }
  }, [categoryOptions, paymentMethodOptions])

  const categoryFilterOptions = useMemo(() => Array.from(new Set([...categoryOptions.map((option) => option.name), ...expenses.map((expense) => expense.category)])), [categoryOptions, expenses])
  const usedCategories = useMemo(() => new Set(expenses.map((expense) => expense.category)), [expenses])
  const usedPaymentMethods = useMemo(() => new Set(expenses.map((expense) => expense.paymentMethod)), [expenses])

  const visibleExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return expenses
      .filter((expense) => {
        const matchesSearch = !query || [expense.payee, expense.category, expense.description, expense.paymentMethod, expense.purchaser, expense.status, expense.notes]
          .some((value) => value.toLowerCase().includes(query))
        const matchesCategory = categoryFilter === 'All' || expense.category === categoryFilter
        const matchesDate = dateFilterMode === 'all'
          || (dateFilterMode === 'month' && expense.date.startsWith(selectedMonth))
          || (dateFilterMode === 'range' && (!fromDate || expense.date >= fromDate) && (!toDate || expense.date <= toDate))
        return matchesSearch && matchesCategory && matchesDate
      })
      .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id)
  }, [categoryFilter, dateFilterMode, expenses, fromDate, searchQuery, selectedMonth, toDate])

  const visibleTotal = useMemo(() => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0), [visibleExpenses])
  const comparisonMonth = /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : currentMonth
  const [comparisonYear, comparisonMonthNumber] = comparisonMonth.split('-').map(Number)
  const previousMonthDate = new Date(comparisonYear, comparisonMonthNumber - 2, 1)
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`
  const selectedMonthTotal = useMemo(() => expenses.filter((expense) => expense.date.startsWith(comparisonMonth)).reduce((sum, expense) => sum + expense.amount, 0), [comparisonMonth, expenses])
  const previousMonthTotal = useMemo(() => expenses.filter((expense) => expense.date.startsWith(previousMonth)).reduce((sum, expense) => sum + expense.amount, 0), [expenses, previousMonth])
  const monthChangePercent = previousMonthTotal === 0 ? (selectedMonthTotal === 0 ? 0 : 100) : ((selectedMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
  const selectedMonthLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric' }).format(new Date(`${comparisonMonth}-01T00:00:00`))
  const previousMonthLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric' }).format(previousMonthDate)
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
      ;[next[index], next[destination]] = [next[destination], next[index]]
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
    const replacement = remaining.find((item) => item.isActive)?.name ?? remaining[0].name
    updateOptions(kind, () => remaining)
    setDraft((current) => kind === 'categories' && current.category === option.name
      ? { ...current, category: replacement }
      : kind === 'paymentMethods' && current.paymentMethod === option.name ? { ...current, paymentMethod: replacement } : current)
    if (kind === 'categories' && categoryFilter === option.name) setCategoryFilter('All')
  }

  function openSettings(tab: ExpenseOptionKind) {
    setSettingsTab(tab)
    setIsSettingsOpen(true)
  }

  function openExpenseDialog() {
    setEditingExpenseId(null)
    setDraft({ ...emptyDraft, date: new Date().toISOString().slice(0, 10), category: categories[0], paymentMethod: paymentMethods[0], purchaser: currentUsername })
    setIsAddingExpense(true)
  }

  function openEditExpense(expense: Expense) {
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
    setExpenses((current) => current.map((expense) => expense.id === id ? { ...expense, status } : expense))
  }

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(draft.amount)
    if (!draft.date || !draft.payee.trim() || !draft.description.trim() || !draft.purchaser.trim() || !Number.isFinite(amount) || amount <= 0) return

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
    }
    setExpenses((current) => editingExpenseId === null
      ? [{ id: Date.now(), ...values }, ...current]
      : current.map((expense) => expense.id === editingExpenseId ? { id: expense.id, ...values } : expense))
    closeExpenseDialog()
  }

  const summaryCards = [
    { label: `${selectedMonthLabel} total`, value: formatPeso(selectedMonthTotal), detail: 'Selected month', accent: 'bg-brand-orange', valueClass: 'text-brand-blue', trend: null },
    { label: `${previousMonthLabel} total`, value: formatPeso(previousMonthTotal), detail: 'Previous month', accent: 'bg-sky-500', valueClass: 'text-brand-blue', trend: null },
    {
      label: 'Month change',
      value: `${monthChangePercent > 0 ? '+' : ''}${monthChangePercent.toFixed(1)}%`,
      detail: `vs ${previousMonthLabel}`,
      accent: monthChangePercent > 0 ? 'bg-emerald-500' : monthChangePercent < 0 ? 'bg-red-500' : 'bg-slate-400',
      valueClass: monthChangePercent > 0 ? 'text-emerald-700' : monthChangePercent < 0 ? 'text-red-600' : 'text-slate-500',
      trend: monthChangePercent > 0 ? 'up' : monthChangePercent < 0 ? 'down' : 'flat',
    },
  ]

  return (
    <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
      <section className="grid gap-5 rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_45px_-28px_rgba(0,20,76,0.3)] sm:p-6 xl:grid-cols-[1fr_auto] xl:items-center">
        <div>
          <div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Financial operations</p></div>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Expense tracker</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Record purchases, organize supporting documents, and review spending by period.</p>
        </div>

        <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-3 sm:gap-3">
          {summaryCards.map((card) => (
            <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3.5 sm:min-w-40 xl:min-w-44" key={card.label}>
              <div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${card.accent}`} /><p className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{card.label}</p></div>
              <div className="mt-2 flex items-center gap-2" title={card.value}>
                {card.trend ? <span className={`grid size-6 shrink-0 place-items-center rounded-full ${card.trend === 'up' ? 'bg-emerald-100 text-emerald-700' : card.trend === 'down' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`} aria-hidden="true"><svg className={`size-3.5 ${card.trend === 'down' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={card.trend === 'flat' ? 'M5 12h14' : 'M12 19V5M5 12l7-7 7 7'} /></svg></span> : null}
                <p className={`truncate text-lg font-bold tracking-[-0.035em] ${card.valueClass}`}>{card.value}</p>
              </div>
              <p className="mt-1 text-[10px] font-medium text-slate-400">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-blue/40 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.05]" type="search" placeholder="Search payee, description, purchaser..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search expenses" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-10 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none transition hover:border-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                <option>All</option>{categoryFilterOptions.map((category) => <option key={category}>{category}</option>)}
              </select>
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
                <div className="min-w-52 animate-[view-swap_300ms_cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity]"><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="expense-month">Select month and year</label><input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="expense-month" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></div>
              ) : null}
              {dateFilterMode === 'range' ? (
                <div className="grid flex-1 gap-3 animate-[view-swap_300ms_cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity] sm:grid-cols-2 lg:max-w-xl">
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="expense-from">From</label><input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="expense-from" type="date" max={toDate || undefined} value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="expense-to">To</label><input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="expense-to" type="date" min={fromDate || undefined} value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
                </div>
              ) : null}
              <p className="ml-auto text-[11px] font-semibold text-slate-400">Showing <span className="text-brand-blue">{visibleExpenses.length}</span> of {expenses.length} entries</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <table className="w-full table-fixed border-collapse text-left [&_td]:px-2.5 [&_th]:px-2.5">
            <caption className="sr-only">Expense records</caption>
            <colgroup><col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[16%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[7%]" /><col className="w-[8%]" /></colgroup>
            <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[9px] font-bold uppercase leading-4 tracking-[0.05em] text-slate-500 sm:text-[10px]"><th className="px-3 py-3.5">Date</th><th className="px-2.5 py-3.5">Payee</th><th className="px-2.5 py-3.5">Category</th><th className="px-2.5 py-3.5">Brief description</th><th className="px-2.5 py-3.5 text-right">Amount (PHP)</th><th className="px-2.5 py-3.5">Payment method</th><th className="px-2.5 py-3.5">Purchaser</th><th className="px-2.5 py-3.5">Status</th><th className="px-2.5 py-3.5">Invoice</th><th className="px-2.5 py-3.5">Notes / remarks</th></tr></thead>
            <tbody>
              {visibleExpenses.map((expense) => {
                const invoiceUrl = getInvoiceUrl(expense.invoiceLink)
                const statusStyle = expense.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : expense.status === 'Verifying' ? 'bg-amber-50 text-amber-700' : expense.status === 'To pay' ? 'bg-sky-50 text-sky-700' : expense.status === 'Overdue' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                return (
                  <tr className="border-b border-slate-100 transition-colors hover:bg-[#fbfcfe]" key={expense.id}>
                    <td className="border-l-4 border-l-brand-orange px-5 py-4 text-xs font-semibold text-slate-600">{formatDate(expense.date)}</td>
                    <td className="px-4 py-4"><button className="group/payee flex max-w-full items-center gap-1.5 text-left" type="button" onClick={() => openEditExpense(expense)} title={`Edit ${expense.payee} expense`}><span className="truncate text-sm font-bold text-brand-blue transition group-hover/payee:text-brand-orange">{expense.payee}</span><svg className="size-3 shrink-0 text-slate-300 opacity-0 transition group-hover/payee:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" /></svg></button></td>
                    <td className="px-4 py-4"><span className="inline-flex max-w-full truncate rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-700" title={expense.category}>{expense.category}</span></td>
                    <td className="px-4 py-4"><span className="block truncate text-xs font-medium text-slate-600" title={expense.description}>{expense.description}</span></td>
                    <td className="px-4 py-4 text-right text-sm font-extrabold tabular-nums text-brand-blue">{formatPeso(expense.amount)}</td>
                    <td className="px-4 py-4"><span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">{expense.paymentMethod}</span></td>
                    <td className="px-4 py-4"><span className="block truncate text-xs font-semibold text-slate-700" title={expense.purchaser}>{expense.purchaser}</span></td>
                    <td className="px-4 py-4"><div className={`relative rounded-lg ${statusStyle}`}><select className="h-9 w-full cursor-pointer appearance-none bg-transparent px-2.5 pr-6 text-[11px] font-bold uppercase tracking-wide outline-none" value={expense.status} onChange={(event) => updateExpenseStatus(expense.id, event.target.value as ExpenseStatus)} aria-label={`Status for expense paid to ${expense.payee}`}>{expenseStatuses.map((status) => <option key={status}>{status}</option>)}</select><svg className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></div></td>

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
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-slate-400">Total for the current view</p><p className="text-lg font-extrabold tracking-[-0.025em] text-brand-blue">{formatPeso(visibleTotal)}</p></div>
        )}
      </section>

      {isAddingExpense ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
          <button className="absolute inset-0" type="button" onClick={closeExpenseDialog} aria-label="Close expense form" />
          <form className="relative my-6 w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.28)]" onSubmit={saveExpense}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">{isEditingExpense ? 'Update expense record' : 'New expense record'}</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="expense-form-title">{isEditingExpense ? 'Edit expense' : 'Add an expense'}</h2><p className="mt-1 text-sm text-slate-500">{isEditingExpense ? 'Review and update the transaction details below.' : 'Record the transaction and attach its supporting invoice.'}</p></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={closeExpenseDialog} aria-label="Close dialog"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>

            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-date">Date</label><input className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-date" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} required /></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-payee">Payee</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-payee" value={draft.payee} onChange={(event) => setDraft((current) => ({ ...current, payee: event.target.value }))} placeholder="Supplier or recipient" autoFocus required /></div>
              <div><div className="mb-2 flex items-center justify-between gap-2"><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-category">Category</label><button className="text-[10px] font-bold text-brand-blue transition hover:text-brand-orange" type="button" onClick={() => openSettings('categories')}>Manage</button></div><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{draftCategories.map((category) => <option key={category}>{category}</option>)}</select></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-amount">Amount (PHP)</label><div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span><input className="h-11 w-full rounded-xl border border-slate-200 pl-8 pr-3.5 text-sm font-semibold text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-amount" type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" required /></div></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-description">Brief description</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What was purchased or paid for?" required /></div>
              <div><div className="mb-2 flex items-center justify-between gap-2"><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-method">Payment method</label><button className="text-[10px] font-bold text-brand-blue transition hover:text-brand-orange" type="button" onClick={() => openSettings('paymentMethods')}>Manage</button></div><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-method" value={draft.paymentMethod} onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value }))}>{draftPaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-purchaser">Purchaser</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-purchaser" value={draft.purchaser} onChange={(event) => setDraft((current) => ({ ...current, purchaser: event.target.value }))} placeholder="Person who made the purchase" required /></div>
              <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-status">Status</label><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ExpenseStatus }))}>{expenseStatuses.map((status) => <option key={status}>{status}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-invoice">Invoice link <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-invoice" type="url" value={draft.invoiceLink} onChange={(event) => setDraft((current) => ({ ...current, invoiceLink: event.target.value }))} placeholder="https://drive.google.com/..." /></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="new-expense-notes">Notes / remarks <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Add approval details, receipt references, or other context..." /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={closeExpenseDialog}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">{isEditingExpense ? 'Save changes' : 'Save expense'}</button></div>
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
    </div>
  )
}