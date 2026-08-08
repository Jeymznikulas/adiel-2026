import { useMemo, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { generatePaymentSchedule } from './statementPaymentSchedule'
import type { PaymentArrangement, PaymentFrequency, PaymentScheduleEntry } from './statementOfAccountTypes'

export type PaymentArrangementValues = {
  paymentArrangement: PaymentArrangement
  paymentFrequency: PaymentFrequency
  paymentSchedule: PaymentScheduleEntry[]
}

type PaymentArrangementDialogProps = PaymentArrangementValues & {
  totalAmount: number
  statementDate: string
  defaultDueDate: string
  isEditing: boolean
  onConfirm: (values: PaymentArrangementValues) => void
  onClose: () => void
}

const arrangementOptions = [
  { value: 'Full payment' as const, label: 'Full payment', dotClassName: 'bg-brand-blue' },
  { value: 'Installment' as const, label: 'Installment', dotClassName: 'bg-emerald-500' },
  { value: 'Custom schedule' as const, label: 'Custom schedule', dotClassName: 'bg-violet-500' },
]
const frequencyOptions = ['Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly'].map((value) => ({ value: value as PaymentFrequency }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500'

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function makeCustomSchedule(totalAmount: number, dueDate: string) {
  const firstAmount = Math.floor(Math.round(totalAmount * 100) / 2) / 100
  return [
    { id: crypto.randomUUID(), label: 'Down payment', dueDate, amount: firstAmount },
    { id: crypto.randomUUID(), label: 'Final payment', dueDate, amount: Math.max(0, totalAmount - firstAmount) },
  ]
}

export function PaymentArrangementDialog({ totalAmount, statementDate, defaultDueDate, paymentArrangement: initialArrangement, paymentFrequency: initialFrequency, paymentSchedule: initialSchedule, isEditing, onConfirm, onClose }: PaymentArrangementDialogProps) {
  const [arrangement, setArrangement] = useState<PaymentArrangement>(initialArrangement)
  const [frequency, setFrequency] = useState<PaymentFrequency>(initialFrequency === 'Custom' ? 'Monthly' : initialFrequency)
  const [installmentCount, setInstallmentCount] = useState(() => String(initialArrangement === 'Installment' && initialSchedule.length > 1 ? initialSchedule.length : 3))
  const [firstDueDate, setFirstDueDate] = useState(initialSchedule[0]?.dueDate || defaultDueDate || statementDate)
  const [customSchedule, setCustomSchedule] = useState<PaymentScheduleEntry[]>(() => initialArrangement === 'Custom schedule' && initialSchedule.length ? initialSchedule : makeCustomSchedule(totalAmount, defaultDueDate || statementDate))
  const [error, setError] = useState('')

  const previewSchedule = useMemo(() => {
    if (arrangement === 'Full payment') return [{ id: initialSchedule[0]?.id ?? crypto.randomUUID(), label: 'Full payment', dueDate: firstDueDate, amount: totalAmount }]
    if (arrangement === 'Installment') return generatePaymentSchedule(totalAmount, Number(installmentCount), firstDueDate, frequency)
    return customSchedule
  }, [arrangement, customSchedule, firstDueDate, frequency, initialSchedule, installmentCount, totalAmount])
  const scheduledTotal = previewSchedule.reduce((total, entry) => total + (Number(entry.amount) || 0), 0)
  const difference = totalAmount - scheduledTotal

  function changeArrangement(value: PaymentArrangement) {
    setArrangement(value)
    setError('')
  }

  function updateCustom(id: string, field: 'label' | 'dueDate' | 'amount', value: string) {
    setCustomSchedule((current) => current.map((entry) => entry.id === id ? { ...entry, [field]: field === 'amount' ? Number(value) : value } : entry))
  }

  function addCustomEntry() {
    setCustomSchedule((current) => [...current, { id: crypto.randomUUID(), label: `Payment ${current.length + 1}`, dueDate: current.at(-1)?.dueDate || defaultDueDate || statementDate, amount: 0 }])
  }

  function confirm() {
    if (!previewSchedule.length || previewSchedule.some((entry) => !entry.label.trim() || !entry.dueDate || !Number.isFinite(entry.amount) || entry.amount <= 0)) {
      setError('Every payment must have a label, due date, and amount greater than zero.')
      return
    }
    if (Math.abs(difference) > 0.01) {
      setError(`The schedule must equal ${formatPeso(totalAmount)}. Adjust the remaining ${formatPeso(Math.abs(difference))}.`)
      return
    }
    onConfirm({ paymentArrangement: arrangement, paymentFrequency: arrangement === 'Custom schedule' ? 'Custom' : arrangement === 'Full payment' ? 'Custom' : frequency, paymentSchedule: previewSchedule.map((entry) => ({ ...entry, amount: Math.round(entry.amount * 100) / 100 })) })
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-arrangement-title"><button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close payment arrangement" /><section className="relative my-6 w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.4)]"><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Final account setup</p><h2 className="mt-1.5 text-xl font-extrabold tracking-[-0.03em] text-brand-blue" id="payment-arrangement-title">Choose a payment arrangement</h2><p className="mt-1 text-xs leading-5 text-slate-400">Set how the {formatPeso(totalAmount)} statement balance should be collected.</p></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose}><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="max-h-[calc(100svh-13rem)] overflow-y-auto px-6 py-5">{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}<div className="grid gap-3 sm:grid-cols-3">{arrangementOptions.map((option) => <button className={`rounded-2xl border p-4 text-left transition ${arrangement === option.value ? 'border-brand-orange bg-orange-50/55 ring-2 ring-brand-orange/10' : 'border-slate-200 bg-white hover:border-brand-blue/20 hover:bg-slate-50'}`} type="button" onClick={() => changeArrangement(option.value)} key={option.value}><span className={`grid size-8 place-items-center rounded-xl ${arrangement === option.value ? 'bg-brand-orange text-white' : 'bg-slate-100 text-slate-400'}`}><Icon path={option.value === 'Full payment' ? 'M4 2h16v20H4V2Zm4 5h8M8 11h8M8 15h5' : option.value === 'Installment' ? 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' : 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'} /></span><p className="mt-3 text-sm font-extrabold text-brand-blue">{option.label}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{option.value === 'Full payment' ? 'One balance with one due date.' : option.value === 'Installment' ? 'Automatically divide the total.' : 'Build milestone or progress billing.'}</p></button>)}</div>{arrangement === 'Full payment' ? <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/45 p-4"><label className={labelClassName}>Payment due date</label><AnimatedDatePicker value={firstDueDate} onChange={setFirstDueDate} ariaLabel="Full payment due date" min={statementDate} required /><div className="mt-4 flex items-center justify-between border-t border-blue-100 pt-4"><span className="text-xs font-semibold text-slate-500">Amount due</span><strong className="text-lg text-brand-blue">{formatPeso(totalAmount)}</strong></div></div> : null}{arrangement === 'Installment' ? <div className="mt-5 grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/35 p-4 sm:grid-cols-3"><div><label className={labelClassName} htmlFor="installment-count">Number of installments</label><input className={fieldClassName} id="installment-count" type="number" min="2" max="12" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} /></div><div><label className={labelClassName}>Frequency</label><AnimatedDropdown value={frequency} options={frequencyOptions} onChange={setFrequency} ariaLabel="Installment frequency" /></div><div><label className={labelClassName}>First due date</label><AnimatedDatePicker value={firstDueDate} onChange={setFirstDueDate} ariaLabel="First installment due date" min={statementDate} required /></div></div> : null}{arrangement === 'Custom schedule' ? <div className="mt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Custom payment milestones</h3><p className="mt-1 text-[10px] text-slate-400">Use this for down payments, delivery milestones, or progress billing.</p></div><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 text-[10px] font-bold text-violet-700 hover:bg-violet-100" type="button" onClick={addCustomEntry}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add payment</button></div><div className="mt-3 space-y-2">{customSchedule.map((entry, index) => <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/55 p-3 sm:grid-cols-[1fr_10rem_9rem_auto] sm:items-end" key={entry.id}><div><label className={labelClassName} htmlFor={`schedule-label-${entry.id}`}>Milestone</label><input className={fieldClassName} id={`schedule-label-${entry.id}`} value={entry.label} onChange={(event) => updateCustom(entry.id, 'label', event.target.value)} placeholder={`Payment ${index + 1}`} /></div><div><label className={labelClassName}>Due date</label><AnimatedDatePicker value={entry.dueDate} onChange={(value) => updateCustom(entry.id, 'dueDate', value)} ariaLabel={`Due date for ${entry.label}`} min={statementDate} required /></div><div><label className={labelClassName} htmlFor={`schedule-amount-${entry.id}`}>Amount</label><input className={fieldClassName} id={`schedule-amount-${entry.id}`} type="number" min="0.01" step="0.01" value={entry.amount || ''} onChange={(event) => updateCustom(entry.id, 'amount', event.target.value)} placeholder="0.00" /></div><button className="grid size-10 place-items-center rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" type="button" onClick={() => setCustomSchedule((current) => current.filter((item) => item.id !== entry.id))} disabled={customSchedule.length <= 1} aria-label={`Remove ${entry.label}`}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div>)}</div></div> : null}<div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><header className="flex items-center justify-between bg-slate-50/70 px-4 py-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Payment schedule preview</h3><p className="mt-1 text-[9px] text-slate-400">Payments will be applied to the oldest scheduled balance first.</p></div><span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">{previewSchedule.length} payment{previewSchedule.length === 1 ? '' : 's'}</span></header><div className="divide-y divide-slate-100">{previewSchedule.map((entry, index) => <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-3" key={`${entry.id}-${index}`}><span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-[10px] font-extrabold text-brand-blue">{index + 1}</span><div><p className="text-xs font-bold text-slate-700">{entry.label}</p><p className="mt-1 text-[9px] text-slate-400">Due {entry.dueDate}</p></div><strong className="text-xs tabular-nums text-brand-blue">{formatPeso(entry.amount)}</strong></div>)}</div><footer className={`flex items-center justify-between border-t px-4 py-3 ${Math.abs(difference) <= 0.01 ? 'border-emerald-100 bg-emerald-50/45' : 'border-amber-100 bg-amber-50/55'}`}><span className="text-[10px] font-bold text-slate-500">Scheduled total</span><div className="text-right"><strong className="text-sm text-brand-blue">{formatPeso(scheduledTotal)}</strong>{Math.abs(difference) > 0.01 ? <p className="mt-0.5 text-[9px] font-bold text-amber-700">{difference > 0 ? 'Remaining' : 'Over by'} {formatPeso(Math.abs(difference))}</p> : <p className="mt-0.5 text-[9px] font-bold text-emerald-700">Matches statement total</p>}</div></footer></div></div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4"><p className="text-[10px] font-semibold text-slate-400">You can edit this arrangement later from the SOA.</p><div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>Back</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-sm" type="button" onClick={confirm}>{isEditing ? 'Confirm changes' : 'Confirm & create SOA'}</button></div></footer></section></div>
}
