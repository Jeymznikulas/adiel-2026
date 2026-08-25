import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedDropdown } from './AnimatedDropdown'
import { Button, IconButton } from './Button'
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
  const columnsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const table = document.getElementById(tableId) ?? document.querySelector('main table')
    if (!table) return
    columns.forEach((column) => {
      table.querySelectorAll<HTMLElement>(`tr > :nth-child(${column.index})`).forEach((cell) => {
        cell.style.display = hiddenColumns.includes(column.index) ? 'none' : ''
      })
    })
  }, [columns, hiddenColumns, tableId, page, pageSize, total])

  useEffect(() => {
    if (!isColumnsOpen) return
    function closeOnPointerDown(event: PointerEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) setIsColumnsOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsColumnsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isColumnsOpen])

  function toggleColumn(index: number) {
    setHiddenColumns((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])
  }

  const first = total ? (page - 1) * pageSize + 1 : 0
  const last = Math.min(page * pageSize, total)

  return <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_10px_28px_-26px_rgba(0,20,76,0.45)] sm:flex-row sm:items-center sm:justify-between">
    <p className="text-[10px] font-semibold text-slate-400">Showing <strong className="text-slate-600">{first}–{last}</strong> of {total}</p>
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-40"><AnimatedDropdown size="compact" value={sortKey} options={sortOptions} onChange={onSortChange} ariaLabel="Sort table" /></div>
      {columns.length ? <div className="relative" ref={columnsRef}><Button size="small" variant="secondary" onClick={() => setIsColumnsOpen((current) => !current)} aria-expanded={isColumnsOpen} leadingIcon={<svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v14H4V5Zm5 0v14m6-14v14" /></svg>}>Columns</Button>{isColumnsOpen ? <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_42px_-18px_rgba(0,20,76,0.35)] animate-[status-menu-enter_160ms_cubic-bezier(0.22,1,0.36,1)]" role="menu">{columns.map((column) => <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50" type="button" role="menuitemcheckbox" aria-checked={!hiddenColumns.includes(column.index)} onClick={() => toggleColumn(column.index)} disabled={column.required} key={column.index}><span className={`grid size-4 place-items-center rounded border ${!hiddenColumns.includes(column.index) ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 text-transparent'}`}><svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 4 4L19 6" /></svg></span>{column.label}</button>)}</div> : null}</div> : null}
      <div className="min-w-24"><AnimatedDropdown size="compact" value={String(pageSize)} options={pageSizeOptions.map((size) => ({ value: String(size), label: `${size} ${itemLabel}` }))} onChange={(value) => onPageSizeChange(Number(value))} ariaLabel={`${itemLabel} per page`} /></div>
      <div className="flex items-center gap-1"><IconButton size="small" variant="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1} label="Previous page"><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></IconButton><span className="min-w-12 text-center text-[10px] font-bold text-slate-500" aria-label={`Page ${page} of ${pageCount}`}>{page}/{pageCount}</span><IconButton size="small" variant="secondary" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} label="Next page"><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></IconButton></div>
    </div>
  </div>
}
