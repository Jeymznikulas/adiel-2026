import { useMemo, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { normalizeLateChargePolicy } from './latePayment'
import { generatePaymentSchedule } from './statementPaymentSchedule'
import type { LateChargePolicy, LateChargeType, PaymentArrangement, PaymentFrequency, PaymentScheduleEntry } from './statementOfAccountTypes'

export type PaymentArrangementValues = {
  paymentArrangement: PaymentArrangement
  paymentFrequency: PaymentFrequency
  paymentSchedule: PaymentScheduleEntry[]
  lateChargePolicy: LateChargePolicy
}

type PaymentArrangementDialogProps = PaymentArrangementValues & {
  totalAmount: number
  statementDate: string
  defaultDueDate: string
  isEditing: boolean
  onConfirm: (values: PaymentArrangementValues) => void
  onClose: () => void
}

type SetupStep = 1 | 2 | 3

const arrangementOptions = [
  { value: 'Full payment' as const, label: 'Full payment', detail: 'One balance with one due date.' },
  { value: 'Installment' as const, label: 'Installment', detail: 'Automatically divide the total.' },
  { value: 'Custom schedule' as const, label: 'Custom schedule', detail: 'Build milestone or progress billing.' },
]
const frequencyOptions = ['Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly'].map((value) => ({ value: value as PaymentFrequency }))
const chargeTypeOptions = ['Percentage', 'Fixed amount'].map((value) => ({ value: value as LateChargeType }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500'

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function makeCustomSchedule(totalAmount: number, dueDate: string): PaymentScheduleEntry[] {
  const firstAmount = Math.floor(Math.round(totalAmount * 100) / 2) / 100
  return [
    { id: crypto.randomUUID(), label: 'Down payment', dueDate, amount: firstAmount },
    { id: crypto.randomUUID(), label: 'Final payment', dueDate, amount: Math.max(0, totalAmount - firstAmount) },
  ]
}

function policySummary(policy: LateChargePolicy) {
  if (!policy.enabled) return 'No late charge'
  const charge = policy.type === 'Percentage' ? `${policy.value}%` : formatPeso(policy.value)
  return `${charge} after ${policy.graceDays} grace day${policy.graceDays === 1 ? '' : 's'}`
}

function Stepper({ step, onBackTo }: { step: SetupStep; onBackTo: (step: SetupStep) => void }) {
  const steps: Array<{ value: SetupStep; label: string }> = [{ value: 1, label: 'Schedule' }, { value: 2, label: 'Late charges' }, { value: 3, label: 'Review' }]
  return <nav className="border-b border-slate-100 bg-slate-50/60 px-6 py-3" aria-label="Payment setup progress"><ol className="mx-auto grid max-w-2xl grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">{steps.map((item, index) => <div className="contents" key={item.value}>{index ? <span className={`h-px ${step >= item.value ? 'bg-brand-orange' : 'bg-slate-200'}`} aria-hidden="true" /> : null}<li><button className={`flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-[10px] font-bold transition ${step === item.value ? 'bg-white text-brand-blue shadow-sm ring-1 ring-slate-200' : step > item.value ? 'text-emerald-700 hover:bg-white' : 'cursor-default text-slate-400'}`} type="button" onClick={() => step > item.value && onBackTo(item.value)} disabled={step < item.value} aria-current={step === item.value ? 'step' : undefined}><span className={`grid size-6 place-items-center rounded-full ${step === item.value ? 'bg-brand-orange text-white' : step > item.value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{step > item.value ? '✓' : item.value}</span><span className="hidden sm:inline">{item.label}</span></button></li></div>)}</ol></nav>
}

function PolicyFields({ policy, onChange, prefix, compact = false }: { policy: LateChargePolicy; onChange: (values: Partial<LateChargePolicy>) => void; prefix: string; compact?: boolean }) {
  return <div className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3'}`}>
    <div><label className={labelClassName} htmlFor={`${prefix}-grace`}>Grace period</label><div className="relative"><input className={fieldClassName} id={`${prefix}-grace`} type="number" min="0" max="90" value={policy.graceDays} onChange={(event) => onChange({ graceDays: Number(event.target.value) })} disabled={!policy.enabled} /><span className="pointer-events-none absolute right-3 top-3.5 text-[9px] font-bold text-slate-400">DAYS</span></div></div>
    <div><label className={labelClassName}>Charge method</label><AnimatedDropdown value={policy.type} options={chargeTypeOptions} onChange={(type) => onChange({ type })} ariaLabel="Late charge method" /></div>
    <div><label className={labelClassName} htmlFor={`${prefix}-value`}>{policy.type === 'Percentage' ? 'Interest rate (%)' : 'Fixed charge (PHP)'}</label><input className={fieldClassName} id={`${prefix}-value`} type="number" min="0" step="0.01" value={policy.value} onChange={(event) => onChange({ value: Number(event.target.value) })} disabled={!policy.enabled} /></div>
  </div>
}

export function PaymentArrangementDialog({ totalAmount, statementDate, defaultDueDate, paymentArrangement: initialArrangement, paymentFrequency: initialFrequency, paymentSchedule: initialSchedule, lateChargePolicy: initialLatePolicy, isEditing, onConfirm, onClose }: PaymentArrangementDialogProps) {
  const [step, setStep] = useState<SetupStep>(1)
  const [arrangement, setArrangement] = useState<PaymentArrangement>(initialArrangement)
  const [frequency, setFrequency] = useState<PaymentFrequency>(initialFrequency === 'Custom' ? 'Monthly' : initialFrequency)
  const [installmentCount, setInstallmentCount] = useState(() => String(initialArrangement === 'Installment' && initialSchedule.length > 1 ? initialSchedule.length : 3))
  const [firstDueDate, setFirstDueDate] = useState(initialSchedule[0]?.dueDate || defaultDueDate || statementDate)
  const [customSchedule, setCustomSchedule] = useState<PaymentScheduleEntry[]>(() => initialArrangement === 'Custom schedule' && initialSchedule.length ? initialSchedule : makeCustomSchedule(totalAmount, defaultDueDate || statementDate))
  const [latePolicy, setLatePolicy] = useState(() => normalizeLateChargePolicy(initialLatePolicy))
  const [schedulePolicies, setSchedulePolicies] = useState<Record<string, LateChargePolicy>>(() => Object.fromEntries(initialSchedule.filter((entry) => entry.lateChargePolicy).map((entry) => [entry.id, normalizeLateChargePolicy(entry.lateChargePolicy)])))
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [error, setError] = useState('')

  const previewSchedule = useMemo(() => {
    if (arrangement === 'Full payment') return [{ id: initialSchedule[0]?.id ?? crypto.randomUUID(), label: 'Full payment', dueDate: firstDueDate, amount: totalAmount }]
    if (arrangement === 'Installment') return generatePaymentSchedule(totalAmount, Number(installmentCount), firstDueDate, frequency).map((entry, index) => ({ ...entry, id: initialSchedule[index]?.id ?? entry.id }))
    return customSchedule
  }, [arrangement, customSchedule, firstDueDate, frequency, initialSchedule, installmentCount, totalAmount])
  const scheduledTotal = previewSchedule.reduce((total, entry) => total + (Number(entry.amount) || 0), 0)
  const difference = totalAmount - scheduledTotal
  const customRuleCount = previewSchedule.filter((entry) => schedulePolicies[entry.id]).length

  function updateCustom(id: string, field: 'label' | 'dueDate' | 'amount', value: string) {
    setCustomSchedule((current) => current.map((entry) => entry.id === id ? { ...entry, [field]: field === 'amount' ? Number(value) : value } : entry))
  }

  function removeCustom(id: string) {
    setCustomSchedule((current) => current.filter((entry) => entry.id !== id))
    setSchedulePolicies((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function setScheduleOverride(entry: PaymentScheduleEntry, enabled: boolean) {
    setSchedulePolicies((current) => {
      if (enabled) return { ...current, [entry.id]: { ...latePolicy } }
      const next = { ...current }
      delete next[entry.id]
      return next
    })
  }

  function updateSchedulePolicy(id: string, values: Partial<LateChargePolicy>) {
    setSchedulePolicies((current) => ({ ...current, [id]: normalizeLateChargePolicy({ ...(current[id] ?? latePolicy), ...values }) }))
  }

  function validateSchedule() {
    if (!previewSchedule.length || previewSchedule.some((entry) => !entry.label.trim() || !entry.dueDate || !Number.isFinite(entry.amount) || entry.amount <= 0)) {
      setError('Every payment must have a label, due date, and amount greater than zero.')
      return false
    }
    if (Math.abs(difference) > 0.01) {
      setError(`The schedule must equal ${formatPeso(totalAmount)}. Adjust the ${formatPeso(Math.abs(difference))} difference.`)
      return false
    }
    return true
  }

  function validatePolicies() {
    if (latePolicy.enabled && latePolicy.value <= 0) {
      setError('Enter a default late-payment rate or turn the policy off.')
      return false
    }
    if (previewSchedule.some((entry) => schedulePolicies[entry.id]?.enabled && schedulePolicies[entry.id]!.value <= 0)) {
      setError('Each enabled custom late-payment rule must have a value greater than zero.')
      return false
    }
    return true
  }

  function nextStep() {
    setError('')
    if (step === 1 && validateSchedule()) setStep(2)
    else if (step === 2 && validatePolicies()) setStep(3)
  }

  function confirm() {
    setError('')
    if (!validateSchedule() || !validatePolicies() || !reviewConfirmed) return
    onConfirm({
      paymentArrangement: arrangement,
      paymentFrequency: arrangement === 'Custom schedule' || arrangement === 'Full payment' ? 'Custom' : frequency,
      lateChargePolicy: normalizeLateChargePolicy(latePolicy),
      paymentSchedule: previewSchedule.map((entry) => ({ ...entry, amount: Math.round(entry.amount * 100) / 100, lateChargePolicy: schedulePolicies[entry.id] ? normalizeLateChargePolicy(schedulePolicies[entry.id]) : undefined })),
    })
  }

  function scheduleConfiguration() {
    return <>
      <div className="grid gap-3 sm:grid-cols-3">{arrangementOptions.map((option) => <button className={`rounded-2xl border p-4 text-left transition ${arrangement === option.value ? 'border-brand-orange bg-orange-50/55 ring-2 ring-brand-orange/10' : 'border-slate-200 bg-white hover:border-brand-blue/20 hover:bg-slate-50'}`} type="button" onClick={() => { setArrangement(option.value); setError('') }} key={option.value}><span className={`grid size-8 place-items-center rounded-xl ${arrangement === option.value ? 'bg-brand-orange text-white' : 'bg-slate-100 text-slate-400'}`}><Icon path={option.value === 'Full payment' ? 'M4 2h16v20H4V2Zm4 5h8M8 11h8M8 15h5' : option.value === 'Installment' ? 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' : 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'} /></span><p className="mt-3 text-sm font-extrabold text-brand-blue">{option.label}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{option.detail}</p></button>)}</div>

      {arrangement === 'Full payment' ? <div className="rounded-2xl border border-blue-100 bg-blue-50/45 p-4"><label className={labelClassName}>Payment due date</label><AnimatedDatePicker value={firstDueDate} onChange={setFirstDueDate} ariaLabel="Full payment due date" min={statementDate} required /><div className="mt-4 flex items-center justify-between border-t border-blue-100 pt-4"><span className="text-xs font-semibold text-slate-500">Amount due</span><strong className="text-lg text-brand-blue">{formatPeso(totalAmount)}</strong></div></div> : null}

      {arrangement === 'Installment' ? <div className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/35 p-4 sm:grid-cols-3"><div><label className={labelClassName} htmlFor="installment-count">Number of installments</label><input className={fieldClassName} id="installment-count" type="number" min="2" max="12" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} /></div><div><label className={labelClassName}>Frequency</label><AnimatedDropdown value={frequency} options={frequencyOptions} onChange={setFrequency} ariaLabel="Installment frequency" /></div><div><label className={labelClassName}>First due date</label><AnimatedDatePicker value={firstDueDate} onChange={setFirstDueDate} ariaLabel="First installment due date" min={statementDate} required /></div></div> : null}

      {arrangement === 'Custom schedule' ? <div><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Custom payment milestones</h3><p className="mt-1 text-[10px] text-slate-400">Use this for down payments, delivery milestones, or progress billing.</p></div><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 text-[10px] font-bold text-violet-700 hover:bg-violet-100" type="button" onClick={() => setCustomSchedule((current) => [...current, { id: crypto.randomUUID(), label: `Payment ${current.length + 1}`, dueDate: current.at(-1)?.dueDate || defaultDueDate || statementDate, amount: 0 }])}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add payment</button></div><div className="mt-3 space-y-2">{customSchedule.map((entry, index) => <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/55 p-3 sm:grid-cols-[1fr_10rem_9rem_auto] sm:items-end" key={entry.id}><div><label className={labelClassName} htmlFor={`schedule-label-${entry.id}`}>Milestone</label><input className={fieldClassName} id={`schedule-label-${entry.id}`} value={entry.label} onChange={(event) => updateCustom(entry.id, 'label', event.target.value)} placeholder={`Payment ${index + 1}`} /></div><div><label className={labelClassName}>Due date</label><AnimatedDatePicker value={entry.dueDate} onChange={(value) => updateCustom(entry.id, 'dueDate', value)} ariaLabel={`Due date for ${entry.label}`} min={statementDate} required /></div><div><label className={labelClassName} htmlFor={`schedule-amount-${entry.id}`}>Amount</label><input className={fieldClassName} id={`schedule-amount-${entry.id}`} type="number" min="0.01" step="0.01" value={entry.amount || ''} onChange={(event) => updateCustom(entry.id, 'amount', event.target.value)} placeholder="0.00" /></div><button className="grid size-10 place-items-center rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" type="button" onClick={() => removeCustom(entry.id)} disabled={customSchedule.length <= 1} aria-label={`Remove ${entry.label}`}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div>)}</div></div> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200"><header className="flex items-center justify-between bg-slate-50/70 px-4 py-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Schedule preview</h3><p className="mt-1 text-[9px] text-slate-400">Review due dates and amounts before setting late-charge rules.</p></div><span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">{previewSchedule.length} payment{previewSchedule.length === 1 ? '' : 's'}</span></header><div className="divide-y divide-slate-100">{previewSchedule.map((entry, index) => <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-3" key={entry.id}><span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-[10px] font-extrabold text-brand-blue">{index + 1}</span><div><p className="text-xs font-bold text-slate-700">{entry.label}</p><p className="mt-1 text-[9px] text-slate-400">Due {entry.dueDate}</p></div><strong className="text-xs tabular-nums text-brand-blue">{formatPeso(entry.amount)}</strong></div>)}</div><footer className={`flex items-center justify-between border-t px-4 py-3 ${Math.abs(difference) <= 0.01 ? 'border-emerald-100 bg-emerald-50/45' : 'border-amber-100 bg-amber-50/55'}`}><span className="text-[10px] font-bold text-slate-500">Scheduled total</span><div className="text-right"><strong className="text-sm text-brand-blue">{formatPeso(scheduledTotal)}</strong>{Math.abs(difference) > 0.01 ? <p className="mt-0.5 text-[9px] font-bold text-amber-700">{difference > 0 ? 'Remaining' : 'Over by'} {formatPeso(Math.abs(difference))}</p> : <p className="mt-0.5 text-[9px] font-bold text-emerald-700">Matches statement total</p>}</div></footer></section>
    </>
  }

  function lateChargeConfiguration() {
    return <>
      <section className="overflow-hidden rounded-2xl border border-slate-200"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Default late-payment policy</h3><p className="mt-1 text-[9px] text-slate-400">Used by every payment unless you customize it below.</p></div><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"><input className="size-4 accent-brand-blue" type="checkbox" checked={latePolicy.enabled} onChange={(event) => setLatePolicy((current) => ({ ...current, enabled: event.target.checked }))} /><span className="text-[10px] font-bold text-brand-blue">Enable interest</span></label></header><div className={`p-4 ${latePolicy.enabled ? '' : 'opacity-45'}`}><PolicyFields policy={latePolicy} onChange={(values) => setLatePolicy((current) => normalizeLateChargePolicy({ ...current, ...values }))} prefix="soa-default-policy" /></div><p className="border-t border-slate-100 bg-blue-50/35 px-4 py-3 text-[10px] leading-5 text-slate-500">Interest is not included in the current balance. It becomes eligible only after a payment passes its due date and grace period, and staff must still review it.</p></section>

      <section className="overflow-hidden rounded-2xl border border-slate-200"><header className="flex items-center justify-between bg-slate-50/70 px-4 py-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Advanced installment overrides</h3><p className="mt-1 text-[9px] text-slate-400">Customize only payments that need a different rule.</p></div><span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{customRuleCount} custom</span></header><div className="divide-y divide-slate-100">{previewSchedule.map((entry, index) => {
        const customPolicy = schedulePolicies[entry.id]
        const effectivePolicy = customPolicy ?? latePolicy
        return <div className="p-4" key={entry.id}><div className="grid gap-3 sm:grid-cols-[2rem_1fr_auto_auto] sm:items-center"><span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-[10px] font-extrabold text-brand-blue">{index + 1}</span><div><p className="text-xs font-bold text-slate-700">{entry.label}</p><p className="mt-1 text-[9px] text-slate-400">Due {entry.dueDate} · {formatPeso(entry.amount)}</p></div><span className={`rounded-lg px-2.5 py-1 text-[9px] font-bold ${effectivePolicy.enabled ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'}`}>{customPolicy ? 'Custom: ' : 'Default: '}{policySummary(effectivePolicy)}</span><button className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[9px] font-bold text-brand-blue hover:bg-blue-50" type="button" onClick={() => setScheduleOverride(entry, !customPolicy)}>{customPolicy ? 'Use default' : 'Customize'}</button></div>{customPolicy ? <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/35 p-3"><label className="mb-3 flex items-center gap-2 text-[10px] font-bold text-brand-blue"><input className="size-4 accent-brand-blue" type="checkbox" checked={customPolicy.enabled} onChange={(event) => updateSchedulePolicy(entry.id, { enabled: event.target.checked })} />Enable interest for this payment</label><PolicyFields policy={customPolicy} onChange={(values) => updateSchedulePolicy(entry.id, values)} prefix={`schedule-policy-${entry.id}`} compact /></div> : null}</div>
      })}</div></section>
    </>
  }

  function review() {
    return <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReviewMetric label="Statement total" value={formatPeso(totalAmount)} /><ReviewMetric label="Payments" value={String(previewSchedule.length)} /><ReviewMetric label="First due date" value={previewSchedule[0]?.dueDate ?? 'Not set'} /><ReviewMetric label="Custom rules" value={String(customRuleCount)} /></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200"><header className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 px-4 py-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Final payment setup</h3><p className="mt-1 text-[9px] text-slate-400">Confirm what will be saved with this Statement of Account.</p></div><span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${latePolicy.enabled ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>Default: {policySummary(latePolicy)}</span></header><div className="divide-y divide-slate-100">{previewSchedule.map((entry, index) => {
        const policy = schedulePolicies[entry.id] ?? latePolicy
        return <div className="grid gap-3 px-4 py-3 sm:grid-cols-[2rem_1fr_auto] sm:items-center" key={entry.id}><span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-[10px] font-extrabold text-brand-blue">{index + 1}</span><div><p className="text-xs font-bold text-slate-700">{entry.label}</p><p className="mt-1 text-[9px] text-slate-400">Due {entry.dueDate} · {formatPeso(entry.amount)}</p></div><div className="sm:text-right"><p className={`text-[10px] font-bold ${policy.enabled ? 'text-red-600' : 'text-slate-400'}`}>{policySummary(policy)}</p>{schedulePolicies[entry.id] ? <p className="mt-1 text-[8px] font-bold uppercase text-violet-600">Custom rule</p> : null}</div></div>
      })}</div></section>
      <section className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-extrabold text-emerald-800">Interest currently added: {formatPeso(0)}</p><p className="mt-1 text-[10px] leading-5 text-emerald-700/75">These are future overdue conditions only. They do not change the statement total when you save.</p></div><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-3"><input className="size-4 accent-emerald-600" type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} /><span className="text-[10px] font-bold text-emerald-800">I reviewed these terms</span></label></section>
    </>
  }

  const title = step === 1 ? 'Build the payment schedule' : step === 2 ? 'Set late-payment rules' : 'Review and confirm'
  const detail = step === 1 ? `Divide the ${formatPeso(totalAmount)} statement balance into collectable payments.` : step === 2 ? 'Set one default rule, then customize only the installments that need an exception.' : 'Verify the schedule and client-facing payment conditions before saving.'

  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-arrangement-title">
    <button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close payment arrangement" />
    <section className="relative my-6 flex max-h-[calc(100svh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.4)]">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">SOA payment setup</p><h2 className="mt-1.5 text-xl font-extrabold tracking-[-0.03em] text-brand-blue" id="payment-arrangement-title">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose}><Icon path="M18 6 6 18M6 6l12 12" /></button></header>
      <Stepper step={step} onBackTo={(next) => { setStep(next); setError('') }} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">{error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}{step === 1 ? scheduleConfiguration() : step === 2 ? lateChargeConfiguration() : review()}</div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4"><p className="hidden text-[10px] font-semibold text-slate-400 sm:block">Step {step} of 3 · Changes are saved only after confirmation.</p><div className="ml-auto flex gap-2">{step === 1 ? <button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>Cancel</button> : <button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => { setStep((step - 1) as SetupStep); setError('') }}>Back</button>}{step < 3 ? <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-sm" type="button" onClick={nextStep}>Continue<Icon className="size-3.5" path="m9 18 6-6-6-6" /></button> : <button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={confirm} disabled={!reviewConfirmed}>{isEditing ? 'Confirm changes' : 'Confirm & create SOA'}</button>}</div></footer>
    </section>
  </div>
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="mt-2 truncate text-sm font-extrabold text-brand-blue">{value}</p></article>
}
