import { useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { Button, IconButton } from '../../components/ui/Button'
import { FormErrorSummary } from '../../components/ui/FormErrorSummary'

export type PurchaseOrderPaymentInput = { paymentDate: string; amount: number; method: string; referenceNumber: string; notes: string }

type Props = {
  poNumber: string
  total: number
  paid: number
  balance: number
  defaultMethod: string
  onClose: () => void
  onConfirm: (payment: PurchaseOrderPaymentInput) => Promise<boolean>
}

const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.06]'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function peso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

export function PurchaseOrderPaymentDialog({ poNumber, total, paid, balance, defaultMethod, onClose, onConfirm }: Props) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState(defaultMethod)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const numericAmount = Number(amount)
  const afterPayment = Math.max(0, balance - (Number.isFinite(numericAmount) ? numericAmount : 0))

  async function submit() {
    if (!paymentDate || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > balance || !method.trim()) {
      setError(`Enter a positive amount up to the remaining balance of ${peso(balance)}, a payment date, and a method.`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (await onConfirm({ paymentDate, amount: numericAmount, method: method.trim(), referenceNumber: referenceNumber.trim(), notes: notes.trim() })) onClose()
      else setError('The payment could not be recorded. Reload the purchase order and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="po-payment-title">
    <button className="absolute inset-0" type="button" onClick={onClose} disabled={submitting} aria-label="Close payment dialog" />
    <section className="relative my-5 w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-white/20 bg-white shadow-[0_34px_100px_rgba(0,20,76,0.46)]">
      <header className="relative overflow-hidden border-b border-slate-100 bg-[linear-gradient(135deg,#00113f,#073078)] px-6 py-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-emerald-300 ring-1 ring-white/15"><Icon path="M2 7h20v12H2V7Zm0 4h20M6 15h4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Supplier payment</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em]" id="po-payment-title">Record payment</h2><p className="mt-1.5 text-xs text-white/60">{poNumber} · Every payment is saved in the permanent ledger.</p></div></div><IconButton className="text-white hover:bg-white/10" label="Close payment dialog" onClick={onClose} disabled={submitting}><Icon path="M18 6 6 18M6 6l12 12" /></IconButton></div>
      </header>
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70"><div className="p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">PO total</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{peso(total)}</p></div><div className="border-l border-slate-200 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-600">Paid</p><p className="mt-2 text-sm font-extrabold text-emerald-700">{peso(paid)}</p></div><div className="border-l border-slate-200 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-600">Balance</p><p className="mt-2 text-sm font-extrabold text-amber-700">{peso(balance)}</p></div></div>
        <FormErrorSummary message={error} />
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="po-payment-amount">Amount paid</label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">₱</span><input className={`${fieldClassName} pl-8`} id="po-payment-amount" type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setError('') }} placeholder="0.00" autoFocus /></div></div><div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Payment date</label><AnimatedDatePicker value={paymentDate} onChange={setPaymentDate} ariaLabel="Payment date" max={new Date().toISOString().slice(0, 10)} required /></div><div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="po-payment-method">Method</label><input className={fieldClassName} id="po-payment-method" value={method} onChange={(event) => setMethod(event.target.value)} placeholder="Bank transfer, cash, cheque..." /></div><div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="po-payment-reference">Reference <span className="normal-case text-slate-300">(optional)</span></label><input className={fieldClassName} id="po-payment-reference" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={100} placeholder="Receipt or transaction number" /></div></div>
        <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="po-payment-notes">Notes <span className="normal-case text-slate-300">(optional)</span></label><textarea className={`${fieldClassName} min-h-24 resize-y py-3`} id="po-payment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Payment details or internal note" /></div>
        <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/55 p-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-600">Balance after this payment</p><p className="mt-1 text-[10px] text-slate-500">Status becomes {afterPayment === 0 && numericAmount > 0 ? 'Paid' : 'Partially Paid'}.</p></div><strong className="text-xl text-brand-blue">{peso(afterPayment)}</strong></div>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4"><Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button><Button variant="primary" leadingIcon={<Icon path="M12 5v14M5 12h14" />} onClick={() => void submit()} disabled={submitting || balance <= 0}>{submitting ? 'Recording...' : 'Record payment'}</Button></footer>
    </section>
  </div>
}
