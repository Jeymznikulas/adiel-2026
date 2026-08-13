import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type SearchRecord = {
  id: string
  type: 'Client' | 'Item' | 'Quotation' | 'Purchase order'
  title: string
  detail: string
  searchText: string
  path: string
}

function readArray(key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed as unknown[] : []
  } catch {
    return []
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function loadRecords(): SearchRecord[] {
  const clients = readArray('adiel.clients').flatMap((value): SearchRecord[] => {
    if (typeof value !== 'object' || value === null) return []
    const item = value as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.name !== 'string') return []
    const detail = [text(item.contactPerson), text(item.industry), text(item.address)].filter(Boolean).join(' · ')
    return [{ id: `client-${item.id}`, type: 'Client', title: item.name, detail: detail || 'Client record', searchText: `${item.name} ${detail} ${text(item.email)} ${text(item.phone)}`.toLowerCase(), path: `/clients/${encodeURIComponent(item.id)}` }]
  })
  const items = readArray('adiel.items').flatMap((value): SearchRecord[] => {
    if (typeof value !== 'object' || value === null) return []
    const item = value as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.name !== 'string') return []
    const detail = [text(item.productCode), text(item.category), text(item.brand)].filter(Boolean).join(' · ')
    return [{ id: `item-${item.id}`, type: 'Item', title: item.name, detail: detail || 'Item record', searchText: `${item.name} ${detail} ${text(item.barcode)} ${text(item.subcategory)}`.toLowerCase(), path: `/items/${encodeURIComponent(item.id)}` }]
  })
  const quotations = readArray('adiel.quotations').flatMap((value): SearchRecord[] => {
    if (typeof value !== 'object' || value === null) return []
    const item = value as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.quotationNumber !== 'string') return []
    const detail = [text(item.clientName), text(item.subject), text(item.status)].filter(Boolean).join(' · ')
    return [{ id: `quotation-${item.id}`, type: 'Quotation', title: item.quotationNumber, detail: detail || 'Quotation record', searchText: `${item.quotationNumber} ${detail} ${text(item.projectLocation)}`.toLowerCase(), path: `/quotations/${encodeURIComponent(item.id)}` }]
  })
  const purchaseOrders = readArray('adiel.purchase-orders').flatMap((value): SearchRecord[] => {
    if (typeof value !== 'object' || value === null) return []
    const item = value as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.poNumber !== 'string') return []
    const detail = [text(item.supplierName), text(item.clientName), text(item.status)].filter(Boolean).join(' · ')
    return [{ id: `po-${item.id}`, type: 'Purchase order', title: item.poNumber, detail: detail || 'Purchase order', searchText: `${item.poNumber} ${detail} ${text(item.subject)}`.toLowerCase(), path: '/purchase-orders' }]
  })
  return [...clients, ...items, ...quotations, ...purchaseOrders]
}

const typeTone: Record<SearchRecord['type'], string> = {
  Client: 'bg-blue-50 text-brand-blue',
  Item: 'bg-violet-50 text-violet-700',
  Quotation: 'bg-emerald-50 text-emerald-700',
  'Purchase order': 'bg-amber-50 text-amber-700',
}

export function GlobalSearch({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<SearchRecord[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const open = () => {
      setRecords(loadRecords())
      setIsOpen(true)
      window.requestAnimationFrame(() => inputRef.current?.focus())
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        open()
      }
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('adiel:open-global-search', open)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('adiel:open-global-search', open)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
      window.requestAnimationFrame(() => inputRef.current?.focus())
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return records.slice(0, 8)
    const words = normalized.split(/\s+/)
    return records.filter((record) => words.every((word) => record.searchText.includes(word))).slice(0, 12)
  }, [query, records])

  function openSearch() {
    setRecords(loadRecords())
    setIsOpen(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  function choose(record: SearchRecord) {
    if (record.type === 'Purchase order') {
      try {
        window.sessionStorage.setItem('adiel.preference.purchase-orders.search', JSON.stringify(record.title))
      } catch {
        // Navigation still works when browser storage is unavailable.
      }
    }
    setIsOpen(false)
    setQuery('')
    onNavigate(record.path)
  }

  const searchDialog = createPortal(
    <dialog ref={dialogRef} className="global-search-dialog m-auto max-h-[calc(100svh-1.5rem)] w-[calc(100%_-_1.5rem)] max-w-2xl overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_30px_90px_rgba(0,20,76,0.38)] outline-none" aria-label="Global search" onCancel={(event) => { event.preventDefault(); setIsOpen(false) }} onClose={() => setIsOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setIsOpen(false) }}>
      <section className="flex max-h-[calc(100svh-1.5rem)] min-h-52 w-full flex-col overflow-hidden bg-white sm:max-h-[80svh]">
        <label className="relative block shrink-0 border-b border-slate-100">
          <span className="sr-only">Search the system</span>
          <svg className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-300 sm:left-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input ref={inputRef} className="h-14 w-full bg-white pl-12 pr-12 text-sm font-semibold text-brand-blue outline-none placeholder:text-slate-300 sm:h-16 sm:pl-14 sm:pr-14" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) { event.preventDefault(); choose(results[0]) } }} placeholder="Search clients, items, quotations, or orders..." />
          <button className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-brand-blue sm:right-4" type="button" onClick={() => setIsOpen(false)} aria-label="Close global search"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length ? results.map((record) => <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50" type="button" onClick={() => choose(record)} key={record.id}><span className={`grid size-10 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold ${typeTone[record.type]}`}>{record.type === 'Purchase order' ? 'PO' : record.type.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-brand-blue">{record.title}</span><span className="mt-1 block truncate text-[11px] text-slate-400">{record.detail}</span></span><span className="hidden shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-400 sm:block">{record.type}</span></button>) : <div className="grid min-h-40 place-items-center p-6 text-center"><div><p className="text-sm font-bold text-brand-blue">No matching records</p><p className="mt-1 text-xs text-slate-400">Check the spelling or try a shorter search.</p></div></div>}
        </div>
        <footer className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/65 px-4 py-3 text-[10px] text-slate-400 sm:px-5"><span>{records.length} searchable records</span><span className="hidden sm:inline">Enter to open · Esc to close</span></footer>
      </section>
    </dialog>,
    document.body,
  )

  return <>
    <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-bold text-brand-blue shadow-sm transition hover:border-brand-blue/20 hover:bg-slate-50" type="button" onClick={openSearch} aria-label="Open system search"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><span>Search</span><kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 xl:inline">Ctrl K</kbd></button>
    {searchDialog}
  </>
}
