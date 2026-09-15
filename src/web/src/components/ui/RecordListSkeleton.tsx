type RecordListSkeletonProps = {
  variant?: 'cards' | 'table'
  rows?: number
  columns?: number
}

export function RecordListSkeleton({ variant = 'table', rows = 4, columns = 6 }: RecordListSkeletonProps) {
  const placeholder = 'rounded-lg bg-slate-200/75 animate-pulse motion-reduce:animate-none'

  return <div role="status" aria-live="polite" aria-label="Loading records" className="min-h-72 p-4 sm:p-5">
    <span className="sr-only">Loading records…</span>
    {variant === 'cards' ? <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: rows }, (_, index) => <div className="rounded-2xl border border-slate-200 bg-white p-4" key={index} aria-hidden="true">
        <div className="flex gap-3"><div className={`${placeholder} size-14 shrink-0 rounded-2xl`} /><div className="flex-1 space-y-2"><div className={`${placeholder} h-4 w-3/4`} /><div className={`${placeholder} h-3 w-1/2`} /></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3"><div className={`${placeholder} h-9`} /><div className={`${placeholder} h-9`} /></div>
        <div className={`${placeholder} mt-4 h-3 w-2/3`} />
      </div>)}
    </div> : <div className="overflow-x-auto rounded-xl border border-slate-100" aria-hidden="true">
      <div className="flex min-w-[680px] gap-4 border-b border-slate-100 bg-slate-50/70 px-4 py-4">{Array.from({ length: columns }, (_, index) => <div className={`${placeholder} h-3 flex-1`} key={index} />)}</div>
      {Array.from({ length: rows }, (_, row) => <div className="flex min-w-[680px] gap-4 border-b border-slate-100 px-4 py-5 last:border-b-0" key={row}>{Array.from({ length: columns }, (_, column) => <div className={`${placeholder} h-4 flex-1`} key={column} />)}</div>)}
    </div>}
  </div>
}
