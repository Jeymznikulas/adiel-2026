import { useEffect, useMemo, useState } from 'react'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { collectionRows } from '../statement-of-account/latePayment'
import { loadStatements } from '../statement-of-account/StatementOfAccountPage'
import type { StatementOfAccount } from '../statement-of-account/statementOfAccountTypes'
import { isActiveRecord } from '../../services/recordLifecycle'

const filters = ['All open', 'Overdue', 'Grace period', 'Due today', 'Upcoming'].map((value) => ({ value }))

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new Event('adiel:navigate'))
}

function statusTone(status: string) {
  if (status === 'Overdue') return 'border-red-100 bg-red-50 text-red-600'
  if (status === 'Grace period' || status === 'Due today') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (status === 'Partially paid') return 'border-violet-100 bg-violet-50 text-violet-700'
  return 'border-sky-100 bg-sky-50 text-sky-700'
}

export function CollectionsPage() {
  const [statements, setStatements] = useState<StatementOfAccount[]>(loadStatements)
  const [filter, setFilter] = useState('All open')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const refresh = () => setStatements(loadStatements())
    window.addEventListener('storage', refresh)
    window.addEventListener('adiel:statements-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('adiel:statements-changed', refresh)
    }
  }, [])

  const rows = useMemo(() => collectionRows(statements.filter(isActiveRecord)), [statements])
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => (filter === 'All open' || row.schedule.status === filter) && (!query || `${row.statement.clientName} ${row.statement.soaNumber} ${row.schedule.label}`.toLowerCase().includes(query)))
  }, [filter, rows, search])
  const today = new Date().toISOString().slice(0, 10)
  const dueSoonEnd = new Date()
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 7)
  const dueSoonDate = dueSoonEnd.toISOString().slice(0, 10)
  const overdueRows = rows.filter((row) => row.schedule.status === 'Overdue')
  const overdueClients = new Set(overdueRows.map((row) => row.statement.clientId)).size
  const dueSoon = rows.filter((row) => row.schedule.dueDate >= today && row.schedule.dueDate <= dueSoonDate).length
  const suggestedCharges = rows.reduce((total, row) => total + row.suggestedLateCharge, 0)

  return <div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-96 bg-[radial-gradient(circle_at_100%_0%,rgba(239,68,68,0.1),transparent_62%)]" aria-hidden="true" />
      <div className="relative"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">Payments and follow-up</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-brand-blue">Collections</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">One worklist generated from SOA schedules. Review overdue accounts, apply editable charges, and record payments without duplicate entries.</p></div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Overdue balance" value={formatPeso(overdueRows.reduce((total, row) => total + row.totalDue, 0))} tone="red" /><Metric label="Clients overdue" value={String(overdueClients)} tone="orange" /><Metric label="Due in 7 days" value={String(dueSoon)} tone="blue" /><Metric label="Charges to review" value={formatPeso(suggestedCharges)} tone="violet" /></div>
    </SummarySurface>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-sm font-extrabold text-brand-blue">Open collection schedule</h3><p className="mt-1 text-[10px] text-slate-400">Sorted by oldest due date first</p></div><div className="flex flex-col gap-2 sm:flex-row"><input className="h-10 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-xs font-medium text-brand-blue outline-none focus:border-brand-blue/30 sm:w-64" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client or SOA..." /><AnimatedDropdown className="sm:min-w-40" size="filter" value={filter} options={filters} onChange={setFilter} ariaLabel="Filter collection status" /></div></header>
      {visibleRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-5 py-3.5">Client / SOA</th><th className="px-5 py-3.5">Schedule</th><th className="px-5 py-3.5">Due date</th><th className="px-5 py-3.5 text-right">Principal due</th><th className="px-5 py-3.5 text-right">Late charge</th><th className="px-5 py-3.5 text-right">Total due</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead><tbody>{visibleRows.map((row) => <tr className="border-t border-slate-100 transition hover:bg-blue-50/25" key={row.id}><td className="px-5 py-4"><p className="text-xs font-extrabold text-slate-700">{row.statement.clientName}</p><p className="mt-1 font-mono text-[9px] font-bold text-brand-blue">{row.statement.soaNumber}</p></td><td className="px-5 py-4 text-xs font-semibold text-slate-500">{row.schedule.label}</td><td className="px-5 py-4"><p className="text-xs font-semibold text-slate-600">{formatDate(row.schedule.dueDate)}</p>{row.schedule.daysLate ? <p className="mt-1 text-[9px] font-bold text-red-500">{row.schedule.daysLate} days late</p> : null}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-amber-700">{formatPeso(row.schedule.balance)}</td><td className="px-5 py-4 text-right"><p className="text-xs font-extrabold tabular-nums text-red-600">{row.lateCharge ? formatPeso(row.lateCharge.balance) : '—'}</p>{row.suggestedLateCharge > 0 ? <p className="mt-1 text-[9px] font-bold text-violet-600">Suggested {formatPeso(row.suggestedLateCharge)}</p> : null}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(row.totalDue)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-[9px] font-bold ${statusTone(row.schedule.status)}`}>{row.schedule.status}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2">{row.schedule.status === 'Overdue' || row.lateCharge ? <button className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[9px] font-bold text-red-600 hover:bg-red-50" type="button" onClick={() => navigate(`/statement-of-account/${row.statement.id}?charge=${encodeURIComponent(row.schedule.id)}`)}>{row.lateCharge ? 'Edit charge' : 'Review charge'}</button> : null}<button className="h-8 rounded-lg bg-brand-blue px-3 text-[9px] font-bold text-white hover:bg-blue-900" type="button" onClick={() => navigate(`/statement-of-account/${row.statement.id}?pay=1`)}>Record payment</button></div></td></tr>)}</tbody></table></div> : <div className="grid min-h-64 place-items-center p-8 text-center"><div><p className="text-sm font-extrabold text-brand-blue">No matching collections</p><p className="mt-2 text-xs text-slate-400">Open SOA schedule balances will appear here automatically.</p></div></div>}
    </section>
  </div>
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'red' | 'orange' | 'blue' | 'violet' }) {
  const tones = { red: 'border-red-100 bg-red-50/55 text-red-600', orange: 'border-orange-100 bg-orange-50/55 text-orange-700', blue: 'border-blue-100 bg-blue-50/55 text-brand-blue', violet: 'border-violet-100 bg-violet-50/55 text-violet-700' }
  return <article className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">{label}</p><p className="mt-2 text-lg font-extrabold tracking-[-0.03em]">{value}</p></article>
}
