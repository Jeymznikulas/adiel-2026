export function ChartLoadingState({ className = 'h-64' }: { className?: string }) {
  return <div className={`${className} animate-pulse rounded-xl bg-slate-50`} aria-label="Loading chart" />
}

export function ChartEmptyState({ title, detail, className = 'min-h-64' }: { title: string; detail: string; className?: string }) {
  return <div className={`grid place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/55 px-5 text-center ${className}`}><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-white text-slate-300 shadow-sm"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18M7 16l4-5 3 3 6-8" /></svg></span><p className="mt-3 text-xs font-bold text-brand-blue">{title}</p><p className="mt-1 text-[10px] text-slate-400">{detail}</p></div></div>
}
