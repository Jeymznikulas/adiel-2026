import { useState } from 'react'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { FormErrorSummary } from '../../components/ui/FormErrorSummary'

type CorrectionOption = { value: string; label: string }

type PurchaseOrderStatusCorrectionDialogProps = {
  track: 'Delivery' | 'Payment'
  currentStatus: string
  options: CorrectionOption[]
  onClose: () => void
  onConfirm: (status: string, reason: string) => Promise<boolean>
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function PurchaseOrderStatusCorrectionDialog({ track, currentStatus, options, onClose, onConfirm }: PurchaseOrderStatusCorrectionDialogProps) {
  const [status, setStatus] = useState(options[0]?.value ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit() {
    if (!status || !reason.trim()) {
      setError('Choose the correct status and explain why the previous update was incorrect.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      if (await onConfirm(status, reason.trim())) onClose()
      else setError(`${track} status could not be corrected. Reload the purchase order and try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="po-correction-title">
    <button className="absolute inset-0" type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close status correction" />
    <section className="relative w-full max-w-lg overflow-hidden rounded-[1.6rem] border border-white/20 bg-white shadow-[0_32px_90px_rgba(0,20,76,0.42)]">
      <header className="relative overflow-hidden border-b border-slate-100 px-6 py-5">
        <div className="absolute right-0 top-0 size-36 rounded-full bg-amber-100/45 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Icon path="M12 9v4M12 17h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">Audited correction</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-brand-blue" id="po-correction-title">Correct {track.toLowerCase()} status</h2><p className="mt-1.5 text-xs leading-5 text-slate-500">Current status: <strong className="text-brand-blue">{currentStatus}</strong>. The correction and reason will appear in activity history.</p></div></div>
      </header>
      <div className="space-y-4 px-6 py-5">
        <FormErrorSummary message={error} />
        <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Correct status</label><AnimatedDropdown value={status} options={options} onChange={setStatus} ariaLabel={`Correct ${track.toLowerCase()} status`} /></div>
        <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="po-correction-reason">Reason for correction</label><textarea className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.06]" id="po-correction-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="Example: Delivered was selected accidentally; shipment is still in transit." autoFocus /></div>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/65 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_10px_22px_-14px_rgba(0,20,76,0.7)] disabled:opacity-45" type="button" onClick={() => void submit()} disabled={isSubmitting || !status}>{isSubmitting ? 'Correcting…' : 'Confirm correction'}</button></footer>
    </section>
  </div>
}
