import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { FormErrorSummary } from '../../components/ui/FormErrorSummary'

type Props = { onClose: () => void; onConfirm: (reason: string) => Promise<boolean> }

export function PurchaseOrderRevisionDialog({ onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!reason.trim()) { setError('Explain what must be revised so the next editor knows what to change.'); return }
    setSubmitting(true); setError('')
    try { if (await onConfirm(reason.trim())) onClose(); else setError('The purchase order could not be sent for revision.') } finally { setSubmitting(false) }
  }

  return <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="po-revision-title"><button className="absolute inset-0" type="button" onClick={onClose} disabled={submitting} aria-label="Close revision dialog" /><section className="relative w-full max-w-lg overflow-hidden rounded-[1.65rem] border border-white/20 bg-white shadow-[0_32px_90px_rgba(0,20,76,0.42)]"><header className="border-b border-slate-100 bg-[linear-gradient(135deg,#fff7ed,#ffffff)] px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Review decision</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-brand-blue" id="po-revision-title">Send for revision</h2><p className="mt-1.5 text-xs leading-5 text-slate-500">The PO becomes editable and your reason is added to activity history.</p></header><div className="space-y-4 p-6"><FormErrorSummary message={error} /><div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="po-revision-reason">Revision instructions</label><textarea className="min-h-32 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.06]" id="po-revision-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="Describe the price, quantity, supplier, delivery, or terms that must change." autoFocus /></div></div><footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4"><Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={submitting}>{submitting ? 'Sending...' : 'Send for revision'}</Button></footer></section></div>
}
