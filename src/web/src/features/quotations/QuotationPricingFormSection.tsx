import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { QuotationFeeDraft } from './QuotationPricingDialog'

type QuotationPricingFormSectionProps = {
  subtotal: number
  vatEnabled: boolean
  fees: QuotationFeeDraft[]
  onVatChange: (enabled: boolean) => void
  onFeesChange: (fees: QuotationFeeDraft[]) => void
}

const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-1.5 block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function PricingSection({ subtotal, vatEnabled, fees, onVatChange, onFeesChange }: QuotationPricingFormSectionProps) {
  const vatAmount = vatEnabled ? subtotal * 0.12 : 0
  const feesTotal = fees.reduce((total, fee) => total + (Number(fee.amount) || 0), 0)
  const grandTotal = subtotal + vatAmount + feesTotal

  function addFee() {
    onFeesChange([...fees, { id: crypto.randomUUID(), label: '', amount: '' }])
  }

  function updateFee(id: string, field: 'label' | 'amount', value: string) {
    onFeesChange(fees.map((fee) => fee.id === id ? { ...fee, [field]: value } : fee))
  }

  return <section className="mt-6 border-t border-slate-100 pt-5"><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon path="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Taxes &amp; additional fees</h3><p className="text-[10px] text-slate-400">Build the final quoted amount with a clear pricing breakdown.</p></div></div><div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"><div className="space-y-3"><article className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/55 p-4"><div><p className="text-sm font-bold text-brand-blue">VAT (12%)</p><p className="mt-1 text-[11px] text-slate-400">Calculated automatically from the items subtotal.</p></div><div className="flex items-center gap-3"><span className="text-sm font-extrabold tabular-nums text-slate-600">{formatPeso(vatAmount)}</span><button className={`relative h-7 w-12 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/15 ${vatEnabled ? 'bg-brand-blue' : 'bg-slate-300'}`} type="button" onClick={() => onVatChange(!vatEnabled)} role="switch" aria-checked={vatEnabled} aria-label="Apply 12 percent VAT"><span className={`absolute left-0 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${vatEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div></article><article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-brand-blue">Other fees</p><p className="mt-1 text-[11px] text-slate-400">Delivery, mobilization, handling, permits, or custom fees.</p></div><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-blue/10 bg-blue-50 px-3 text-[11px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:bg-blue-100" type="button" onClick={addFee}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add fee</button></div>{fees.length ? <div className="mt-3 space-y-2">{fees.map((fee, index) => <div className="grid gap-2 rounded-xl bg-slate-50/70 p-2.5 sm:grid-cols-[1fr_10rem_auto]" key={fee.id}><div><label className={labelClassName} htmlFor={`quotation-inline-fee-label-${fee.id}`}>Fee name</label><input className={fieldClassName} id={`quotation-inline-fee-label-${fee.id}`} value={fee.label} onChange={(event) => updateFee(fee.id, 'label', event.target.value)} placeholder="Example: Delivery fee" required /></div><div><label className={labelClassName} htmlFor={`quotation-inline-fee-amount-${fee.id}`}>Amount</label><input className={fieldClassName} id={`quotation-inline-fee-amount-${fee.id}`} type="number" min="0.01" step="0.01" value={fee.amount} onChange={(event) => updateFee(fee.id, 'amount', event.target.value)} placeholder="0.00" required /></div><button className="grid size-11 place-items-center self-end rounded-xl text-slate-300 transition hover:bg-red-50 hover:text-red-600" type="button" onClick={() => onFeesChange(fees.filter((entry) => entry.id !== fee.id))} aria-label={`Remove ${fee.label || `fee ${index + 1}`}`}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">No additional fees</p>}</article></div><aside className="self-start rounded-2xl bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white shadow-[0_18px_38px_-24px_rgba(0,20,76,0.75)]"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Quotation total</p><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4 text-white/70"><span>Items subtotal</span><span className="font-bold tabular-nums text-white">{formatPeso(subtotal)}</span></div><div className={`flex justify-between gap-4 ${vatEnabled ? 'text-white/70' : 'text-white/35'}`}><span>VAT (12%)</span><span className="font-bold tabular-nums text-white">{formatPeso(vatAmount)}</span></div>{fees.map((fee, index) => <div className="flex justify-between gap-4 text-white/70" key={fee.id}><span className="truncate">{fee.label.trim() || `Fee ${index + 1}`}</span><span className="shrink-0 font-bold tabular-nums text-white">{formatPeso(Number(fee.amount) || 0)}</span></div>)}</div><div className="mt-4 border-t border-white/15 pt-4"><div className="flex items-end justify-between gap-4"><span className="text-xs font-bold uppercase tracking-[0.1em] text-white/60">Grand total</span><span className="text-2xl font-extrabold tabular-nums">{formatPeso(grandTotal)}</span></div></div></aside></div></section>
}

export function QuotationPricingFormSectionPortal(props: QuotationPricingFormSectionProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const form = document.querySelector<HTMLFormElement>('[aria-labelledby="quotation-form-title"] form')
    const scrollArea = form?.children.item(1)
    if (!(scrollArea instanceof HTMLElement)) return
    const summary = Array.from(scrollArea.children).find((element) => element.tagName === 'SECTION' && element.classList.contains('sm:grid-cols-3'))
    const container = document.createElement('div')
    container.dataset.quotationPricingSection = 'true'
    scrollArea.insertBefore(container, summary ?? null)
    setHost(container)
    return () => container.remove()
  }, [])

  return host ? createPortal(<PricingSection {...props} />, host) : null
}
