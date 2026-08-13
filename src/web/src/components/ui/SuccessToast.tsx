type SuccessToastProps = {
  message: string
}

export function SuccessToast({ message }: SuccessToastProps) {
  if (!message) return null

  return (
    <div className="app-toast fixed bottom-5 right-5 z-[80] flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-xl border border-emerald-200/70 bg-white px-4 py-3 text-xs font-bold text-slate-700 animate-[success-toast-enter_240ms_cubic-bezier(0.22,1,0.36,1)]" role="status" aria-live="polite">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </span>
      <span className="min-w-0">{message}</span>
    </div>
  )
}
