import { useEffect, useMemo, useState } from 'react'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { loadSystemLogs, systemLogsUpdatedEvent, type SystemLogEntry } from '../../services/activityLog'

type DashboardQuotation = {
  id: string
  dateCreated: string
  clientId: string
  clientName: string
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
  expenses: DashboardExpense[]
  clients: DashboardClient[]
  tasks: DashboardTask[]
  statements: DashboardStatement[]
  purchaseOrders: DashboardPurchaseOrder[]
  logs: SystemLogEntry[]
}

const emptyData: DashboardData = { quotations: [], expenses: [], clients: [], tasks: [], statements: [], purchaseOrders: [], logs: [] }

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function readArray(storageKey: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadDashboardData(): DashboardData {
  const quotations = readArray('adiel.quotations').flatMap((value): DashboardQuotation[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'string' || entry.status !== 'Approved') return []
    return [{
      id: entry.id,
      dateCreated: typeof entry.dateCreated === 'string' ? entry.dateCreated.slice(0, 10) : '',
      clientId: typeof entry.clientId === 'string' ? entry.clientId : '',
      clientName: typeof entry.clientName === 'string' ? entry.clientName : 'Unknown client',
      subtotalAmount: Number(entry.subtotalAmount) || 0,
      totalAmount: Number(entry.totalAmount) || 0,
      estimatedProfit: Number(entry.estimatedProfit) || 0,
      status: 'Approved',
    }]
  })

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
    return [{ id: entry.id, soaNumber: entry.soaNumber, clientName: typeof entry.clientName === 'string' ? entry.clientName : 'Unknown client', dueDate: typeof entry.dueDate === 'string' ? entry.dueDate.slice(0, 10) : '', balance: Number(entry.balance) || 0, status: typeof entry.status === 'string' ? entry.status : 'Draft' }]
  })

  const purchaseOrders = readArray('adiel.purchase-orders').flatMap((value): DashboardPurchaseOrder[] => {
    if (typeof value !== 'object' || value === null) return []
    const entry = value as Record<string, unknown>
    if (typeof entry.id !== 'string' || typeof entry.poNumber !== 'string') return []
    return [{ id: entry.id, poNumber: entry.poNumber, supplierName: typeof entry.supplierName === 'string' ? entry.supplierName : 'Unknown supplier', totalAmount: Number(entry.totalAmount) || 0, status: typeof entry.status === 'string' ? entry.status : 'Not yet sent' }]
  })

  return { quotations, expenses, clients, tasks, statements, purchaseOrders, logs: loadSystemLogs() }
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

function PeriodCard({ title, detail, icon, tone, values, monthChange, onOpen }: {
  title: string
  detail: string
  icon: string
  tone: 'blue' | 'orange'
  values: { today: number; week: number; month: number }
  monthChange: number
  onOpen: () => void
}) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-brand-blue' : 'bg-orange-50 text-brand-orange'
  return <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)] animate-[po-card-enter_300ms_cubic-bezier(0.22,1,0.36,1)_both]">
    <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass}`}><Icon path={icon} /></span><div><h3 className="text-sm font-extrabold text-brand-blue">{title}</h3><p className="mt-0.5 text-[10px] text-slate-400">{detail}</p></div></div>
      <button className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onOpen} aria-label={`Open ${title.toLowerCase()}`}><Icon className="size-3.5" path="m9 18 6-6-6-6" /></button>
    </header>
    <div className="grid grid-cols-3 border-t border-slate-100">
      {([['Today', values.today], ['This week', values.week], ['This month', values.month]] as const).map(([label, value], index) => <div className={`min-w-0 px-4 py-4 ${index ? 'border-l border-slate-100' : ''}`} key={label}><p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</p><p className="mt-2 truncate text-base font-extrabold tracking-[-0.03em] text-brand-blue" title={formatPeso(value)}>{formatCompactPeso(value)}</p>{index === 2 ? <p className={`mt-1 text-[9px] font-bold ${monthChange > 0 ? tone === 'orange' ? 'text-amber-600' : 'text-emerald-600' : monthChange < 0 ? tone === 'orange' ? 'text-emerald-600' : 'text-red-500' : 'text-slate-400'}`}>{monthChange > 0 ? '+' : ''}{monthChange.toFixed(1)}% vs last month</p> : null}</div>)}
    </div>
  </article>
}

type TrendPoint = { key: string; label: string; sales: number; expenses: number; profit: number }

function BusinessTrendChart({ data }: { data: TrendPoint[] }) {
  const width = 720
  const top = 18
  const bottom = 188
  const chartHeight = bottom - top
  const left = 18
  const chartWidth = width - left * 2
  const maximum = Math.max(1, ...data.flatMap((point) => [point.sales, point.expenses, point.profit]))
  const minimum = Math.min(0, ...data.map((point) => point.profit))
  const range = Math.max(1, maximum - minimum)
  const y = (value: number) => top + ((maximum - value) / range) * chartHeight
  const zeroY = y(0)
  const groupWidth = chartWidth / Math.max(1, data.length)
  const profitPoints = data.map((point, index) => `${left + groupWidth * (index + 0.5)},${y(point.profit)}`).join(' ')
  const hasData = data.some((point) => point.sales || point.expenses || point.profit)

  if (!hasData) return <div className="grid min-h-52 place-items-center rounded-xl bg-slate-50/55 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-white text-slate-300 shadow-sm"><Icon path="M3 3v18h18M7 16l4-5 3 3 6-8" /></span><p className="mt-3 text-xs font-semibold text-slate-400">The chart will appear when sales or expenses are recorded.</p></div></div>

  return <div className="overflow-x-auto pb-1">
    <svg className="h-auto min-w-[620px] animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]" viewBox={`0 0 ${width} 225`} role="img" aria-label={`Sales, expenses, and gross profit for the last ${data.length} months`}>
      {[0, 1, 2, 3, 4].map((line) => <line x1={left} x2={width - left} y1={top + (chartHeight / 4) * line} y2={top + (chartHeight / 4) * line} stroke="#e8edf4" strokeWidth="1" strokeDasharray="4 6" key={line} />)}
      <line x1={left} x2={width - left} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeWidth="1" />
      {data.map((point, index) => {
        const center = left + groupWidth * (index + 0.5)
        const salesY = y(point.sales)
        const expensesY = y(point.expenses)
        return <g key={point.key}>
          <rect x={center - 20} y={Math.min(salesY, zeroY)} width="15" height={Math.max(1, Math.abs(zeroY - salesY))} rx="4" fill="#0b397f"><title>{`${point.label} sales: ${formatPeso(point.sales)}`}</title></rect>
          <rect x={center + 5} y={Math.min(expensesY, zeroY)} width="15" height={Math.max(1, Math.abs(zeroY - expensesY))} rx="4" fill="#fd7a3f"><title>{`${point.label} expenses: ${formatPeso(point.expenses)}`}</title></rect>
          <text x={center} y="214" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">{point.label}</text>
        </g>
      })}
      <polyline points={profitPoints} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((point, index) => {
        const center = left + groupWidth * (index + 0.5)
        return <circle cx={center} cy={y(point.profit)} r="4" fill="white" stroke={point.profit >= 0 ? '#10b981' : '#dc2626'} strokeWidth="2.5" key={`profit-${point.key}`}><title>{`${point.label} gross profit: ${formatPeso(point.profit)}`}</title></circle>
      })}
    </svg>
  </div>
}

function EmptyState({ message }: { message: string }) {
  return <div className="grid min-h-36 place-items-center px-5 py-7 text-center"><div><span className="mx-auto block size-1.5 rounded-full bg-slate-300" /><p className="mt-3 text-xs font-semibold text-slate-400">{message}</p></div></div>
}

export function DashboardPage({ username }: { username: string }) {
  const [data, setData] = useState<DashboardData>(emptyData)
  const [trendMonths, setTrendMonths] = useState<6 | 12>(6)

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
    const monthQuotationIds = new Set(monthQuotations.map((entry) => entry.id))
    const actualRevenue = monthQuotations.reduce((total, entry) => total + entry.subtotalAmount, 0)
    const recordedProjectCosts = data.expenses.filter((entry) => entry.quotationId && monthQuotationIds.has(entry.quotationId)).reduce((total, entry) => total + entry.amount, 0)
    const actualProfit = actualRevenue - recordedProjectCosts
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
        profit: sumPeriod(data.quotations, (entry) => entry.dateCreated, (entry) => entry.estimatedProfit, start, end),
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
    return {
      ranges, sales, expenses, grossProfit, actualProfit, actualRevenue, recordedProjectCosts, margin, trend, topClients, urgentTasks,
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
        <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-3.5 sm:min-w-32 sm:px-4"><p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">Month sales</p><p className="mt-2 truncate text-lg font-extrabold text-brand-blue" title={formatPeso(dashboard.sales.month)}>{formatCompactPeso(dashboard.sales.month)}</p></article>
        <article className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-3.5 sm:min-w-32 sm:px-4"><p className="text-[10px] font-bold uppercase tracking-[0.07em] text-emerald-600">Est. profit</p><p className="mt-2 truncate text-lg font-extrabold text-emerald-700" title={formatPeso(dashboard.grossProfit)}>{formatCompactPeso(dashboard.grossProfit)}</p></article>
        <article className="min-w-0 rounded-2xl border border-red-100 bg-red-50/55 px-3 py-3.5 sm:min-w-32 sm:px-4"><p className="text-[10px] font-bold uppercase tracking-[0.07em] text-red-500">Urgent tasks</p><p className="mt-2 text-lg font-extrabold text-red-600">{dashboard.urgentTaskCount}</p></article>
      </div>
    </SummarySurface>

    <section className="flex flex-col gap-3 rounded-[1.25rem] border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_10px_28px_-25px_rgba(0,20,76,0.3)] sm:flex-row sm:items-center" aria-label="Quick actions"><div className="shrink-0"><p className="text-xs font-extrabold text-brand-blue">Quick actions</p><p className="mt-0.5 text-[10px] text-slate-400">Start common work</p></div><div className="flex flex-1 flex-wrap gap-2 sm:justify-end">{[
      { label: 'New quotation', path: '/quotations?new=1', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6' },
      { label: 'New purchase order', path: '/purchase-orders?new=1', icon: 'M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6' },
      { label: 'Add expense', path: '/expenses?new=1', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5' },
      { label: 'Add task', path: '/tasks?new=1', icon: 'M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5' },
    ].map((action) => <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:border-brand-blue/15 hover:bg-blue-50/45 sm:flex-none" type="button" onClick={() => navigate(action.path)} key={action.label}><Icon className="size-3.5 text-slate-400" path={action.icon} />{action.label}</button>)}</div></section>

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Financial overview">
      <PeriodCard title="Sales overview" detail="Approved quotations" icon="M3 3v18h18M7 16l4-5 3 3 6-8" tone="blue" values={dashboard.sales} monthChange={dashboard.salesChange} onOpen={() => navigate('/sales-tracker')} />
      <PeriodCard title="Expenses" detail="All non-cancelled expenses" icon="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" tone="orange" values={dashboard.expenses} monthChange={dashboard.expenseChange} onOpen={() => navigate('/expenses')} />
    </section>

    <section className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]" aria-labelledby="business-trend-title">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="text-sm font-extrabold text-brand-blue" id="business-trend-title">Business trend</h3><p className="mt-1 text-[10px] text-slate-400">Sales, expenses, and estimated gross profit over time</p></div>
        <div className="flex flex-wrap items-center gap-4"><div className="flex items-center gap-4 text-[10px] font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#0b397f]" />Sales</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#fd7a3f]" />Expenses</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border-2 border-emerald-500 bg-white" />Est. profit</span></div><div className="inline-flex rounded-lg bg-slate-100 p-0.5">{([6, 12] as const).map((months) => <button className={`rounded-md px-2.5 py-1.5 text-[9px] font-bold transition ${trendMonths === months ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-400 hover:text-brand-blue'}`} type="button" onClick={() => setTrendMonths(months)} aria-pressed={trendMonths === months} key={months}>{months}M</button>)}</div></div>
      </header>
      <div className="px-4 pb-3 pt-4 sm:px-5"><BusinessTrendChart data={dashboard.trend} /></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]" aria-label="Profit and client metrics">
      <article className="rounded-[1.4rem] border border-slate-200/80 bg-white p-5 shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)] animate-[po-card-enter_300ms_50ms_cubic-bezier(0.22,1,0.36,1)_both]"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">This month</p><h3 className="mt-1 text-sm font-extrabold text-brand-blue">Profit overview</h3></div><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon path="M4 18 10 12l4 4 6-8M20 8h-5M20 8v5" /></span></div><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-[10px] font-bold uppercase text-slate-400">Estimated</p><p className={`mt-2 text-xl font-extrabold tracking-[-0.04em] ${dashboard.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCompactPeso(dashboard.grossProfit)}</p></div><div className="border-l border-slate-100 pl-3"><p className="text-[10px] font-bold uppercase text-cyan-600">Actual</p><p className={`mt-2 text-xl font-extrabold tracking-[-0.04em] ${dashboard.actualProfit >= 0 ? 'text-cyan-700' : 'text-red-600'}`}>{formatCompactPeso(dashboard.actualProfit)}</p></div></div><div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50/75 px-3.5 py-3"><span className="text-xs font-semibold text-slate-500">Recorded project costs</span><strong className="text-sm text-violet-700">{formatCompactPeso(dashboard.recordedProjectCosts)}</strong></div><p className="mt-3 text-[10px] leading-4 text-slate-400">Actual profit uses expenses linked to this month’s approved quotations.</p></article>
      <article className="rounded-[1.4rem] border border-slate-200/80 bg-white p-5 shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)] animate-[po-card-enter_300ms_90ms_cubic-bezier(0.22,1,0.36,1)_both]"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Client metrics</h3><p className="mt-1 text-[10px] text-slate-400">Current client health and growth</p></div><button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold text-brand-blue transition hover:bg-blue-50" type="button" onClick={() => navigate('/clients')}>View clients<Icon className="size-3" path="m9 18 6-6-6-6" /></button></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-slate-50/75 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Total</p><p className="mt-2 text-xl font-extrabold text-brand-blue">{data.clients.length}</p></div><div className="rounded-xl bg-emerald-50/60 p-3"><p className="text-[10px] font-bold uppercase text-emerald-600">Active</p><p className="mt-2 text-xl font-extrabold text-emerald-700">{dashboard.activeClients}</p></div><div className="rounded-xl bg-blue-50/65 p-3"><p className="text-[10px] font-bold uppercase text-sky-600">New this month</p><p className="mt-2 text-xl font-extrabold text-sky-700">{dashboard.newClients}</p></div><div className="rounded-xl bg-violet-50/65 p-3"><p className="text-[10px] font-bold uppercase text-violet-600">Repeat</p><p className="mt-2 text-xl font-extrabold text-violet-700">{dashboard.repeatClients}</p></div></div></article>
    </section>

    <section className="grid gap-4 lg:grid-cols-2" aria-label="Payments and purchase order alerts">
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon path="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" /></span><div><h3 className="text-sm font-extrabold text-brand-blue">Outstanding payments</h3><p className="mt-0.5 text-[10px] text-slate-400">Client balances that still need collection</p></div></div><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/statement-of-account')}>View statements</button></header><div className="grid grid-cols-3"><div className="px-4 py-4"><p className="text-[10px] font-bold uppercase text-slate-400">Outstanding</p><p className="mt-2 text-lg font-extrabold text-brand-blue">{formatCompactPeso(dashboard.outstandingBalance)}</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-red-500">Overdue</p><p className="mt-2 text-lg font-extrabold text-red-600">{formatCompactPeso(dashboard.overdueBalance)}</p><p className="mt-1 text-[9px] text-slate-400">{dashboard.overdueStatementCount} statements</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-amber-600">Due in 7 days</p><p className="mt-2 text-lg font-extrabold text-amber-700">{dashboard.dueSoonStatementCount}</p></div></div></article>
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon path="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6" /></span><div><h3 className="text-sm font-extrabold text-brand-blue">Purchase-order alerts</h3><p className="mt-0.5 text-[10px] text-slate-400">Orders that need delivery, payment, or sending</p></div></div><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/purchase-orders')}>View orders</button></header><div className="grid grid-cols-3"><div className="px-4 py-4"><p className="text-[10px] font-bold uppercase text-violet-600">Waiting delivery</p><p className="mt-2 text-lg font-extrabold text-violet-700">{dashboard.waitingDeliveryCount}</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-amber-600">For payment</p><p className="mt-2 text-lg font-extrabold text-amber-700">{dashboard.forPaymentCount}</p><p className="mt-1 truncate text-[9px] text-slate-400">{formatCompactPeso(dashboard.forPaymentTotal)}</p></div><div className="border-l border-slate-100 px-4 py-4"><p className="text-[10px] font-bold uppercase text-slate-400">Not yet sent</p><p className="mt-2 text-lg font-extrabold text-slate-600">{dashboard.notSentCount}</p></div></div></article>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr_1.15fr]" aria-label="Dashboard details">
      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><div className="flex items-center gap-2"><span className="size-2 rounded-full bg-red-500 ring-4 ring-red-50" /><h3 className="text-sm font-extrabold text-brand-blue">Urgent task reminders</h3></div><p className="mt-1 text-[10px] text-slate-400">High priority, overdue, or due within three days</p></div><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/tasks')}>View all</button></header>{dashboard.urgentTasks.length ? <div className="divide-y divide-slate-100">{dashboard.urgentTasks.map((task) => { const overdue = Boolean(task.dueDate && task.dueDate < dashboard.ranges.today.end); return <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50/75" type="button" onClick={() => navigate('/tasks')} key={task.id}><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${overdue ? 'bg-red-50 text-red-600' : task.priority === 'High' ? 'bg-orange-50 text-brand-orange' : 'bg-amber-50 text-amber-700'}`}><Icon className="size-3.5" path="M12 8v4l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-700">{task.title}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{task.assignedTo}</span></span><span className={`shrink-0 text-[10px] font-bold ${overdue ? 'text-red-600' : 'text-slate-500'}`}>{overdue ? 'Overdue' : formatDate(task.dueDate)}</span></button>})}</div> : <EmptyState message="No urgent tasks. You are all caught up." />}</article>

      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Top repeat clients</h3><p className="mt-1 text-[10px] text-slate-400">Clients with more than one approved sale</p></div><span className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">{dashboard.topClients.length}</span></header>{dashboard.topClients.length ? <div className="divide-y divide-slate-100">{dashboard.topClients.map((client, index) => { const profile = data.clients.find((entry) => entry.id === client.id || entry.name === client.name); return <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50/75" type="button" onClick={() => navigate(client.id ? `/clients/${client.id}` : '/clients')} key={`${client.id}-${client.name}`}><span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-blue-50 text-[10px] font-extrabold text-brand-blue">{profile?.photo ? <img className="size-full object-cover" src={profile.photo} alt="" /> : initials(client.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-700">{client.name}</span><span className="mt-1 block text-[10px] text-slate-400">{client.orders} approved sales</span></span><span className="text-right"><span className="block text-xs font-extrabold text-brand-blue">{formatCompactPeso(client.sales)}</span><span className="mt-1 block text-[9px] font-bold text-slate-300">#{index + 1}</span></span></button>})}</div> : <EmptyState message="Repeat clients will appear after multiple approved sales." />}</article>

      <article className="overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_12px_34px_-28px_rgba(0,20,76,0.34)]"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Recent activity</h3><p className="mt-1 text-[10px] text-slate-400">Latest changes across the system</p></div><button className="text-[10px] font-bold text-brand-blue hover:text-brand-orange" type="button" onClick={() => navigate('/logs')}>View log</button></header>{data.logs.length ? <div className="divide-y divide-slate-100">{data.logs.slice(0, 6).map((entry) => <div className="flex items-start gap-3 px-5 py-3.5" key={entry.id}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${entry.tone === 'danger' ? 'bg-red-50 text-red-600' : entry.tone === 'warning' ? 'bg-amber-50 text-amber-700' : entry.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-brand-blue'}`}><Icon className="size-3.5" path={entry.action === 'Deleted' ? 'M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6' : entry.action.includes('Payment') ? 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' : 'M12 5v14M5 12h14'} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{entry.entity}</p><p className="mt-1 truncate text-[10px] text-slate-400">{entry.action} · {entry.module}</p></div><span className="shrink-0 text-[9px] font-semibold text-slate-300">{formatActivityTime(entry.timestamp)}</span></div>)}</div> : <EmptyState message="Activity will appear as the team works." />}</article>
    </section>
  </div>
}
