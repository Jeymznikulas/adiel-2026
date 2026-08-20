import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { loadSystemLogs, systemLogsUpdatedEvent, type SystemLogEntry } from '../../services/activityLog'
import { isActiveRecord } from '../../services/recordLifecycle'

const BusinessTrendChart = lazy(() => import('./BusinessTrendChart'))

type DashboardQuotation = {
  id: string
  quotationNumber: string
  dateCreated: string
  clientId: string
  clientName: string
  subject: string
  subtotalAmount: number
  totalAmount: number
  estimatedProfit: number
  status: string
}

type DashboardExpense = {
  id: number
  date: string
  amount: number
  status: string
  quotationId: string
}

type DashboardClient = {
  id: string
  name: string
  photo: string
  status: string
  clientSince: string
  transactions: Array<{ status?: string }>
}

type DashboardTask = {
  id: number
  title: string
  status: string
  priority: string
  dueDate: string
  assignedTo: string
}

type DashboardStatement = {
  id: string
  soaNumber: string
  clientName: string
  dueDate: string
  balance: number
  status: string
  quotationIds: string[]
  payments: Array<{ date: string; amount: number }>
}

type DashboardPurchaseOrder = {
  id: string
  poNumber: string
  supplierName: string
  totalAmount: number
  status: string
}

type DashboardData = {
  quotations: DashboardQuotation[]
  actionQuotations: DashboardQuotation[]
  expenses: DashboardExpense[]
  clients: DashboardClient[]
  tasks: DashboardTask[]
  statements: DashboardStatement[]
  purchaseOrders: DashboardPurchaseOrder[]
  logs: SystemLogEntry[]
}

const emptyData: DashboardData = { quotations: [], actionQuotations: [], expenses: [], clients: [], tasks: [], statements: [], purchaseOrders: [], logs: [] }

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

type DashboardInfoProps = {
  title: string
  source: string
  included: string
  calculation?: string
}

function DashboardInfo({ title, source, included, calculation }: DashboardInfoProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId().replaceAll(':', '')

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(288, window.innerWidth - 24)
    const estimatedHeight = calculation ? 220 : 175
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12)
    const opensAbove = window.innerHeight - rect.bottom < estimatedHeight + 16 && rect.top > estimatedHeight + 16
    setPosition({ top: opensAbove ? rect.top - estimatedHeight - 8 : rect.bottom + 8, left })
  }

  function toggle() {
    if (!isOpen) updatePosition()
    setIsOpen((current) => !current)
  }

  useEffect(() => {
    if (!isOpen) return
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }
    const closeOnViewportChange = () => setIsOpen(false)
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [isOpen])

  return <>
    <button ref={buttonRef} className={`grid size-7 shrink-0 place-items-center rounded-lg border text-slate-400 transition ${isOpen ? 'border-brand-blue/20 bg-blue-50 text-brand-blue' : 'border-slate-200 bg-white hover:border-brand-blue/20 hover:bg-blue-50 hover:text-brand-blue'}`} type="button" onClick={toggle} aria-label={`How ${title.toLowerCase()} is calculated`} aria-expanded={isOpen} aria-controls={isOpen ? popoverId : undefined} title="Show data source"><Icon className="size-3.5" path="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></button>
    {isOpen ? createPortal(<div ref={popoverRef} className="fixed z-[90] w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-20px_rgba(0,20,76,0.42)] animate-[content-enter_180ms_cubic-bezier(0.22,1,0.36,1)]" id={popoverId} role="dialog" aria-label={`${title} data information`} style={position}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-brand-blue"><Icon className="size-3.5" path="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Data information</p><h4 className="mt-0.5 text-xs font-extrabold text-brand-blue">{title}</h4></div></div><button className="grid size-7 place-items-center rounded-lg text-slate-300 transition hover:bg-white hover:text-brand-blue" type="button" onClick={() => setIsOpen(false)} aria-label="Close data information"><Icon className="size-3.5" path="M18 6 6 18M6 6l12 12" /></button></header>
      <dl className="space-y-3 px-4 py-3.5"><div><dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">Source</dt><dd className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">{source}</dd></div><div><dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">Included</dt><dd className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">{included}</dd></div>{calculation ? <div><dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">Calculation</dt><dd className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">{calculation}</dd></div> : null}</dl>
    </div>, document.body) : null}
  </>
}

function readArray(storageKey: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isActiveRecord) : []
  } catch {
    return []
  }
}

function loadDashboardData(): DashboardData {
  const actionQuotations = readArray('adiel.quotations').flatMap((value): DashboardQuotation[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'string' || typeof entry.status !== 'string') return []
    return [{
      id: entry.id,
      quotationNumber: typeof entry.quotationNumber === 'string' ? entry.quotationNumber : 'Quotation',
      dateCreated: typeof entry.dateCreated === 'string' ? entry.dateCreated.slice(0, 10) : '',
      clientId: typeof entry.clientId === 'string' ? entry.clientId : '',
      clientName: typeof entry.clientName === 'string' ? entry.clientName : 'Unknown client',
      subject: typeof entry.subject === 'string' ? entry.subject : '',
      subtotalAmount: Number(entry.subtotalAmount) || 0,
      totalAmount: Number(entry.totalAmount) || 0,
      estimatedProfit: Number(entry.estimatedProfit) || 0,
      status: entry.status,
    }]
  })
  const quotations = actionQuotations.filter((quotation) => quotation.status === 'Approved')

  const expenses = readArray('adiel.expenses').flatMap((value): DashboardExpense[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'number' || entry.status === 'Cancelled') return []
    return [{ id: entry.id, date: typeof entry.date === 'string' ? entry.date.slice(0, 10) : '', amount: Number(entry.amount) || 0, status: typeof entry.status === 'string' ? entry.status : 'To pay', quotationId: typeof entry.quotationId === 'string' ? entry.quotationId : '' }]
  })

  const clients = readArray('adiel.clients').flatMap((value): DashboardClient[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'string' || typeof entry.name !== 'string') return []
    const transactions = Array.isArray(entry.transactions) ? entry.transactions.filter((transaction): transaction is { status?: string } => typeof transaction === 'object' && transaction !== null) : []
    return [{ id: entry.id, name: entry.name, photo: typeof entry.photo === 'string' ? entry.photo : '', status: typeof entry.status === 'string' ? entry.status : 'Active', clientSince: typeof entry.clientSince === 'string' ? entry.clientSince.slice(0, 10) : '', transactions }]
  })

  const tasks = readArray('adiel.tasks').flatMap((value): DashboardTask[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'number' || typeof entry.title !== 'string') return []
    return [{ id: entry.id, title: entry.title, status: typeof entry.status === 'string' ? entry.status : 'To do', priority: typeof entry.priority === 'string' ? entry.priority : 'Medium', dueDate: typeof entry.dueDate === 'string' ? entry.dueDate.slice(0, 10) : '', assignedTo: typeof entry.assignedTo === 'string' ? entry.assignedTo : 'Unassigned' }]
  })

  const statements = readArray('adiel.statements-of-account').flatMap((value): DashboardStatement[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'string' || typeof entry.soaNumber !== 'string') return []
    const payments = Array.isArray(entry.payments) ? entry.payments.flatMap((value): Array<{ date: string; amount: number }> => {
      if (typeof value !== 'object' || value === null) return []
      const payment = value as Record<string, unknown>
      return typeof payment.date === 'string' ? [{ date: payment.date.slice(0, 10), amount: Number(payment.amount) || 0 }] : []
    }) : []
    const quotationIds = Array.isArray(entry.quotations) ? entry.quotations.flatMap((value): string[] => {
      if (typeof value !== 'object' || value === null) return []
      const quotation = value as Record<string, unknown>
      return typeof quotation.id === 'string' ? [quotation.id] : []
    }) : []
    return [{ id: entry.id, soaNumber: entry.soaNumber, clientName: typeof entry.clientName === 'string' ? entry.clientName : 'Unknown client', dueDate: typeof entry.dueDate === 'string' ? entry.dueDate.slice(0, 10) : '', balance: Number(entry.balance) || 0, status: typeof entry.status === 'string' ? entry.status : 'Draft', quotationIds, payments }]
  })

  const purchaseOrders = readArray('adiel.purchase-orders').flatMap((value): DashboardPurchaseOrder[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'string' || typeof entry.poNumber !== 'string') return []
    return [{ id: entry.id, poNumber: entry.poNumber, supplierName: typeof entry.supplierName === 'string' ? entry.supplierName : 'Unknown supplier', totalAmount: Number(entry.totalAmount) || 0, status: typeof entry.status === 'string' ? entry.status : 'Not yet sent' }]
  })

  return { quotations, actionQuotations, expenses, clients, tasks, statements, purchaseOrders, logs: loadSystemLogs() }
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentRanges() {
  const now = new Date()
  const today = dateKey(now)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  return {
    today: { start: today, end: today },
    week: { start: dateKey(weekStart), end: today },
    month: { start: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), end: today },
  }
}

function monthRange(offset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { start: dateKey(start), end: dateKey(end) }
}

function isInRange(date: string, start: string, end: string) {
  return Boolean(date) && date >= start && date <= end
}

function sumPeriod<T>(entries: T[], getDate: (entry: T) => string, getValue: (entry: T) => number, start: string, end: string) {
  return entries.reduce((total, entry) => isInRange(getDate(entry), start, end) ? total + getValue(entry) : total, 0)
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
}

function formatCompactPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function changePercent(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / previous) * 100
}

function formatDate(value: string) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function formatActivityTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  return isToday
    ? new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date)
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'CL'
}

function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new Event('adiel:navigate'))
}

function PeriodCard({ title, detail, icon, tone, values, monthChange, info, onOpen }: {
  title: string
  detail: string
  icon: string
  tone: 'blue' | 'orange'
  values: { today: number; week: number; month: number }
  monthChange: number
  info: Omit<DashboardInfoProps, 'title'>
  onOpen: () => void
}) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-brand-blue' : 'bg-orange-50 text-brand-orange'
  return <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)] animate-[po-card-enter_300ms_cubic-bezier(0.22,1,0.36,1)_both]">
    <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass}`}><Icon path={icon} /></span><div><h3 className="text-sm font-extrabold text-brand-blue">{title}</h3><p className="mt-0.5 text-[10px] text-slate-400">{detail}</p></div></div>
      <div className="flex shrink-0 items-center gap-1"><DashboardInfo title={title} {...info} /><button className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onOpen} aria-label={`Open ${title.toLowerCase()}`}><Icon className="size-3.5" path="m9 18 6-6-6-6" /></button></div>
    </header>
    <div className="grid grid-cols-3 border-t border-slate-100">
      {([['Today', values.today], ['This week', values.week], ['This month', values.month]] as const).map(([label, value], index) => <div className={`min-w-0 px-4 py-4 ${index ? 'border-l border-slate-100' : ''}`} key={label}><p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</p><p className="mt-2 truncate text-base font-extrabold tracking-[-0.03em] text-brand-blue" title={formatPeso(value)}>{formatCompactPeso(value)}</p>{index === 2 ? <p className={`mt-1 text-[9px] font-bold ${monthChange > 0 ? tone === 'orange' ? 'text-amber-600' : 'text-emerald-600' : monthChange < 0 ? tone === 'orange' ? 'text-emerald-600' : 'text-red-500' : 'text-slate-400'}`}>{monthChange > 0 ? '+' : ''}{monthChange.toFixed(1)}% vs last month</p> : null}</div>)}
    </div>
  </article>
}

type TrendPoint = { key: string; label: string; sales: number; expenses: number; profit: number }

function EmptyState({ message }: { message: string }) {
  return <div className="grid min-h-36 place-items-center px-5 py-7 text-center"><div><span className="mx-auto block size-1.5 rounded-full bg-slate-300" /><p className="mt-3 text-xs font-semibold text-slate-400">{message}</p></div></div>
}

type DashboardActionTone = 'danger' | 'today' | 'pending' | 'upcoming'

type DashboardAction = {
  id: string
  title: string
  detail: string
  urgency: 'Overdue' | 'Today' | 'Pending' | 'Upcoming'
  tone: DashboardActionTone
  icon: string
  actionLabel: string
  path: string
  priority: number
  sortDate: string
}

const actionToneClasses: Record<DashboardActionTone, { badge: string; icon: string; button: string }> = {
  danger: { badge: 'bg-red-50 text-red-600', icon: 'bg-red-50 text-red-600', button: 'border-red-100 text-red-600 hover:bg-red-50' },
  today: { badge: 'bg-amber-50 text-amber-700', icon: 'bg-amber-50 text-amber-700', button: 'border-amber-100 text-amber-700 hover:bg-amber-50' },
  pending: { badge: 'bg-blue-50 text-brand-blue', icon: 'bg-blue-50 text-brand-blue', button: 'border-blue-100 text-brand-blue hover:bg-blue-50' },
  upcoming: { badge: 'bg-violet-50 text-violet-700', icon: 'bg-violet-50 text-violet-700', button: 'border-violet-100 text-violet-700 hover:bg-violet-50' },
}

function ActionCenter({ actions, expanded, onToggle }: { actions: DashboardAction[]; expanded: boolean; onToggle: () => void }) {
  const visibleActions = expanded ? actions : actions.slice(0, 5)
  return <section className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]" aria-labelledby="action-center-title">
    <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-brand-orange"><Icon path="M12 8v4l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-brand-blue" id="action-center-title">Action Center</h3>{actions.length ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{actions.length} open</span> : null}</div><p className="mt-1 text-[10px] text-slate-400">Your most important next steps across the business</p></div></div><div className="flex items-center gap-2"><DashboardInfo title="Action Center" source="Quotations, Statements of Account, Purchase Orders, and Tasks" included="Pending approvals, approved quotations without an SOA, unsent POs, open balances nearing or past due, and urgent incomplete tasks." calculation="Overdue and due-today work appears first, followed by approvals, billing, and upcoming work." />{actions.length > 5 ? <button className="h-8 rounded-lg px-2.5 text-[10px] font-bold text-brand-blue transition hover:bg-blue-50" type="button" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Show less' : `View all ${actions.length}`}</button> : null}</div></header>
    {visibleActions.length ? <div className="divide-y divide-slate-100">{visibleActions.map((action) => { const tone = actionToneClasses[action.tone]; return <article className="flex flex-col gap-3 px-5 py-3.5 transition hover:bg-slate-50/65 sm:flex-row sm:items-center" key={action.id}><div className="flex min-w-0 flex-1 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone.icon}`}><Icon className="size-4" path={action.icon} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.08em] ${tone.badge}`}>{action.urgency}</span><h4 className="truncate text-xs font-extrabold text-slate-700">{action.title}</h4></div><p className="mt-1.5 truncate text-[10px] font-medium text-slate-400">{action.detail}</p></div></div><button className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border bg-white px-3 text-[10px] font-bold transition hover:-translate-y-0.5 ${tone.button}`} type="button" onClick={() => navigate(action.path)}>{action.actionLabel}<Icon className="size-3" path="m9 18 6-6-6-6" /></button></article>})}</div> : <div className="grid min-h-36 place-items-center px-5 py-7 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon path="m5 12 4 4L19 6" /></span><p className="mt-3 text-xs font-bold text-brand-blue">You are all caught up</p><p className="mt-1 text-[10px] text-slate-400">New approvals, billing, payments, orders, and tasks will appear here.</p></div></div>}
  </section>
}

export function DashboardPage({ username }: { username: string }) {
  const [data, setData] = useState<DashboardData>(emptyData)
  const [trendMonths, setTrendMonths] = useState<6 | 12>(6)
  const [showAllActions, setShowAllActions] = useState(false)

  useEffect(() => {
    const refresh = () => setData(loadDashboardData())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('adiel:navigate', refresh)
    window.addEventListener(systemLogsUpdatedEvent, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('adiel:navigate', refresh)
      window.removeEventListener(systemLogsUpdatedEvent, refresh)
    }
  }, [])

  const dashboard = useMemo(() => {
    const ranges = currentRanges()
    const sales = {
      today: sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.totalAmount, ranges.today.start, ranges.today.end),
      week: sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.totalAmount, ranges.week.start, ranges.week.end),
      month: sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.totalAmount, ranges.month.start, ranges.month.end),
    }
    const expenses = {
      today: sumPeriod(data.expenses, (entry) => entry.date, (entry) => entry.amount, ranges.today.start, ranges.today.end),
      week: sumPeriod(data.expenses, (entry) => entry.date, (entry) => entry.amount, ranges.week.start, ranges.week.end),
      month: sumPeriod(data.expenses, (entry) => entry.date, (entry) => entry.amount, ranges.month.start, ranges.month.end),
    }
    const grossProfit = sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.estimatedProfit, ranges.month.start, ranges.month.end)
    const margin = sales.month ? (grossProfit / sales.month) * 100 : 0
    const previousMonth = monthRange(-1)
    const previousMonthEnd = new Date(`${previousMonth.end}T00:00:00`)
    previousMonthEnd.setDate(Math.min(new Date().getDate(), previousMonthEnd.getDate()))
    const comparisonEnd = dateKey(previousMonthEnd)
    const previousSales = sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.totalAmount, previousMonth.start, comparisonEnd)
    const previousExpenses = sumPeriod(data.expenses, (entry) => entry.date, (entry) => entry.amount, previousMonth.start, comparisonEnd)
    const monthQuotations = data.quotations.filter((entry) => isInRange(entry.dateCreated, ranges.month.start, ranges.month.end))
    const actualRevenue = monthQuotations.reduce((total, entry) => total + entry.subtotalAmount, 0)
    const monthExpenses = data.expenses.filter((entry) => isInRange(entry.date, ranges.month.start, ranges.month.end))
    const projectExpenses = monthExpenses.filter((entry) => entry.quotationId).reduce((total, entry) => total + entry.amount, 0)
    const operatingExpenses = monthExpenses.filter((entry) => !entry.quotationId).reduce((total, entry) => total + entry.amount, 0)
    const projectProfit = actualRevenue - projectExpenses
    const companyNetProfit = projectProfit - operatingExpenses
    const collectionsReceived = data.statements.filter((statement) => statement.status !== 'Cancelled').flatMap((statement) => statement.payments).filter((payment) => isInRange(payment.date, ranges.month.start, ranges.month.end)).reduce((total, payment) => total + payment.amount, 0)
    const paidExpenses = monthExpenses.filter((entry) => entry.status === 'Paid').reduce((total, entry) => total + entry.amount, 0)
    const cashPosition = collectionsReceived - paidExpenses
    const trend: TrendPoint[] = Array.from({ length: trendMonths }, (_, index) => {
      const anchor = new Date()
      anchor.setDate(1)
      anchor.setMonth(anchor.getMonth() - (trendMonths - 1 - index))
      const start = dateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
      const end = dateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))
      return {
        key: start.slice(0, 7),
        label: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(anchor),
        sales: sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.totalAmount, start, end),
        expenses: sumPeriod(data.expenses, (entry) => entry.date, (entry) => entry.amount, start, end),
        profit: sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.subtotalAmount, start, end) - sumPeriod(data.expenses, (entry) => entry.date, (entry) => entry.amount, start, end),
      }
    })
    const salesByClient = new Map<string, { id: string; name: string; sales: number; orders: number }>()
    data.quotations.forEach((quotation) => {
      const key = quotation.clientId || quotation.clientName
      const current = salesByClient.get(key) ?? { id: quotation.clientId, name: quotation.clientName, sales: 0, orders: 0 }
      current.sales += quotation.totalAmount
      current.orders += 1
      salesByClient.set(key, current)
    })
    const repeatClients = [...salesByClient.values()].filter((client) => client.orders > 1).sort((left, right) => right.orders - left.orders || right.sales - left.sales)
    const topClients = repeatClients.slice(0, 5)
    const today = ranges.today.end
    const attentionEndDate = new Date(`${today}T00:00:00`)
    attentionEndDate.setDate(attentionEndDate.getDate() + 3)
    const attentionEnd = dateKey(attentionEndDate)
    const normalizedUsername = username.trim().toLowerCase()
    const allUrgentTasks = data.tasks
      .filter((task) => task.status !== 'Completed' && (task.priority === 'High' || Boolean(task.dueDate && task.dueDate <= attentionEnd)))
      .sort((left, right) => {
        const leftOverdue = Boolean(left.dueDate && left.dueDate < today)
        const rightOverdue = Boolean(right.dueDate && right.dueDate < today)
        if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1
        const leftMine = Boolean(normalizedUsername && left.assignedTo.toLowerCase().includes(normalizedUsername))
        const rightMine = Boolean(normalizedUsername && right.assignedTo.toLowerCase().includes(normalizedUsername))
        if (leftMine !== rightMine) return leftMine ? -1 : 1
        if (left.priority !== right.priority) return left.priority === 'High' ? -1 : 1
        return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31')
      })
    const urgentTasks = allUrgentTasks.slice(0, 5)
    const openStatements = data.statements.filter((statement) => statement.balance > 0 && statement.status !== 'Draft' && statement.status !== 'Cancelled')
    const dueSoonDate = new Date(`${today}T00:00:00`)
    dueSoonDate.setDate(dueSoonDate.getDate() + 7)
    const dueSoonEnd = dateKey(dueSoonDate)
    const overdueStatements = openStatements.filter((statement) => statement.status === 'Overdue' || Boolean(statement.dueDate && statement.dueDate < today))
    const dueSoonStatements = openStatements.filter((statement) => statement.dueDate >= today && statement.dueDate <= dueSoonEnd)
    const activePurchaseOrders = data.purchaseOrders.filter((order) => order.status !== 'Cancelled' && order.status !== 'Delivered')
    const usedQuotationIds = new Set(data.statements.filter((statement) => statement.status !== 'Cancelled').flatMap((statement) => statement.quotationIds))
    const actionItems: DashboardAction[] = []

    openStatements.forEach((statement) => {
      if (!statement.dueDate || statement.dueDate > dueSoonEnd) return
      const overdue = statement.status === 'Overdue' || statement.dueDate < today
      const dueToday = statement.dueDate === today
      const urgency = overdue ? 'Overdue' : dueToday ? 'Today' : 'Upcoming'
      actionItems.push({
        id: `statement-${statement.id}`,
        title: `${statement.soaNumber} · ${statement.clientName}`,
        detail: `${formatPeso(statement.balance)} outstanding · ${overdue ? `due ${formatDate(statement.dueDate)}` : dueToday ? 'payment due today' : `due ${formatDate(statement.dueDate)}`}`,
        urgency,
        tone: overdue ? 'danger' : dueToday ? 'today' : 'upcoming',
        icon: 'M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2',
        actionLabel: overdue || dueToday ? 'Record payment' : 'View SOA',
        path: `/statement-of-account/${encodeURIComponent(statement.id)}${overdue || dueToday ? '?pay=1' : ''}`,
        priority: overdue ? 0 : dueToday ? 2 : 6,
        sortDate: statement.dueDate,
      })
    })

    allUrgentTasks.forEach((task) => {
      const overdue = Boolean(task.dueDate && task.dueDate < today)
      const dueToday = task.dueDate === today
      actionItems.push({
        id: `task-${task.id}`,
        title: task.title,
        detail: `${task.assignedTo} · ${overdue ? `due ${formatDate(task.dueDate)}` : dueToday ? 'due today' : task.dueDate ? `due ${formatDate(task.dueDate)}` : `${task.priority} priority`}`,
        urgency: overdue ? 'Overdue' : dueToday ? 'Today' : task.dueDate ? 'Upcoming' : 'Pending',
        tone: overdue ? 'danger' : dueToday ? 'today' : task.dueDate ? 'upcoming' : 'pending',
        icon: 'M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
        actionLabel: 'Open task',
        path: `/tasks?task=${task.id}`,
        priority: overdue ? 1 : dueToday ? 2 : 7,
        sortDate: task.dueDate || '9999-12-31',
      })
    })

    data.actionQuotations.filter((quotation) => quotation.status === 'For Approval').forEach((quotation) => {
      actionItems.push({ id: `quotation-approval-${quotation.id}`, title: `${quotation.quotationNumber} · ${quotation.clientName}`, detail: quotation.subject || 'Quotation waiting for approval', urgency: 'Pending', tone: 'pending', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6M8 13h8M8 17h5', actionLabel: 'Review', path: `/quotations/${encodeURIComponent(quotation.id)}?review=1`, priority: 3, sortDate: quotation.dateCreated })
    })

    data.actionQuotations.filter((quotation) => quotation.status === 'Approved' && !usedQuotationIds.has(quotation.id)).forEach((quotation) => {
      actionItems.push({ id: `quotation-billing-${quotation.id}`, title: `${quotation.quotationNumber} · ${quotation.clientName}`, detail: `${formatPeso(quotation.totalAmount)} approved and ready for billing`, urgency: 'Pending', tone: 'pending', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6', actionLabel: 'Create SOA', path: `/statement-of-account?new=1&quotationId=${encodeURIComponent(quotation.id)}`, priority: 4, sortDate: quotation.dateCreated })
    })

    activePurchaseOrders.filter((order) => order.status === 'Not yet sent').forEach((order) => {
      actionItems.push({ id: `purchase-order-${order.id}`, title: `${order.poNumber} · ${order.supplierName}`, detail: `${formatPeso(order.totalAmount)} purchase order is ready to send`, urgency: 'Pending', tone: 'pending', icon: 'M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6', actionLabel: 'View PO', path: `/purchase-orders?order=${encodeURIComponent(order.id)}`, priority: 5, sortDate: order.poNumber })
    })

    actionItems.sort((left, right) => left.priority - right.priority || left.sortDate.localeCompare(right.sortDate) || left.title.localeCompare(right.title))
    return {
      ranges, sales, expenses, grossProfit, actualRevenue, projectExpenses, operatingExpenses, projectProfit, companyNetProfit, collectionsReceived, paidExpenses, cashPosition, margin, trend, topClients, urgentTasks, actionItems,
      salesChange: changePercent(sales.month, previousSales),
      expenseChange: changePercent(expenses.month, previousExpenses),
      activeClients: data.clients.filter((client) => client.status === 'Active').length,
      newClients: data.clients.filter((client) => isInRange(client.clientSince, ranges.month.start, ranges.month.end)).length,
      repeatClients: repeatClients.length,
      urgentTaskCount: allUrgentTasks.length,
      outstandingBalance: openStatements.reduce((total, statement) => total + statement.balance, 0),
      overdueBalance: overdueStatements.reduce((total, statement) => total + statement.balance, 0),
      overdueStatementCount: overdueStatements.length,
      dueSoonStatementCount: dueSoonStatements.length,
      waitingDeliveryCount: activePurchaseOrders.filter((order) => order.status === 'Waiting for Delivery' || order.status === 'Sent').length,
      forPaymentCount: activePurchaseOrders.filter((order) => order.status === 'For Payment').length,
      forPaymentTotal: activePurchaseOrders.filter((order) => order.status === 'For Payment').reduce((total, order) => total + order.totalAmount, 0),
      notSentCount: activePurchaseOrders.filter((order) => order.status === 'Not yet sent').length,
    }
  }, [data, trendMonths, username])

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center" aria-label="Dashboard summary">
      <div><div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Business overview</p></div><h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">{greeting}, {username}.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Here is what needs your attention and how the business is performing today.</p></div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-3.5 sm:min-w-32 sm:px-4"><div className="flex items-center justify-between gap-1"><p className="truncate text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">Month sales</p><DashboardInfo title="Month sales" source="Quotations" included="Approved quotations dated within the current month." calculation="Sum of the quotation total amounts." /></div><p className="mt-2 truncate text-lg font-extrabold text-brand-blue" title={formatPeso(dashboard.sales.month)}>{formatCompactPeso(dashboard.sales.month)}</p></article>
        <article className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-3.5 sm:min-w-32 sm:px-4"><div className="flex items-center justify-between gap-1"><p className="truncate text-[10px] font-bold uppercase tracking-[0.07em] text-emerald-600">Company net</p><DashboardInfo title="Company net" source="Approved quotations and Expenses" included="Current-month approved revenue and every non-cancelled expense." calculation="Quotation subtotals minus project expenses minus operating expenses." /></div><p className="mt-2 truncate text-lg font-extrabold text-emerald-700" title={formatPeso(dashboard.companyNetProfit)}>{formatCompactPeso(dashboard.companyNetProfit)}</p></article>
        <article className="min-w-0 rounded-2xl border border-red-100 bg-red-50/55 px-3 py-3.5 sm:min-w-32 sm:px-4"><div className="flex items-center justify-between gap-1"><p className="truncate text-[10px] font-bold uppercase tracking-[0.07em] text-red-500">Urgent tasks</p><DashboardInfo title="Urgent tasks" source="Tasks" included="Incomplete high-priority, overdue, or due-within-three-days tasks." calculation="Count of all tasks currently requiring attention." /></div><p className="mt-2 text-lg font-extrabold text-red-600">{dashboard.urgentTaskCount}</p></article>
      </div>
    </SummarySurface>

    <section className="flex flex-col gap-3 rounded-[1.25rem] border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_10px_28px_-25px_rgba(0,20,76,0.3)] sm:flex-row sm:items-center" aria-label="Quick actions"><div className="shrink-0"><p className="text-xs font-extrabold text-brand-blue">Quick actions</p><p className="mt-0.5 text-[10px] text-slate-400">Start common work</p></div><div className="flex flex-1 flex-wrap gap-2 sm:justify-end">{[
      { label: 'New quotation', path: '/quotations?new=1', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6' },
      { label: 'New purchase order', path: '/purchase-orders?new=1', icon: 'M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6' },
      { label: 'Add expense', path: '/expenses?new=1', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5' },
      { label: 'Add task', path: '/tasks?new=1', icon: 'M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5' },
    ].map((action) => <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:border-brand-blue/15 hover:bg-blue-50/45 sm:flex-none" type="button" onClick={() => navigate(action.path)} key={action.label}><Icon className="size-3.5 text-slate-400" path={action.icon} />{action.label}</button>)}</div></section>

    <ActionCenter actions={dashboard.actionItems} expanded={showAllActions} onToggle={() => setShowAllActions((current) => !current)} />

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Financial overview">
      <PeriodCard title="Sales overview" detail="Approved quotations" icon="M3 3v18h18M7 16l4-5 3 3 6-8" tone="blue" values={dashboard.sales} monthChange={dashboard.salesChange} info={{ source: 'Quotations', included: 'Approved quotations grouped by their creation date.', calculation: 'Sum of total quotation amounts for today, this week, and this month.' }} onOpen={() => navigate('/sales-tracker')} />
      <PeriodCard title="Expenses" detail="All non-cancelled expenses" icon="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" tone="orange" values={dashboard.expenses} monthChange={dashboard.expenseChange} info={{ source: 'Expenses', included: 'Project-linked and general expenses except cancelled records.', calculation: 'Sum of expense amounts for today, this week, and this month.' }} onOpen={() => navigate('/expenses')} />
    </section>

    <section className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]" aria-labelledby="business-trend-title">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="text-sm font-extrabold text-brand-blue" id="business-trend-title">Business trend</h3><p className="mt-1 text-[10px] text-slate-400">Approved revenue, all expenses, and company net profit over time</p></div>
        <div className="flex flex-wrap items-center gap-3"><DashboardInfo title="Business trend" source="Approved Quotations and Expenses" included="Monthly approved quotation totals and all non-cancelled expenses." calculation="Company net is quotation subtotal revenue minus all expenses for each month." /><div className="flex items-center gap-4 text-[10px] font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#0b397f]" />Sales</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#fd7a3f]" />Expenses</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border-2 border-emerald-500 bg-white" />Company net</span></div><div className="inline-flex rounded-lg bg-slate-100 p-0.5">{([6, 12] as const).map((months) => <button className={`rounded-md px-2.5 py-1.5 text-[9px] font-bold transition ${trendMonths === months ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-400 hover:text-brand-blue'}`} type="button" onClick={() => setTrendMonths(months)} aria-pressed={trendMonths === months} key={months}>{months}M</button>)}</div></div>
      </header>
      <div className="px-4 pb-3 pt-4 sm:px-5"><Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-slate-50" aria-label="Loading business trend chart" />}><BusinessTrendChart data={dashboard.trend} /></Suspense></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]" aria-label="Profit and client metrics">
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)] animate-[po-card-enter_300ms_50ms_cubic-bezier(0.22,1,0.36,1)_both]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">This month</p><h3 className="mt-1 text-sm font-extrabold text-brand-blue">Company profit</h3></div><div className="flex items-center gap-2"><DashboardInfo title="Company profit" source="Approved Quotations, Expenses, and SOA Payments" included="Current-month quotation subtotals, non-cancelled expenses, received payments, and paid expenses." calculation="Net profit is revenue minus project and operating expenses. Cash position is collections minus paid expenses." /><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon path="M4 18 10 12l4 4 6-8M20 8h-5M20 8v5" /></span></div></header>
        <div className="p-5"><div className="grid grid-cols-2 gap-3"><div><p className="text-[9px] font-bold uppercase text-slate-400">Approved revenue</p><p className="mt-2 text-lg font-extrabold text-brand-blue">{formatCompactPeso(dashboard.actualRevenue)}</p></div><div className="border-l border-slate-100 pl-3"><p className="text-[9px] font-bold uppercase text-emerald-600">Company net profit</p><p className={`mt-2 text-lg font-extrabold ${dashboard.companyNetProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCompactPeso(dashboard.companyNetProfit)}</p></div></div>
          <div className="mt-4 space-y-2 rounded-xl bg-slate-50/75 p-3.5 text-xs"><div className="flex items-center justify-between"><span className="font-semibold text-slate-500">Project expenses</span><strong className="text-violet-700">−{formatCompactPeso(dashboard.projectExpenses)}</strong></div><div className="flex items-center justify-between"><span className="font-semibold text-slate-500">Operating expenses</span><strong className="text-orange-700">−{formatCompactPeso(dashboard.operatingExpenses)}</strong></div><div className="flex items-center justify-between border-t border-slate-200 pt-2"><span className="font-bold text-brand-blue">Project profit</span><strong className={dashboard.projectProfit >= 0 ? 'text-cyan-700' : 'text-red-600'}>{formatCompactPeso(dashboard.projectProfit)}</strong></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3"><p className="text-[9px] font-bold uppercase text-blue-600">Collections</p><p className="mt-1 text-sm font-extrabold text-brand-blue">{formatCompactPeso(dashboard.collectionsReceived)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Cash position</p><p className={`mt-1 text-sm font-extrabold ${dashboard.cashPosition >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCompactPeso(dashboard.cashPosition)}</p></div></div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">Net profit subtracts every non-cancelled expense once. Cash position subtracts only paid expenses.</p>
        </div>
      </article>
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)] animate-[po-card-enter_300ms_90ms_cubic-bezier(0.22,1,0.36,1)_both]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Client metrics</h3><p className="mt-1 text-[10px] text-slate-400">Current client health and growth</p></div><div className="flex shrink-0 items-center gap-1"><DashboardInfo title="Client metrics" source="Clients and Approved Quotations" included="Active client profiles, clients added this month, and clients with multiple approved sales." calculation="Repeat clients have more than one approved quotation; ranking uses order count then total sales." /><button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold text-brand-blue transition hover:bg-blue-50" type="button" onClick={() => navigate('/clients')}>View clients<Icon className="size-3" path="m9 18 6-6-6-6" /></button></div></header>
        <div className="grid grid-cols-2 gap-2 p-4 sm:p-5"><div className="rounded-xl bg-slate-50/75 p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Total</p><p className="mt-1.5 text-xl font-extrabold text-brand-blue">{data.clients.length}</p></div><div className="rounded-xl bg-emerald-50/60 p-3"><p className="text-[9px] font-bold uppercase text-emerald-600">Active</p><p className="mt-1.5 text-xl font-extrabold text-emerald-700">{dashboard.activeClients}</p></div><div className="rounded-xl bg-blue-50/65 p-3"><p className="text-[9px] font-bold uppercase text-sky-600">New this month</p><p className="mt-1.5 text-xl font-extrabold text-sky-700">{dashboard.newClients}</p></div><div className="rounded-xl bg-violet-50/65 p-3"><p className="text-[9px] font-bold uppercase text-violet-600">Repeat</p><p className="mt-1.5 text-xl font-extrabold text-violet-700">{dashboard.repeatClients}</p></div></div>
        <section className="border-t border-slate-100" aria-labelledby="top-repeat-clients-title"><div className="flex items-center justify-between gap-3 bg-slate-50/55 px-5 py-3"><div><h4 className="text-[11px] font-extrabold text-brand-blue" id="top-repeat-clients-title">Top repeat clients</h4><p className="mt-0.5 text-[9px] text-slate-400">Multiple approved sales</p></div><span className="rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">Top {Math.min(dashboard.topClients.length, 3)}</span></div>{dashboard.topClients.length ? <div className="divide-y divide-slate-100">{dashboard.topClients.slice(0, 3).map((client, index) => { const profile = data.clients.find((entry) => entry.id === client.id || entry.name === client.name); return <button className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50/75" type="button" onClick={() => navigate(client.id ? `/clients/${client.id}` : '/clients')} key={`${client.id}-${client.name}`}><span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-blue-50 text-[9px] font-extrabold text-brand-blue">{profile?.photo ? <img className="size-full object-cover" src={profile.photo} alt="" /> : initials(client.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-slate-700">{client.name}</span><span className="mt-0.5 block text-[9px] text-slate-400">{client.orders} approved sales</span></span><span className="shrink-0 text-right"><span className="block text-[11px] font-extrabold text-brand-blue">{formatCompactPeso(client.sales)}</span><span className="mt-0.5 block text-[8px] font-bold text-slate-300">#{index + 1}</span></span></button>})}</div> : <div className="px-5 py-5 text-center text-[10px] font-semibold text-slate-400">Repeat clients will appear after multiple approved sales.</div>}</section>
      </article>
    </section>

    <section className="grid gap-4 lg:grid-cols-2" aria-label="Payments and purchase order alerts">
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon path="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" /></span><div><h3 className="text-sm font-extrabold text-brand-blue">Outstanding payments</h3><p className="mt-0.5 text-[10px] text-slate-400">Client balances that still need collection</p></div></div><div className="flex shrink-0 items-center gap-1"><DashboardInfo title="Outstanding payments" source="Statements of Account" included="Non-draft, non-cancelled SOAs with a remaining balance." calculation="Outstanding totals all open balances. Overdue uses the due date or overdue status; due soon covers the next seven days." /><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/collections')}>Open collections</button></div></header><div className="grid grid-cols-3"><div className="px-4 py-4"><p className="text-[10px] font-bold uppercase text-slate-400">Outstanding</p><p className="mt-2 text-lg font-extrabold text-brand-blue">{formatCompactPeso(dashboard.outstandingBalance)}</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-red-500">Overdue</p><p className="mt-2 text-lg font-extrabold text-red-600">{formatCompactPeso(dashboard.overdueBalance)}</p><p className="mt-1 text-[9px] text-slate-400">{dashboard.overdueStatementCount} statements</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-amber-600">Due in 7 days</p><p className="mt-2 text-lg font-extrabold text-amber-700">{dashboard.dueSoonStatementCount}</p></div></div></article>
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon path="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6" /></span><div><h3 className="text-sm font-extrabold text-brand-blue">Purchase-order alerts</h3><p className="mt-0.5 text-[10px] text-slate-400">Orders that need delivery, payment, or sending</p></div></div><div className="flex shrink-0 items-center gap-1"><DashboardInfo title="Purchase-order alerts" source="Purchase Orders" included="Active POs that are neither cancelled nor delivered." calculation="Counts POs by Waiting for Delivery/Sent, For Payment, and Not Yet Sent status." /><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/purchase-orders')}>View orders</button></div></header><div className="grid grid-cols-3"><div className="px-4 py-4"><p className="text-[10px] font-bold uppercase text-violet-600">Waiting delivery</p><p className="mt-2 text-lg font-extrabold text-violet-700">{dashboard.waitingDeliveryCount}</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-amber-600">For payment</p><p className="mt-2 text-lg font-extrabold text-amber-700">{dashboard.forPaymentCount}</p><p className="mt-1 truncate text-[9px] text-slate-400">{formatCompactPeso(dashboard.forPaymentTotal)}</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-slate-400">Not yet sent</p><p className="mt-2 text-lg font-extrabold text-slate-600">{dashboard.notSentCount}</p></div></div></article>
    </section>

    <section className="grid gap-4 lg:grid-cols-2" aria-label="Dashboard details">
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><div className="flex items-center gap-2"><span className="size-2 rounded-full bg-red-500 ring-4 ring-red-50" /><h3 className="text-sm font-extrabold text-brand-blue">Urgent task reminders</h3></div><p className="mt-1 text-[10px] text-slate-400">High priority, overdue, or due within three days</p></div><div className="flex shrink-0 items-center gap-1"><DashboardInfo title="Urgent task reminders" source="Tasks" included="Incomplete high-priority tasks plus tasks overdue or due within three days." calculation="Shows up to five tasks, prioritizing overdue, assigned-to-you, and high-priority work." /><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/tasks')}>View all</button></div></header>{dashboard.urgentTasks.length ? <div className="divide-y divide-slate-100">{dashboard.urgentTasks.map((task) => { const overdue = Boolean(task.dueDate && task.dueDate < dashboard.ranges.today.end); return <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50/75" type="button" onClick={() => navigate('/tasks')} key={task.id}><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${overdue ? 'bg-red-50 text-red-600' : task.priority === 'High' ? 'bg-orange-50 text-brand-orange' : 'bg-amber-50 text-amber-700'}`}><Icon className="size-3.5" path="M12 8v4l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-700">{task.title}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{task.assignedTo}</span></span><span className={`shrink-0 text-[10px] font-bold ${overdue ? 'text-red-600' : 'text-slate-500'}`}>{overdue ? 'Overdue' : formatDate(task.dueDate)}</span></button>})}</div> : <EmptyState message="No urgent tasks. You are all caught up." />}</article>

      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Recent activity</h3><p className="mt-1 text-[10px] text-slate-400">Latest changes across the system</p></div><div className="flex shrink-0 items-center gap-1"><DashboardInfo title="Recent activity" source="System Logs" included="Actions recorded by Quotations, SOAs, Payments, POs, Clients, and other modules." calculation="Shows the six newest activity entries by timestamp." /><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/logs')}>View log</button></div></header>{data.logs.length ? <div className="divide-y divide-slate-100">{data.logs.slice(0, 6).map((entry) => <div className="flex items-start gap-3 px-5 py-3.5" key={entry.id}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${entry.tone === 'danger' ? 'bg-red-50 text-red-600' : entry.tone === 'warning' ? 'bg-amber-50 text-amber-700' : entry.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-brand-blue'}`}><Icon className="size-3.5" path={entry.action === 'Deleted' ? 'M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6' : entry.action.includes('Payment') ? 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' : 'M12 5v14M5 12h14'} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{entry.entity}</p><p className="mt-1 truncate text-[10px] text-slate-400">{entry.action} · {entry.module}</p></div><span className="shrink-0 text-[9px] font-semibold text-slate-300">{formatActivityTime(entry.timestamp)}</span></div>)}</div> : <EmptyState message="Activity will appear as the team works." />}</article>
    </section>
  </div>
}
