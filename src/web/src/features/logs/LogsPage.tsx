import { useEffect, useMemo, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { TableControls, useTableView } from '../../components/ui/TableControls'
import { usePersistentState } from '../../components/ui/usePersistentState'
import { loadSystemLogs, systemLogsUpdatedEvent, type SystemLogEntry, type SystemLogModule } from '../../services/activityLog'

type ModuleFilter = 'All modules' | SystemLogModule
type ActionFilter = 'All actions' | SystemLogEntry['action']

const moduleOptions: { value: ModuleFilter }[] = ['All modules', 'Tasks', 'Items', 'Expenses', 'Suppliers', 'Clients', 'Quotations', 'Purchase Orders', 'Statements of Account'].map((value) => ({ value: value as ModuleFilter }))
const actionOptions: { value: ActionFilter }[] = ['All actions', 'Created', 'Updated', 'Deleted', 'Status changed', 'Payment recorded', 'Subtask added', 'Subtask updated', 'Subtask removed', 'Added to Expenses', 'Removed from Expenses'].map((value) => ({ value: value as ActionFilter }))

const moduleStyles: Record<SystemLogModule, { icon: string; iconTone: string; badge: string }> = {
  Tasks: { icon: 'M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', iconTone: 'bg-sky-50 text-sky-600', badge: 'border-sky-100 bg-sky-50 text-sky-700' },
  Items: { icon: 'm21 8-9-5-9 5 9 5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5', iconTone: 'bg-orange-50 text-brand-orange', badge: 'border-orange-100 bg-orange-50 text-orange-700' },
  Expenses: { icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', iconTone: 'bg-emerald-50 text-emerald-600', badge: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  Suppliers: { icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h6', iconTone: 'bg-violet-50 text-violet-600', badge: 'border-violet-100 bg-violet-50 text-violet-700' },
  Clients: { icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', iconTone: 'bg-sky-50 text-sky-600', badge: 'border-sky-100 bg-sky-50 text-sky-700' },
  Quotations: { icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h5', iconTone: 'bg-violet-50 text-violet-600', badge: 'border-violet-100 bg-violet-50 text-violet-700' },
  'Purchase Orders': { icon: 'M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6M10 21h.01M18 21h.01', iconTone: 'bg-amber-50 text-amber-600', badge: 'border-amber-100 bg-amber-50 text-amber-700' },
  'Statements of Account': { icon: 'M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2M8 8h8M8 12h8M8 16h5', iconTone: 'bg-cyan-50 text-cyan-700', badge: 'border-cyan-100 bg-cyan-50 text-cyan-700' },
}

const toneDot = { success: 'bg-emerald-500', info: 'bg-sky-500', warning: 'bg-amber-500', danger: 'bg-red-500' }

function formatPeso(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return {
    date: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(date),
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'SY'
}

function escapeCsv(value: string | number | undefined) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function LogsPage() {
  const [logs, setLogs] = useState<SystemLogEntry[]>(loadSystemLogs)
  const [search, setSearch] = usePersistentState('logs.search', '')
  const [moduleFilter, setModuleFilter] = usePersistentState<ModuleFilter>('logs.module', 'All modules')
  const [actionFilter, setActionFilter] = usePersistentState<ActionFilter>('logs.action', 'All actions')
  const [dateFilter, setDateFilter] = usePersistentState('logs.date', '')

  useEffect(() => {
    const refresh = () => setLogs(loadSystemLogs())
    window.addEventListener(systemLogsUpdatedEvent, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(systemLogsUpdatedEvent, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase()
    return logs.filter((entry) => {
      const matchesSearch = !query || [entry.entity, entry.description, entry.actor, entry.module, entry.action, entry.status ?? ''].some((value) => value.toLowerCase().includes(query))
      const matchesModule = moduleFilter === 'All modules' || entry.module === moduleFilter
      const matchesAction = actionFilter === 'All actions' || entry.action === actionFilter
      const matchesDate = !dateFilter || entry.timestamp.slice(0, 10) === dateFilter
      return matchesSearch && matchesModule && matchesAction && matchesDate
    })
  }, [actionFilter, dateFilter, logs, moduleFilter, search])

  const logSortOptions = [
    { value: 'newest', label: 'Newest first', getValue: (entry: SystemLogEntry) => entry.timestamp, direction: 'desc' as const },
    { value: 'oldest', label: 'Oldest first', getValue: (entry: SystemLogEntry) => entry.timestamp, direction: 'asc' as const },
    { value: 'module', label: 'Module A-Z', getValue: (entry: SystemLogEntry) => entry.module, direction: 'asc' as const },
    { value: 'user', label: 'User A-Z', getValue: (entry: SystemLogEntry) => entry.actor, direction: 'asc' as const },
  ]
  const logTable = useTableView({ rows: filteredLogs, storageKey: 'logs.table', sortOptions: logSortOptions, pageSizeOptions: [15, 30, 60] })

  const today = new Date().toISOString().slice(0, 10)
  const todayCount = logs.filter((entry) => entry.timestamp.slice(0, 10) === today).length
  const financialVolume = logs.filter((entry) => entry.module === 'Expenses' && entry.action === 'Created').reduce((sum, entry) => sum + (entry.amount ?? 0), 0)
  const actorCount = new Set(logs.map((entry) => entry.actor)).size
  const activeFilterCount = Number(moduleFilter !== 'All modules') + Number(actionFilter !== 'All actions') + Number(Boolean(dateFilter))

  function clearFilters() {
    setSearch('')
    setModuleFilter('All modules')
    setActionFilter('All actions')
    setDateFilter('')
  }

  function exportLogs() {
    const header = ['Timestamp', 'Module', 'Action', 'Entity', 'Description', 'Actor', 'Amount', 'Status']
    const rows = filteredLogs.map((entry) => [entry.timestamp, entry.module, entry.action, entry.entity, entry.description, entry.actor, entry.amount, entry.status])
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `adiel-system-logs-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
      <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center" aria-label="Log summary">
        <div>
          <div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">System activity</p></div>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Transaction logs</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">See changes made to tasks, expenses, suppliers, and other records.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            { label: 'Total events', value: logs.length.toLocaleString(), dot: 'bg-brand-blue', tone: 'text-brand-blue' },
            { label: 'Today', value: todayCount.toLocaleString(), dot: 'bg-brand-orange', tone: 'text-brand-orange' },
            { label: 'Expense value', value: formatPeso(financialVolume), dot: 'bg-emerald-500', tone: 'text-emerald-700' },
            { label: 'Users', value: actorCount.toLocaleString(), dot: 'bg-violet-500', tone: 'text-violet-700' },
          ].map((stat) => (
            <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-3 py-3.5 shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] ring-1 ring-inset ring-white/70 transition-transform duration-200 hover:-translate-y-0.5 sm:min-w-32 sm:px-4 xl:min-w-36" key={stat.label}>
              <div className="flex items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${stat.dot} ring-4 ring-white`} /><p className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{stat.label}</p></div>
              <p className={`mt-2 truncate text-xl font-bold tracking-[-0.04em] ${stat.tone}`} title={stat.value}>{stat.value}</p>
            </article>
          ))}
        </div>
      </SummarySurface>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-28px_rgba(0,20,76,0.3)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_11rem_11rem_10rem_auto]">
            <label className="relative block"><span className="sr-only">Search logs</span><svg className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.05]" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search activity..." /></label>
            <AnimatedDropdown value={moduleFilter} options={moduleOptions} onChange={setModuleFilter} ariaLabel="Filter by module" />
            <AnimatedDropdown value={actionFilter} options={actionOptions} onChange={setActionFilter} ariaLabel="Filter by action" />
            <AnimatedDatePicker value={dateFilter} onChange={setDateFilter} ariaLabel="Filter by date" />
            <div className="flex items-center gap-2">
              {activeFilterCount || search ? <button className="h-10 rounded-xl px-3 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-brand-orange" type="button" onClick={clearFilters}>Clear</button> : null}
              <button className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 lg:flex-none" type="button" onClick={exportLogs} disabled={!filteredLogs.length}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>Export</button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="text-sm font-bold text-brand-blue">Activity ledger</p><p className="mt-0.5 text-[11px] text-slate-400">Newest transactions appear first</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{filteredLogs.length} {filteredLogs.length === 1 ? 'event' : 'events'}</span></div>
        </div>

        <TableControls tableId="logs-table" storageKey="logs.table" columns={[{ index: 1, label: 'Transaction', required: true }, { index: 2, label: 'Module' }, { index: 3, label: 'Action' }, { index: 4, label: 'User' }, { index: 5, label: 'Date and time' }, { index: 6, label: 'Value' }]} sortKey={logTable.sortKey} sortOptions={logSortOptions} onSortChange={logTable.setSortKey} page={logTable.page} pageCount={logTable.pageCount} pageSize={logTable.pageSize} pageSizeOptions={[15, 30, 60]} onPageChange={logTable.setPage} onPageSizeChange={logTable.setPageSize} total={logTable.total} />

        {filteredLogs.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed text-left">
                <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="w-[29%] px-5 py-3.5">Transaction</th><th className="w-[14%] px-4 py-3.5">Module</th><th className="w-[15%] px-4 py-3.5">Action</th><th className="w-[16%] px-4 py-3.5">User</th><th className="w-[14%] px-4 py-3.5">Date &amp; time</th><th className="w-[12%] px-4 py-3.5 text-right">Value</th></tr></thead>
                <tbody>
                  {logTable.pageRows.map((entry) => {
                    const style = moduleStyles[entry.module]
                    const timestamp = formatTimestamp(entry.timestamp)
                    return (
                      <tr className="group border-b border-slate-100 transition-colors hover:bg-[#fbfcfe]" key={entry.id}>
                        <td className="px-5 py-4"><div className="flex min-w-0 items-start gap-3"><span className={`relative grid size-10 shrink-0 place-items-center rounded-xl ${style.iconTone}`}><svg className="size-[1.1rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={style.icon} /></svg><span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${toneDot[entry.tone]}`} /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-brand-blue" title={entry.entity}>{entry.entity}</p><p className="mt-1 truncate text-[11px] leading-5 text-slate-400" title={entry.description}>{entry.description}</p><p className="mt-0.5 font-mono text-[9px] text-slate-300">#{entry.id.slice(0, 8).toUpperCase()}</p></div></div></td>
                        <td className="px-4 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${style.badge}`}>{entry.module}</span></td>
                        <td className="px-4 py-4"><p className="text-xs font-bold text-slate-600">{entry.action}</p>{entry.status ? <p className="mt-1 text-[10px] font-medium text-slate-400">{entry.status}</p> : null}</td>
                        <td className="px-4 py-4"><div className="flex items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[linear-gradient(145deg,#092968,#00113f)] text-[9px] font-bold text-white">{initials(entry.actor)}</span><span className="truncate text-xs font-semibold text-slate-600" title={entry.actor}>{entry.actor}</span></div></td>
                        <td className="px-4 py-4"><p className="text-xs font-semibold text-slate-600">{timestamp.date}</p><p className="mt-1 text-[10px] font-medium text-slate-400">{timestamp.time}</p></td>
                        <td className="px-4 py-4 text-right">{entry.amount !== undefined ? <span className="text-xs font-extrabold text-emerald-700">{formatPeso(entry.amount)}</span> : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" /></svg></span><h3 className="mt-4 text-sm font-bold text-brand-blue">No matching transactions</h3><p className="mt-1 text-xs text-slate-400">Adjust the filters or start working in another module.</p>{activeFilterCount || search ? <button className="mt-4 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white" type="button" onClick={clearFilters}>Clear filters</button> : null}</div></div>
        )}
      </section>
    </div>
  )
}
