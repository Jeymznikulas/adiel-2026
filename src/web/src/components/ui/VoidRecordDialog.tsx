import { useState } from 'react'

type VoidRecordDialogProps = {
  recordLabel: string
  onClose: () => void
  onConfirm: (reason: string, archiveAfterVoiding: boolean) => void
}

export function VoidRecordDialog({ recordLabel, onClose, onConfirm }: VoidRecordDialogProps) {
  const [reason, setReason] = useState('')
  const [archiveAfterVoiding, setArchiveAfterVoiding] = useState(false)
  const [error, setError] = useState('')

  function confirm() {
    if (!reason.trim()) {
      setError('Enter a reason so the audit history explains why this record was voided.')
      return
    }
    onConfirm(reason.trim(), archiveAfterVoiding)
  }

  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="void-record-title">
    <button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close void confirmation" />
    <section className="relative w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]">
      <header className="border-b border-slate-100 px-6 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-600">Accounting action</p>
        <h2 className="mt-1.5 text-xl font-extrabold text-brand-blue" id="void-record-title">Void {recordLabel}?</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">The record stays in the audit history but stops affecting active financial totals.</p>
      </header>
      <div className="space-y-4 px-6 py-5">
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700">{error}</p> : null}
        <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="void-reason">Reason for voiding</label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="void-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="Example: Duplicate entry or transaction cancelled by client" autoFocus /></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/65 p-3.5"><input className="mt-0.5 size-4 accent-brand-blue" type="checkbox" checked={archiveAfterVoiding} onChange={(event) => setArchiveAfterVoiding(event.target.checked)} /><span><span className="block text-xs font-bold text-brand-blue">Archive after voiding</span><span className="mt-1 block text-[10px] leading-4 text-slate-400">Hide it from the regular list immediately. It can still be restored from Archive.</span></span></label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>Keep record</button><button className="h-10 rounded-xl bg-red-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-red-700" type="button" onClick={confirm}>Void record</button></footer>
    </section>
  </div>
}
