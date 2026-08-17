import { useEffect, useMemo, useState } from 'react'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { appendSystemLog, type SystemLogModule } from '../../services/activityLog'
import { isArchivedRecord, isSoftDeletedRecord, lifecycleChangedEvent, notifyLifecycleChanged, withRestored, withSoftDeleted, type LifecycleRecord } from '../../services/recordLifecycle'

type Source = { key: string; module: SystemLogModule; titleKey: string; detailKey: string }
type Row = { source: Source; record: LifecycleRecord & Record<string, unknown> }

const sources: Source[] = [
  { key: 'adiel.clients', module: 'Clients', titleKey: 'name', detailKey: 'industry' },
  { key: 'adiel.suppliers', module: 'Suppliers', titleKey: 'name', detailKey: 'type' },
  { key: 'adiel.items', module: 'Items', titleKey: 'name', detailKey: 'productCode' },
  { key: 'adiel.quotations', module: 'Quotations', titleKey: 'quotationNumber', detailKey: 'clientName' },
  { key: 'adiel.purchase-orders', module: 'Purchase Orders', titleKey: 'poNumber', detailKey: 'supplierName' },
  { key: 'adiel.statements-of-account', module: 'Statements of Account', titleKey: 'soaNumber', detailKey: 'clientName' },
  { key: 'adiel.expenses', module: 'Expenses', titleKey: 'payee', detailKey: 'description' },
  { key: 'adiel.tasks', module: 'Tasks', titleKey: 'title', detailKey: 'assignedTo' },
]

function textValue(value: unknown, fallback = '') { return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback }
function hasId(value: unknown): value is Row['record'] { return Boolean(value) && typeof value === 'object' && 'id' in value! && (typeof (value as { id?: unknown }).id === 'string' || typeof (value as { id?: unknown }).id === 'number') }
function rowTitle(row: Row) { return textValue(row.record[row.source.titleKey], 'Untitled record') }
function rowDetail(row: Row) { return textValue(row.record[row.source.detailKey], '—') }
function loadRows() {
  return sources.flatMap((source): Row[] => {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(source.key) ?? '[]')
      return Array.isArray(value) ? (value as unknown[]).flatMap((record): Row[] => hasId(record) ? [{ source, record }] : []) : []
    } catch { return [] }
  })
}
function updateRow(row: Row, update: (record: Row['record']) => Row['record']) {
  const value: unknown = JSON.parse(window.localStorage.getItem(row.source.key) ?? '[]')
  if (!Array.isArray(value)) return
  window.localStorage.setItem(row.source.key, JSON.stringify((value as unknown[]).map((record) => hasId(record) && record.id === row.record.id ? update(record) : record)))
  notifyLifecycleChanged()
}
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded' }

export function ArchivePage({ currentUsername }: { currentUsername: string }) {
  const [rows, setRows] = useState(loadRows)
  const [showDeleted, setShowDeleted] = useState(false)
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState<Row | null>(null)
  const [toast, setToast] = useState('')
  useEffect(() => { const refresh = () => setRows(loadRows()); window.addEventListener(lifecycleChangedEvent, refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener(lifecycleChangedEvent, refresh); window.removeEventListener('storage', refresh) } }, [])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timeout) }, [toast])
  const visible = useMemo(() => { const query = search.trim().toLowerCase(); return rows.filter((row) => showDeleted ? isSoftDeletedRecord(row.record) : isArchivedRecord(row.record)).filter((row) => !query || [row.source.module, rowTitle(row), rowDetail(row)].some((value) => value.toLowerCase().includes(query))) }, [rows, search, showDeleted])
  const archivedCount = rows.filter((row) => isArchivedRecord(row.record)).length
  const deletedCount = rows.filter((row) => isSoftDeletedRecord(row.record)).length

  function restore(row: Row) {
    updateRow(row, (record) => withRestored(record))
    appendSystemLog({ recordId: String(row.record.id), module: row.source.module, action: 'Restored', entity: rowTitle(row), description: 'Record restored with its relationships.', actor: currentUsername, tone: 'success', status: textValue(row.record.status) })
    setToast(`${rowTitle(row)} restored`)
  }
  function softDelete(row: Row) {
    updateRow(row, (record) => withSoftDeleted(record, currentUsername))
    appendSystemLog({ recordId: String(row.record.id), module: row.source.module, action: 'Soft deleted', entity: rowTitle(row), description: 'Record moved to recently deleted; data was retained.', actor: currentUsername, tone: 'danger', status: textValue(row.record.status) })
    setConfirming(null); setToast('Moved to recently deleted')
  }

  return <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Record lifecycle</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-brand-blue">Archive</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Hide records without breaking history. Deleting from Archive is a recoverable soft delete.</p></div><div className="grid grid-cols-2 gap-3"><article className="min-w-36 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-bold uppercase text-slate-400">Archived</p><p className="mt-2 text-2xl font-extrabold text-brand-blue">{archivedCount}</p></article><article className="min-w-36 rounded-2xl border border-red-100 bg-red-50/60 p-4"><p className="text-[9px] font-bold uppercase text-red-500">Deleted</p><p className="mt-2 text-2xl font-extrabold text-red-600">{deletedCount}</p></article></div></SummarySurface>
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1"><button className={`rounded-lg px-4 py-2 text-xs font-bold ${!showDeleted ? 'bg-brand-blue text-white' : 'text-slate-500'}`} type="button" onClick={() => setShowDeleted(false)}>Archived</button><button className={`rounded-lg px-4 py-2 text-xs font-bold ${showDeleted ? 'bg-brand-blue text-white' : 'text-slate-500'}`} type="button" onClick={() => setShowDeleted(true)}>Recently deleted</button></div><input className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-brand-blue outline-none sm:w-72" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search record or module..." /></header>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase text-slate-400"><th className="px-5 py-3.5">Module</th><th className="px-5 py-3.5">Record</th><th className="px-5 py-3.5">Reference</th><th className="px-5 py-3.5">Changed</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead><tbody>{visible.map((row) => <tr className="border-t border-slate-100 hover:bg-blue-50/25" key={`${row.source.key}-${row.record.id}`}><td className="px-5 py-4"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">{row.source.module}</span></td><td className="px-5 py-4"><p className="text-xs font-extrabold text-brand-blue">{rowTitle(row)}</p><p className="mt-1 text-[9px] text-slate-400">ID {String(row.record.id)}</p></td><td className="max-w-64 truncate px-5 py-4 text-xs text-slate-500">{rowDetail(row)}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(showDeleted ? row.record.deletedAt : row.record.archivedAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button className="h-9 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-brand-blue" type="button" onClick={() => restore(row)}>Restore</button>{!showDeleted ? <button className="h-9 rounded-xl border border-red-200 px-3 text-[10px] font-bold text-red-600" type="button" onClick={() => setConfirming(row)}>Delete</button> : null}</div></td></tr>)}</tbody></table></div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><h3 className="text-sm font-bold text-brand-blue">Nothing here</h3><p className="mt-1 text-xs text-slate-400">Records appear here when their lifecycle changes.</p></div></div>}
    </section>
    {confirming ? <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 p-4" role="alertdialog" aria-modal="true"><section className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-xl"><p className="text-[10px] font-bold uppercase text-red-600">Soft delete</p><h2 className="mt-2 text-xl font-extrabold text-brand-blue">Delete from Archive?</h2><p className="mt-2 text-xs leading-5 text-slate-500">The record moves to Recently deleted. Its data and relationships remain recoverable.</p><div className="mt-6 flex justify-end gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500" type="button" onClick={() => setConfirming(null)}>Keep archived</button><button className="h-10 rounded-xl bg-red-600 px-4 text-xs font-bold text-white" type="button" onClick={() => softDelete(confirming)}>Soft delete</button></div></section></div> : null}
    <SuccessToast message={toast} />
  </div>
}
