type DetailPageBackButtonProps = {
  label: string
  onClick: () => void
  className?: string
}

export function DetailPageBackButton({ label, onClick, className = '' }: DetailPageBackButtonProps) {
  return (
    <button
      className={`group inline-flex h-9 w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50 hover:text-brand-blue ${className}`}
      type="button"
      onClick={onClick}
    >
      <svg className="size-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </button>
  )
}
