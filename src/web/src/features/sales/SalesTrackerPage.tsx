import { useEffect, useMemo, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SummarySurface } from '../../components/ui/SummarySurface'
import type { StatementOfAccount, StatementStatus } from '../statement-of-account/statementOfAccountTypes'

type SalesQuotation = {
  id: string
  dateCreated: string
  quotationNumber: string
  clientId: string
  clientName: string
  contactPerson: string
  subject: string
  projectLocation: string
  leadTime: string
  subtotalAmount: number
  totalAmount: number
  estimatedCost: number
  estimatedProfit: number
  status: string
  items: Array<{ id: string; quantity: number; unitCost: number }>
}

type LinkedExpense = { id: number; quotationId: string; amount: number; status: string }

type SalesRow = {
  quotation: SalesQuotation
  statement?: StatementOfAccount
  billingStatus: 'Unbilled' | 'Draft SOA' | 'Billed'
  collectionStatus: 'Unbilled' | 'Awaiting issue' | 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue'
}

type PeriodMode = 'Day' | 'Week' | 'Month' | 'Year' | 'Custom'

const quotationStorageKey = 'adiel.quotations'
const statementStorageKey = 'adiel.statements-of-account'
const expenseStorageKey = 'adiel.expenses'
const billingOptions = ['All billing', 'Unbilled', 'Draft SOA', 'Billed'].map((value) => ({ value }))
const collectionOptions = ['All collections', 'Unbilled', 'Awaiting issue', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue'].map((value) => ({ value }))
const periodModes: PeriodMode[] = ['Day', 'Week', 'Month', 'Year', 'Custom']

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
}

function formatCompactPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatDate(value: string) {
  if (!value) return 'Not provided'
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

function periodRange(mode: PeriodMode, anchor: string) {
  const date = parseDate(anchor)
  let start = new Date(date)
  let end = new Date(date)
  if (mode === 'Week') {
    const daysFromMonday = (date.getDay() + 6) % 7
    start.setDate(date.getDate() - daysFromMonday)
    end = new Date(start)
    end.setDate(start.getDate() + 6)
  } else if (mode === 'Month') {
    start = new Date(date.getFullYear(), date.getMonth(), 1)
    end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  } else if (mode === 'Year') {
    start = new Date(date.getFullYear(), 0, 1)
    end = new Date(date.getFullYear(), 11, 31)
  }
  return { start: dateKey(start), end: dateKey(end) }
}

function periodLabel(mode: PeriodMode, anchor: string) {
  const date = parseDate(anchor)
  if (mode === 'Custom') return 'Custom date range'
  if (mode === 'Day') return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
  if (mode === 'Month') return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(date)
  if (mode === 'Year') return String(date.getFullYear())
  const range = periodRange(mode, anchor)
  const start = parseDate(range.start)
  const end = parseDate(range.end)
  return start.getMonth() === end.getMonth()
    ? `${new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    : `${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`
}

function shiftPeriod(mode: PeriodMode, anchor: string, amount: number) {
  const date = parseDate(anchor)
  if (mode === 'Custom') return anchor
  if (mode === 'Day') date.setDate(date.getDate() + amount)
  else if (mode === 'Week') date.setDate(date.getDate() + amount * 7)
  else if (mode === 'Month') {
    date.setDate(1)
    date.setMonth(date.getMonth() + amount)
  } else date.setFullYear(date.getFullYear() + amount, 0, 1)
  return dateKey(date)
}

function loadApprovedQuotations(): SalesQuotation[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(quotationStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const quotation = value as Partial<SalesQuotation>
      if (quotation.status !== 'Approved' || typeof quotation.id !== 'string' || typeof quotation.quotationNumber !== 'string') return []
      const items = Array.isArray(quotation.items) ? quotation.items.map((item) => ({ ...item, quantity: Number(item.quantity) || 0, unitCost: Number(item.unitCost) || 0 })) : []
      const subtotalAmount = Number(quotation.subtotalAmount) || Math.max(0, (Number(quotation.totalAmount) || 0))
      return [{
        id: quotation.id,
        dateCreated: quotation.dateCreated ?? '',
        quotationNumber: quotation.quotationNumber,
        clientId: quotation.clientId ?? '',
        clientName: quotation.clientName ?? '',
        contactPerson: quotation.contactPerson ?? '',
        subject: quotation.subject ?? '',
        projectLocation: quotation.projectLocation ?? '',
        leadTime: quotation.leadTime ?? '',
        subtotalAmount,
        totalAmount: Number(quotation.totalAmount) || 0,
        estimatedCost: items.reduce((total, item) => total + item.quantity * item.unitCost, 0),
        estimatedProfit: Number(quotation.estimatedProfit) || 0,
        status: quotation.status,
        items,
      }]
    })
  } catch {
    return []
  }
}

function loadLinkedExpenses(): LinkedExpense[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(expenseStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const expense = value as Partial<LinkedExpense>
      if (typeof expense.id !== 'number' || typeof expense.quotationId !== 'string' || !expense.quotationId || expense.status === 'Cancelled') return []
      return [{ id: expense.id, quotationId: expense.quotationId, amount: Number(expense.amount) || 0, status: typeof expense.status === 'string' ? expense.status : 'To pay' }]
    })
  } catch { return [] }
}

function loadStatements(): StatementOfAccount[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(statementStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is StatementOfAccount => typeof value === 'object' && value !== null && typeof (value as Partial<StatementOfAccount>).id === 'string' && Array.isArray((value as Partial<StatementOfAccount>).quotations))
  } catch {
    return []
  }
}

function effectiveStatementStatus(statement: StatementOfAccount): StatementStatus {
  if (statement.status === 'Cancelled' || statement.status === 'Draft') return statement.status
  if (statement.balance <= 0) return 'Settled'
  if (statement.dueDate && statement.dueDate < new Date().toISOString().slice(0, 10)) return 'Overdue'
  if (statement.totalPayments > 0) return 'Partially Settled'
  return statement.status === 'Overdue' ? 'Issued' : statement.status
}

function makeSalesRow(quotation: SalesQuotation, statements: StatementOfAccount[]): SalesRow {
  const statement = statements
    .filter((entry) => entry.status !== 'Cancelled' && entry.quotations.some((included) => included.id === quotation.id))
    .sort((left, right) => right.statementDate.localeCompare(left.statementDate))[0]
  if (!statement) return { quotation, billingStatus: 'Unbilled', collectionStatus: 'Unbilled' }
  if (statement.status === 'Draft') return { quotation, statement, billingStatus: 'Draft SOA', collectionStatus: 'Awaiting issue' }
  const status = effectiveStatementStatus(statement)
  if (status === 'Settled') return { quotation, statement, billingStatus: 'Billed', collectionStatus: 'Paid' }
  if (status === 'Partially Settled') return { quotation, statement, billingStatus: 'Billed', collectionStatus: 'Partially Paid' }
  if (status === 'Overdue') return { quotation, statement, billingStatus: 'Billed', collectionStatus: 'Overdue' }
  return { quotation, statement, billingStatus: 'Billed', collectionStatus: 'Unpaid' }
}

function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new Event('adiel:navigate'))
}

function billingTone(status: SalesRow['billingStatus']) {
  if (status === 'Billed') return 'border-sky-100 bg-sky-50 text-sky-700'
  if (status === 'Draft SOA') return 'border-violet-100 bg-violet-50 text-violet-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

function collectionTone(status: SalesRow['collectionStatus']) {
  if (status === 'Paid') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'Partially Paid') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (status === 'Overdue') return 'border-red-100 bg-red-50 text-red-600'
  if (status === 'Unpaid') return 'border-orange-100 bg-orange-50 text-orange-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

export function SalesTrackerPage() {
  const [quotations, setQuotations] = useState<SalesQuotation[]>(loadApprovedQuotations)
  const [statements, setStatements] = useState<StatementOfAccount[]>(loadStatements)
  const [expenses, setExpenses] = useState<LinkedExpense[]>(loadLinkedExpenses)
  const [search, setSearch] = useState('')
  const [billingFilter, setBillingFilter] = useState('All billing')
  const [collectionFilter, setCollectionFilter] = useState('All collections')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('Month')
  const [anchorDate, setAnchorDate] = useState(() => dateKey(new Date()))
  const [customFrom, setCustomFrom] = useState(() => {
    const today = new Date()
    return dateKey(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [customTo, setCustomTo] = useState(() => dateKey(new Date()))

  useEffect(() => {
    function refresh() {
      setQuotations(loadApprovedQuotations())
      setStatements(loadStatements())
      setExpenses(loadLinkedExpenses())
    }
    window.addEventListener('storage', refresh)
    window.addEventListener('adiel:navigate', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('adiel:navigate', refresh)
    }
  }, [])

  const rows = useMemo(() => quotations.map((quotation) => makeSalesRow(quotation, statements)), [quotations, statements])
  const activeRange = useMemo(() => periodMode === 'Custom' ? { start: customFrom, end: customTo } : periodRange(periodMode, anchorDate), [anchorDate, customFrom, customTo, periodMode])
  const activePeriodLabel = useMemo(() => periodLabel(periodMode, anchorDate), [anchorDate, periodMode])
  const periodRows = useMemo(() => rows.filter((row) => row.quotation.dateCreated >= activeRange.start && row.quotation.dateCreated <= activeRange.end), [activeRange.end, activeRange.start, rows])
  const expenseTotalsByQuotation = useMemo(() => {
    const totals = new Map<string, number>()
    expenses.forEach((expense) => totals.set(expense.quotationId, (totals.get(expense.quotationId) ?? 0) + expense.amount))
    return totals
  }, [expenses])
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return periodRows.filter((row) => {
      const matchesSearch = !query || [row.quotation.quotationNumber, row.quotation.clientName, row.quotation.subject, row.quotation.projectLocation, row.statement?.soaNumber ?? ''].some((value) => value.toLowerCase().includes(query))
      const matchesBilling = billingFilter === 'All billing' || row.billingStatus === billingFilter
      const matchesCollection = collectionFilter === 'All collections' || row.collectionStatus === collectionFilter
      return matchesSearch && matchesBilling && matchesCollection
    }).sort((left, right) => right.quotation.dateCreated.localeCompare(left.quotation.dateCreated))
  }, [billingFilter, collectionFilter, periodRows, search])

  const periodQuotationIds = new Set(periodRows.map((row) => row.quotation.id))
  const linkedStatements = statements.filter((statement) => statement.status !== 'Cancelled' && statement.quotations.some((quotation) => periodQuotationIds.has(quotation.id)))
  const uniqueStatements = Array.from(new Map(linkedStatements.map((statement) => [statement.id, statement])).values())
  const totalSales = periodRows.reduce((total, row) => total + row.quotation.totalAmount, 0)
  const estimatedRevenue = periodRows.reduce((total, row) => total + row.quotation.subtotalAmount, 0)
  const estimatedCost = periodRows.reduce((total, row) => total + row.quotation.estimatedCost, 0)
  const actualExpenses = periodRows.reduce((total, row) => total + (expenseTotalsByQuotation.get(row.quotation.id) ?? 0), 0)
  const totalProfit = periodRows.reduce((total, row) => total + row.quotation.estimatedProfit, 0)
  const actualProfit = estimatedRevenue - actualExpenses
  const profitVariance = actualProfit - totalProfit
  const profitMargin = totalSales ? (totalProfit / totalSales) * 100 : 0
  const billedSales = periodRows.filter((row) => row.billingStatus === 'Billed').reduce((total, row) => total + row.quotation.totalAmount, 0)
  const collected = uniqueStatements.reduce((total, statement) => total + statement.totalPayments, 0)
  const receivables = uniqueStatements.reduce((total, statement) => total + statement.balance, 0)

  const chartData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const summarize = (matching: SalesRow[]) => {
      const sales = matching.reduce((total, row) => total + row.quotation.subtotalAmount, 0)
      const profit = matching.reduce((total, row) => total + row.quotation.estimatedProfit, 0)
      const costs = matching.reduce((total, row) => total + (expenseTotalsByQuotation.get(row.quotation.id) ?? 0), 0)
      return { sales, profit, actualProfit: sales - costs }
    }
    if (periodMode === 'Custom') {
      const start = parseDate(activeRange.start)
      const end = parseDate(activeRange.end)
      const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
      if (dayCount <= 14) {
        return Array.from({ length: dayCount }, (_, index) => {
          const date = new Date(start)
          date.setDate(start.getDate() + index)
          const key = dateKey(date)
          const matching = periodRows.filter((row) => row.quotation.dateCreated === key)
          return { label: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date), ...summarize(matching) }
        })
      }
      if (dayCount <= 92) {
        return Array.from({ length: Math.ceil(dayCount / 7) }, (_, index) => {
          const bucketStart = new Date(start)
          bucketStart.setDate(start.getDate() + index * 7)
          const bucketEnd = new Date(bucketStart)
          bucketEnd.setDate(bucketStart.getDate() + 6)
          const matching = periodRows.filter((row) => row.quotation.dateCreated >= dateKey(bucketStart) && row.quotation.dateCreated <= dateKey(bucketEnd > end ? end : bucketEnd))
          return { label: `W${index + 1}`, ...summarize(matching) }
        })
      }
      const months: Array<{ label: string; key: string }> = []
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
      while (cursor <= end) {
        months.push({ label: new Intl.DateTimeFormat('en-PH', { month: 'short', year: '2-digit' }).format(cursor), key: dateKey(cursor).slice(0, 7) })
        cursor.setMonth(cursor.getMonth() + 1)
      }
      if (months.length > 24) {
        return Array.from({ length: end.getFullYear() - start.getFullYear() + 1 }, (_, index) => {
          const year = String(start.getFullYear() + index)
          const matching = periodRows.filter((row) => row.quotation.dateCreated.startsWith(year))
          return { label: year, ...summarize(matching) }
        })
      }
      return months.map((month) => {
        const matching = periodRows.filter((row) => row.quotation.dateCreated.startsWith(month.key))
        return { label: month.label, ...summarize(matching) }
      })
    }
    if (periodMode === 'Day') {
      return periodRows.length ? periodRows.map((row) => ({ label: row.quotation.quotationNumber.split('-').at(-1) ?? 'Sale', ...summarize([row]) })) : [{ label: 'Selected day', sales: 0, profit: 0, actualProfit: 0 }]
    }
    if (periodMode === 'Week') {
      const start = parseDate(activeRange.start)
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start)
        date.setDate(start.getDate() + index)
        const key = dateKey(date)
        const matching = periodRows.filter((row) => row.quotation.dateCreated === key)
        return { label: new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(date), ...summarize(matching) }
      })
    }
    if (periodMode === 'Month') {
      return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map((label, index) => {
        const matching = periodRows.filter((row) => Math.min(4, Math.floor((Number(row.quotation.dateCreated.slice(8, 10)) - 1) / 7)) === index)
        return { label, ...summarize(matching) }
      })
    }
    return monthNames.map((label, index) => {
      const key = `${anchorDate.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`
      const matching = periodRows.filter((row) => row.quotation.dateCreated.startsWith(key))
      return { label, ...summarize(matching) }
    })
  }, [activeRange.end, activeRange.start, anchorDate, expenseTotalsByQuotation, periodMode, periodRows])

  return <div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[32rem] bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.12),transparent_60%)]" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">Approved quotation performance</p></div><h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-brand-blue sm:text-3xl">Sales Tracker</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A live commercial view generated from approved quotations, connected SOAs, and recorded payments—without creating duplicate sales records.</p></div><div className="w-full max-w-2xl"><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Reporting period</p><div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1 sm:w-auto">{periodModes.map((mode) => <button className={periodMode === mode ? 'flex-1 rounded-lg bg-white px-3 py-2 text-[10px] font-extrabold text-brand-blue shadow-sm ring-1 ring-slate-200 sm:flex-none sm:px-4' : 'flex-1 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-400 transition hover:bg-white/70 hover:text-brand-blue sm:flex-none sm:px-4'} type="button" aria-pressed={periodMode === mode} onClick={() => setPeriodMode(mode)} key={mode}>{mode}</button>)}</div>{periodMode === 'Custom' ? <div className="mt-2 grid gap-2 sm:grid-cols-2"><div><p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">From</p><AnimatedDatePicker value={customFrom} onChange={(from) => { setCustomFrom(from); if (from > customTo) setCustomTo(from) }} ariaLabel="Custom report start date" max={customTo} size="filter" required /></div><div><p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">To</p><AnimatedDatePicker value={customTo} onChange={(to) => { setCustomTo(to); if (to < customFrom) setCustomFrom(to) }} ariaLabel="Custom report end date" min={customFrom} size="filter" required /></div></div> : <div className="mt-2 flex items-center gap-2"><button className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-brand-blue/20 hover:text-brand-blue" type="button" onClick={() => setAnchorDate((current) => shiftPeriod(periodMode, current, -1))} aria-label="Previous reporting period"><Icon path="m15 18-6-6 6-6" /></button><div className="min-w-0 flex-1"><AnimatedDatePicker value={anchorDate} onChange={setAnchorDate} ariaLabel="Choose reporting reference date" triggerLabel={activePeriodLabel} size="filter" required /></div><button className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-brand-blue/20 hover:text-brand-blue" type="button" onClick={() => setAnchorDate((current) => shiftPeriod(periodMode, current, 1))} aria-label="Next reporting period"><Icon path="m9 18 6-6-6-6" /></button><button className="h-10 shrink-0 rounded-xl border border-orange-100 bg-orange-50 px-3 text-[10px] font-bold text-brand-orange transition hover:bg-orange-100" type="button" onClick={() => setAnchorDate(dateKey(new Date()))}>Today</button></div>}</div></div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Estimated revenue" value={formatPeso(estimatedRevenue)} detail={`${periodRows.length} quotations · net of VAT`} tone="blue" /><Metric label="Estimated cost" value={formatPeso(estimatedCost)} detail="Quotation item costs" tone="slate" /><Metric label="Actual expenses" value={formatPeso(actualExpenses)} detail={`${expenses.filter((expense) => periodQuotationIds.has(expense.quotationId)).length} linked entries`} tone="violet" /><Metric label="Estimated profit" value={formatPeso(totalProfit)} detail={`${profitMargin.toFixed(1)}% margin`} tone="green" /><Metric label="Actual profit" value={formatPeso(actualProfit)} detail="Revenue less actual expenses" tone={actualProfit >= 0 ? 'cyan' : 'orange'} /><Metric label="Profit variance" value={`${profitVariance >= 0 ? '+' : ''}${formatPeso(profitVariance)}`} detail={profitVariance >= 0 ? 'Above estimate' : 'Below estimate'} tone={profitVariance >= 0 ? 'green' : 'orange'} /></div>
    </SummarySurface>

    <div className="grid gap-5 xl:grid-cols-[1.55fr_0.45fr]">
      <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)] sm:p-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-extrabold text-brand-blue">Profit overview</h3><p className="mt-1 text-[10px] text-slate-400">Estimated revenue and profit compared with actual profit from linked expenses</p></div><div className="flex flex-wrap items-center gap-4 text-[9px] font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-brand-blue" />Est. revenue</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-emerald-500" />Est. profit</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-cyan-500" />Actual profit</span></div></header><ProfitChart data={chartData} /></section>
      <aside className="rounded-[1.5rem] bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white shadow-[0_20px_48px_-30px_rgba(0,20,76,0.75)] sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><Icon path="M3 3v18h18M7 16l4-5 3 3 6-8" /></span><div><h3 className="text-sm font-extrabold">Performance snapshot</h3><p className="mt-0.5 text-[10px] text-white/45">For the selected period</p></div></div><div className="mt-6 space-y-4"><Snapshot label="Approved sales" value={formatPeso(totalSales)} /><Snapshot label="Billed sales" value={formatPeso(billedSales)} /><Snapshot label="Collections" value={formatPeso(collected)} /><Snapshot label="Receivables" value={formatPeso(receivables)} /><Snapshot label="Actual profit margin" value={`${estimatedRevenue ? ((actualProfit / estimatedRevenue) * 100).toFixed(1) : '0.0'}%`} /></div><div className="mt-6 border-t border-white/15 pt-5"><p className="text-[9px] leading-4 text-white/45">Actual profit is only as complete as the non-cancelled expenses linked to each approved quotation.</p></div></aside>
    </div>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h3 className="text-sm font-extrabold text-brand-blue">Profitability by quotation</h3><p className="mt-1 text-[10px] text-slate-400">A project-level comparison of quotation estimates and linked recorded costs.</p></div><button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100" type="button" onClick={() => navigate('/expenses')}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Link an expense</button></header>
      {periodRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-4 py-3.5">Quotation &amp; project</th><th className="px-4 py-3.5 text-right">Estimated revenue</th><th className="px-4 py-3.5 text-right">Estimated cost</th><th className="px-4 py-3.5 text-right">Actual expenses</th><th className="px-4 py-3.5 text-right">Estimated profit</th><th className="px-4 py-3.5 text-right">Actual profit</th><th className="px-4 py-3.5 text-right">Profit variance</th></tr></thead><tbody>{[...periodRows].sort((left, right) => right.quotation.dateCreated.localeCompare(left.quotation.dateCreated)).map((row) => { const linkedCost = expenseTotalsByQuotation.get(row.quotation.id) ?? 0; const rowActualProfit = row.quotation.subtotalAmount - linkedCost; const variance = rowActualProfit - row.quotation.estimatedProfit; return <tr className="border-t border-slate-100 transition hover:bg-blue-50/25" key={row.quotation.id}><td className="max-w-72 px-4 py-4"><button className="text-left" type="button" onClick={() => navigate(`/quotations/${row.quotation.id}`)}><p className="font-mono text-xs font-extrabold text-brand-blue hover:text-brand-orange">{row.quotation.quotationNumber}</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-600">{row.quotation.clientName} · {row.quotation.subject || 'No subject'}</p></button></td><td className="px-4 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(row.quotation.subtotalAmount)}</td><td className="px-4 py-4 text-right text-xs font-bold tabular-nums text-slate-600">{formatPeso(row.quotation.estimatedCost)}</td><td className="px-4 py-4 text-right"><p className="text-xs font-extrabold tabular-nums text-violet-700">{formatPeso(linkedCost)}</p><p className="mt-1 text-[9px] text-slate-400">Recorded costs</p></td><td className={`px-4 py-4 text-right text-xs font-extrabold tabular-nums ${row.quotation.estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPeso(row.quotation.estimatedProfit)}</td><td className={`px-4 py-4 text-right text-xs font-extrabold tabular-nums ${rowActualProfit >= 0 ? 'text-cyan-700' : 'text-red-600'}`}>{formatPeso(rowActualProfit)}</td><td className={`px-4 py-4 text-right text-xs font-extrabold tabular-nums ${variance >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{variance >= 0 ? '+' : ''}{formatPeso(variance)}</td></tr> })}</tbody></table></div> : <div className="grid min-h-36 place-items-center p-6 text-center"><p className="text-xs font-semibold text-slate-400">No approved quotations in the selected period.</p></div>}
      <footer className="border-t border-amber-100 bg-amber-50/60 px-4 py-3 text-[10px] font-semibold leading-5 text-amber-800 sm:px-5">Actual profit uses every non-cancelled expense linked to the quotation. Unlinked project costs are not included.</footer>
    </section>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-extrabold text-brand-blue">Sales performance register</h3><p className="mt-1 text-[10px] text-slate-400">One row per approved quotation; SOA figures are never counted as additional sales.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-xs font-medium text-brand-blue outline-none focus:border-brand-blue/40 sm:w-64" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quotation, client, project..." /></div><AnimatedDropdown className="sm:min-w-36" size="filter" value={billingFilter} options={billingOptions} onChange={setBillingFilter} ariaLabel="Filter billing status" /><AnimatedDropdown className="sm:min-w-40" size="filter" value={collectionFilter} options={collectionOptions} onChange={setCollectionFilter} ariaLabel="Filter collection status" /></div></div></header>
      {visibleRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1220px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-4 py-3.5">Quotation date</th><th className="px-4 py-3.5">Quotation</th><th className="px-4 py-3.5">Client &amp; project</th><th className="px-4 py-3.5 text-center">Items</th><th className="px-4 py-3.5 text-right">Sales amount</th><th className="px-4 py-3.5 text-right">Est. profit</th><th className="px-4 py-3.5">Billing</th><th className="px-4 py-3.5">Collection</th><th className="px-4 py-3.5">SOA</th><th className="px-4 py-3.5 text-right">Action</th></tr></thead><tbody>{visibleRows.map((row) => { const margin = row.quotation.totalAmount ? (row.quotation.estimatedProfit / row.quotation.totalAmount) * 100 : 0; return <tr className="border-t border-slate-100 transition hover:bg-blue-50/25" key={row.quotation.id}><td className="px-4 py-4 text-xs font-semibold text-slate-500">{formatDate(row.quotation.dateCreated)}</td><td className="px-4 py-4"><p className="font-mono text-xs font-extrabold text-brand-blue">{row.quotation.quotationNumber}</p><p className="mt-1 text-[9px] text-slate-400">{row.quotation.leadTime || 'No lead time'}</p></td><td className="max-w-64 px-4 py-4"><p className="truncate text-xs font-extrabold text-slate-700">{row.quotation.clientName}</p><p className="mt-1 truncate text-[9px] font-semibold text-slate-500">{row.quotation.subject}</p><p className="mt-1 truncate text-[9px] text-slate-400">{row.quotation.projectLocation}</p></td><td className="px-4 py-4 text-center text-xs font-bold text-slate-600">{row.quotation.items.length}</td><td className="px-4 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(row.quotation.totalAmount)}</td><td className={`px-4 py-4 text-right text-xs font-extrabold tabular-nums ${row.quotation.estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}><p>{formatPeso(row.quotation.estimatedProfit)}</p><p className="mt-1 text-[9px] opacity-70">{margin.toFixed(1)}%</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-[9px] font-bold ${billingTone(row.billingStatus)}`}>{row.billingStatus}</span></td><td className="px-4 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-[9px] font-bold ${collectionTone(row.collectionStatus)}`}>{row.collectionStatus}</span>{row.statement && row.billingStatus === 'Billed' ? <p className="mt-1.5 text-[9px] text-slate-400">SOA balance {formatPeso(row.statement.balance)}</p> : null}</td><td className="px-4 py-4">{row.statement ? <button className="font-mono text-[10px] font-extrabold text-violet-700 hover:text-brand-orange" type="button" onClick={() => navigate(`/statement-of-account/${row.statement?.id}`)}>{row.statement.soaNumber}</button> : <span className="text-[10px] font-semibold text-slate-300">Not assigned</span>}</td><td className="px-4 py-4 text-right"><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:bg-blue-50" type="button" onClick={() => navigate(`/quotations/${row.quotation.id}`)}>View quotation<Icon className="size-3" path="m9 18 6-6-6-6" /></button></td></tr>})}</tbody></table></div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="size-6" path="M3 3v18h18M7 16l4-5 3 3 6-8" /></span><h3 className="mt-4 text-base font-bold text-brand-blue">{rows.length ? 'No matching sales' : 'No approved quotations yet'}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{rows.length ? 'Adjust the reporting period or clear the current filters.' : 'Approved quotations will automatically appear here as sales without creating another record.'}</p>{!rows.length ? <button className="mt-5 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={() => navigate('/quotations')}>Open quotations</button> : null}</div></div>}
    </section>
  </div>
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'green' | 'violet' | 'cyan' | 'orange' | 'slate' }) {
  const tones = { blue: 'border-blue-100 bg-blue-50/55 text-brand-blue', green: 'border-emerald-100 bg-emerald-50/55 text-emerald-700', violet: 'border-violet-100 bg-violet-50/55 text-violet-700', cyan: 'border-cyan-100 bg-cyan-50/55 text-cyan-700', orange: 'border-orange-100 bg-orange-50/55 text-orange-700', slate: 'border-slate-200 bg-slate-50 text-slate-600' }
  return <article className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">{label}</p><p className="mt-2 truncate text-lg font-extrabold tracking-[-0.03em]">{value}</p><p className="mt-1 text-[9px] font-semibold opacity-60">{detail}</p></article>
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0"><span className="text-[10px] font-semibold text-white/50">{label}</span><strong className="text-sm font-extrabold">{value}</strong></div>
}

function ProfitChart({ data }: { data: Array<{ label: string; sales: number; profit: number; actualProfit: number }> }) {
  const maximum = Math.max(1, ...data.flatMap((point) => [point.sales, Math.abs(point.profit), Math.abs(point.actualProfit)]))
  const hasData = data.some((point) => point.sales || point.profit || point.actualProfit)
  if (!hasData) return <div className="mt-5 grid h-64 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/45 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-slate-300 shadow-sm"><Icon path="M3 3v18h18M7 16l4-5 3 3 6-8" /></span><p className="mt-3 text-xs font-bold text-slate-500">No sales in this period</p><p className="mt-1 text-[10px] text-slate-400">The chart will populate from approved quotations.</p></div></div>
  return <div className="mt-6"><div className="relative h-60 border-b border-l border-slate-200 pl-3"><div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-1"><span className="border-t border-dashed border-slate-100" /><span className="border-t border-dashed border-slate-100" /><span className="border-t border-dashed border-slate-100" /><span className="border-t border-dashed border-slate-100" /></div><div className="relative flex h-full items-end justify-around gap-1 px-2">{data.map((point) => { const salesHeight = point.sales ? Math.max(3, (point.sales / maximum) * 100) : 0; const profitHeight = point.profit ? Math.max(3, (Math.abs(point.profit) / maximum) * 100) : 0; const actualHeight = point.actualProfit ? Math.max(3, (Math.abs(point.actualProfit) / maximum) * 100) : 0; return <div className="group flex h-full min-w-0 flex-1 items-end justify-center gap-1" key={point.label}><div className="relative w-[27%] max-w-6 rounded-t-md bg-[linear-gradient(180deg,#0b397f,#00113f)] transition-all duration-300 group-hover:brightness-125" style={{ height: `${salesHeight}%` }} title={`${point.label} estimated revenue: ${formatPeso(point.sales)}`} /><div className={`relative w-[27%] max-w-6 rounded-t-md transition-all duration-300 group-hover:brightness-110 ${point.profit >= 0 ? 'bg-[linear-gradient(180deg,#34d399,#059669)]' : 'bg-[linear-gradient(180deg,#fb7185,#dc2626)]'}`} style={{ height: `${profitHeight}%` }} title={`${point.label} estimated ${point.profit >= 0 ? 'profit' : 'loss'}: ${formatPeso(point.profit)}`} /><div className={`relative w-[27%] max-w-6 rounded-t-md transition-all duration-300 group-hover:brightness-110 ${point.actualProfit >= 0 ? 'bg-[linear-gradient(180deg,#22d3ee,#0891b2)]' : 'bg-[linear-gradient(180deg,#fb923c,#ea580c)]'}`} style={{ height: `${actualHeight}%` }} title={`${point.label} actual ${point.actualProfit >= 0 ? 'profit' : 'loss'}: ${formatPeso(point.actualProfit)}`} /></div>})}</div></div><div className="mt-2 flex justify-around pl-3">{data.map((point) => <span className="min-w-0 flex-1 text-center text-[8px] font-bold uppercase text-slate-400" key={point.label}>{point.label}</span>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/70 px-4 py-3"><p className="text-[9px] font-semibold text-slate-400">Highest estimated revenue period</p><p className="text-[10px] font-extrabold text-brand-blue">{[...data].sort((left, right) => right.sales - left.sales)[0]?.label} · {formatCompactPeso([...data].sort((left, right) => right.sales - left.sales)[0]?.sales ?? 0)}</p></div></div>
}
