import { useEffect, useState } from 'react'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { listArchive, type ArchiveRow } from '../../services/api/insights'
import { restoreClient } from '../../services/api/clients'
import { restoreSupplier } from '../../services/api/suppliers'
import { restoreItem } from '../../services/api/items'
import { restoreQuotation } from '../../services/api/quotations'
import { restorePurchaseOrder } from '../../services/api/purchaseOrders'
import { restoreExpense } from '../../services/api/expenses'
import { restoreStatement } from '../../services/api/statements'
import { restoreTask } from '../../services/api/tasks'

function formatDate(value: string) { return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

export function ArchivePage({ currentUsername: _currentUsername }: { currentUsername: string }) {
  const [items, setItems] = useState<ArchiveRow[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => { void listArchive({ search, page, pageSize: 30 }).then((result) => { setItems(result.items); setTotal(result.total); setError('') }).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Archive could not be loaded.')) }, 160)
    return () => window.clearTimeout(timer)
  }, [page, search])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer) }, [toast])

  async function restore(row: ArchiveRow) {
    try {
      switch (row.module) {
        case 'Clients': await restoreClient(row.id, row.version); break
        case 'Suppliers': await restoreSupplier(row.id, row.version); break
        case 'Items': await restoreItem(row.id, row.version); break
        case 'Quotations': await restoreQuotation(row.id, row.version); break
        case 'Purchase Orders': await restorePurchaseOrder(row.id, row.version); break
        case 'Expenses': await restoreExpense(row.id, row.version); break
        case 'Statements of Account': await restoreStatement(row.id, row.version); break
        case 'Tasks': await restoreTask(row.id, row.version); break
      }
      setItems((current) => current.filter((item) => !(item.module === row.module && item.id === row.id)))
      setTotal((current) => Math.max(0, current - 1)); setToast(`${row.title} restored`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The record could not be restored.') }
  }

  return <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Record lifecycle</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-brand-blue">Archive</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Archived records remain recoverable without rebuilding business state in the browser.</p></div><article className="min-w-36 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-bold uppercase text-slate-400">Archived</p><p className="mt-2 text-2xl font-extrabold text-brand-blue">{total}</p></article></SummarySurface>
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-brand-blue">Archived records</p><p className="mt-1 text-[11px] text-slate-400">Searches are performed by the backend across supported modules.</p></div><input className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-brand-blue outline-none sm:w-72" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search record or module..." /></header>
      {error ? <p className="m-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p> : null}
      {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase text-slate-400"><th className="px-5 py-3.5">Module</th><th className="px-5 py-3.5">Record</th><th className="px-5 py-3.5">Reference</th><th className="px-5 py-3.5">Archived</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead><tbody>{items.map((row) => <tr className="border-t border-slate-100 transition hover:bg-blue-50/25" key={`${row.module}-${row.id}`}><td className="px-5 py-4"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">{row.module}</span></td><td className="px-5 py-4"><p className="text-xs font-extrabold text-brand-blue">{row.title}</p><p className="mt-1 text-[9px] text-slate-400">ID {row.id}</p></td><td className="max-w-64 truncate px-5 py-4 text-xs text-slate-500">{row.detail || '—'}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.archivedAt)}</td><td className="px-5 py-4 text-right"><button className="h-9 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:bg-blue-50" type="button" onClick={() => restore(row)}>Restore</button></td></tr>)}</tbody></table></div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><h3 className="text-sm font-bold text-brand-blue">Nothing here</h3><p className="mt-1 text-xs text-slate-400">Records appear here when archived.</p></div></div>}
      <footer className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-3 text-xs"><button disabled={page === 1} className="rounded-lg px-3 py-2 font-bold text-brand-blue disabled:opacity-35" type="button" onClick={() => setPage((current) => current - 1)}>Previous</button><span className="text-slate-400">Page {page}</span><button disabled={page * 30 >= total} className="rounded-lg px-3 py-2 font-bold text-brand-blue disabled:opacity-35" type="button" onClick={() => setPage((current) => current + 1)}>Next</button></footer>
    </section><SuccessToast message={toast} />
  </div>
}
