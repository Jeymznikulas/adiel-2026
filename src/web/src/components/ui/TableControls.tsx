import { useEffect, useMemo, useState } from 'react'
import { AnimatedDropdown } from './AnimatedDropdown'
import { usePersistentState } from './usePersistentState'

export type TableSortOption<T> = {
  value: string
  label: string
  getValue: (row: T) => string | number
  direction?: 'asc' | 'desc'
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTableView<T>({ rows, storageKey, sortOptions, pageSizeOptions = [10, 20, 50] }: {
  rows: T[]
  storageKey: string
  sortOptions: TableSortOption<T>[]
  pageSizeOptions?: number[]
}) {
  const [sortKey, setSortKey] = usePersistentState(`${storageKey}.sort`, sortOptions[0]?.value ?? '')
  const [pageSize, setPageSize] = usePersistentState(`${storageKey}.page-size`, pageSizeOptions[0] ?? 10)
  const [page, setPage] = useState(1)
  const activeSort = sortOptions.find((option) => option.value === sortKey) ?? sortOptions[0]
  const sortedRows = useMemo(() => {
    if (!activeSort) return rows
    const direction = activeSort.direction === 'asc' ? 1 : -1
    return [...rows].sort((left, right) => {
      const leftValue = activeSort.getValue(left)
      const rightValue = activeSort.getValue(right)
      if (typeof leftValue === 'number' && typeof rightValue === 'number') return (leftValue - rightValue) * direction
      return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' }) * direction
    })
  }, [activeSort, rows])
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  return { pageRows, page: safePage, pageCount, pageSize, setPage, setPageSize, sortKey, setSortKey, total: rows.length }
}

export function TableControls({ tableId, storageKey, columns, sortKey, sortOptions, onSortChange, page, pageCount, pageSize, pageSizeOptions = [10, 20, 50], itemLabel = 'rows', onPageChange, onPageSizeChange, total }: {
  tableId: string
  storageKey: string
  columns: Array<{ index: number; label: string; required?: boolean }>
  sortKey: string
  sortOptions: Array<{ value: string; label: string }>
  onSortChange: (value: string) => void
  page: number
  pageCount: number
  pageSize: number
  pageSizeOptions?: number[]
  itemLabel?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  total: number
}) {
  const [isColumnsOpen, setIsColumnsOpen] = useState(false)
  const [hiddenColumns, setHiddenColumns] = usePersistentState<number[]>(`${storageKey}.hidden-columns`, [])

  useEffect(() => {
    const table = document.getElementById(tableId) ?? document.querySelector('main table')
    if (!table) return
    columns.forEach((column) => {
      table.querySelectorAll<HTMLElement>(`tr > :nth-child(${column.index})`).forEach((cell) => {
        cell.style.display = hiddenColumns.includes(column.index) ? 'none' : ''
      })
    })
  }, [columns, hiddenColumns, tableId, page, pageSize, total])

  function toggleColumn(index: number) {
    setHiddenColumns((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])
  }

  const first = total ? (page - 1) * pageSize + 1 : 0
  const last = Math.min(page * pageSize, total)

  return <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_10px_28px_-26px_rgba(0,20,76,0.45)] sm:flex-row sm:items-center sm:justify-between">
    <p className="text-[10px] font-semibold text-slate-400">Showing <strong className="text-slate-600">{first}–{last}</strong> of {total}</p>
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-40"><AnimatedDropdown size="compact" value={sortKey} options={sortOptions} onChange={onSortChange} ariaLabel="Sort table" /></div>
      {columns.length ? <div className="relative"><button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 transition hover:border-brand-blue/15 hover:text-brand-blue" type="button" onClick={() => setIsColumnsOpen((current) => !current)} aria-expanded={isColumnsOpen}><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v14H4V5Zm5 0v14m6-14v14" /></svg>Columns</button>{isColumnsOpen ? <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_42px_-18px_rgba(0,20,76,0.35)] animate-[status-menu-enter_160ms_cubic-bezier(0.22,1,0.36,1)]">{columns.map((column) => <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50" type="button" onClick={() => toggleColumn(column.index)} disabled={column.required} key={column.index}><span className={`grid size-4 place-items-center rounded border ${!hiddenColumns.includes(column.index) ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 text-transparent'}`}><svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 4 4L19 6" /></svg></span>{column.label}</button>)}</div> : null}</div> : null}
      <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-600 outline-none" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label={`${itemLabel} per page`}>{pageSizeOptions.map((size) => <option value={size} key={size}>{size} {itemLabel}</option>)}</select>
      <div className="flex items-center gap-1"><button className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-brand-blue disabled:opacity-30" type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></button><span className="min-w-12 text-center text-[10px] font-bold text-slate-500">{page}/{pageCount}</span><button className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-brand-blue disabled:opacity-30" type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page"><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg></button></div>
    </div>
  </div>
}
