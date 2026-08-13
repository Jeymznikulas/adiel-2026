import { useEffect, useRef, useState } from 'react'
import type { Quotation } from './QuotationsPage'

type QuotationApprovalDialogProps = {
  quotation: Quotation
  onClose: () => void
  onEdit: () => void
  onApprove: () => void
  onRemoveItems: (itemIds: string[]) => void
}

type ItemDecision = 'approved' | 'not-approved'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function ProductPhoto({ photo, name }: { photo: string; name: string }) {
  return photo
    ? <img className="size-11 shrink-0 rounded-xl border border-slate-100 object-cover" src={photo} alt="" />
    : <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#eef3fb,#e3eaf5)] text-[10px] font-extrabold text-brand-blue">{name.split(/\s+/).map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'IT'}</span>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

export function QuotationApprovalDialog({ quotation, onClose, onEdit, onApprove, onRemoveItems }: QuotationApprovalDialogProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [itemDecisions, setItemDecisions] = useState<Record<string, ItemDecision>>({})
  const [isRemovalConfirmationOpen, setIsRemovalConfirmationOpen] = useState(false)
  const approveAllCheckboxRef = useRef<HTMLInputElement>(null)
  const totalCost = quotation.items.reduce((total, item) => total + item.quantity * item.unitCost, 0)
  const margin = quotation.subtotalAmount ? (quotation.estimatedProfit / quotation.subtotalAmount) * 100 : 0
  const reviewedCount = quotation.items.filter((item) => itemDecisions[item.id]).length
  const approvedCount = quotation.items.filter((item) => itemDecisions[item.id] === 'approved').length
  const notApprovedCount = quotation.items.filter((item) => itemDecisions[item.id] === 'not-approved').length
  const notApprovedItems = quotation.items.filter((item) => itemDecisions[item.id] === 'not-approved')
  const revisedItems = quotation.items.filter((item) => itemDecisions[item.id] !== 'not-approved')
  const revisedSubtotal = revisedItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
  const revisedVat = quotation.vatEnabled ? revisedSubtotal * 0.12 : 0
  const revisedCharges = quotation.otherCharges.reduce((total, charge) => total + charge.amount, 0)
  const revisedTotal = revisedSubtotal + revisedVat + revisedCharges
  const revisedProfit = revisedItems.reduce((total, item) => total + item.quantity * (item.unitPrice - item.unitCost), 0)
  const canRemoveNotApprovedItems = notApprovedItems.length > 0 && revisedItems.length > 0
  const remainingCount = quotation.items.length - reviewedCount
  const allItemsApproved = quotation.items.length > 0 && approvedCount === quotation.items.length
  const progress = quotation.items.length ? (reviewedCount / quotation.items.length) * 100 : 0
  const warnings = [
    quotation.items.some((item) => item.unitPrice === 0) ? 'One or more items have a zero selling price.' : '',
    quotation.estimatedProfit < 0 ? 'The quotation currently has a negative estimated profit.' : '',
    !quotation.vatEnabled ? 'VAT is not included in this quotation.' : '',
  ].filter(Boolean)

  useEffect(() => {
    if (!approveAllCheckboxRef.current) return
    approveAllCheckboxRef.current.indeterminate = approvedCount > 0 && !allItemsApproved
  }, [allItemsApproved, approvedCount])

  function setItemDecision(itemId: string, decision: ItemDecision) {
    setItemDecisions((current) => ({ ...current, [itemId]: decision }))
    setConfirmed(false)
  }

  function approveAllItems() {
    setItemDecisions(Object.fromEntries(quotation.items.map((item) => [item.id, 'approved' as const])))
    setConfirmed(false)
  }

  function markAllItemsNotApproved() {
    setItemDecisions(Object.fromEntries(quotation.items.map((item) => [item.id, 'not-approved' as const])))
    setConfirmed(false)
  }

  function clearReview() {
    setItemDecisions({})
    setConfirmed(false)
  }

  function confirmItemRemoval() {
    const itemIds = notApprovedItems.map((item) => item.id)
    if (!itemIds.length || !revisedItems.length) return
    setItemDecisions((current) => Object.fromEntries(Object.entries(current).filter(([itemId]) => !itemIds.includes(itemId))))
    setIsRemovalConfirmationOpen(false)
    setConfirmed(false)
    onRemoveItems(itemIds)
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="quotation-approval-title">
    <button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close approval review" />
    <section className="relative my-6 flex max-h-[calc(100svh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[1.6rem] border border-white/20 bg-white shadow-[0_32px_100px_rgba(0,20,76,0.42)]">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon path="m5 12 4 4L19 6" /></span><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Final approval check</p></div>
          <h2 className="mt-3 text-xl font-extrabold tracking-[-0.03em] text-brand-blue" id="quotation-approval-title">Review &amp; approve quotation</h2>
          <p className="mt-1 text-xs text-slate-400">Check every item before you approve the quotation.</p>
        </div>
        <button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/35 px-5 py-5 sm:px-6">
        <div className="grid gap-3 lg:grid-cols-4">
          <Overview label="Quotation" value={quotation.quotationNumber} detail={formatDate(quotation.dateCreated)} tone="blue" />
          <Overview label="Client" value={quotation.clientName} detail={quotation.contactPerson} tone="slate" />
          <Overview label="Project location" value={quotation.projectLocation} detail={quotation.leadTime} tone="violet" />
          <Overview label="Grand total" value={formatPeso(quotation.totalAmount)} detail={`${quotation.items.length} line items`} tone="orange" />
        </div>

        {warnings.length ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4"><div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Icon path="M12 9v4M12 17h.01M10.3 3.6 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.6a2 2 0 0 0-3.4 0Z" /></span><div><p className="text-xs font-extrabold text-amber-800">Review these details</p><ul className="mt-2 space-y-1">{warnings.map((warning) => <li className="text-[10px] font-semibold text-amber-700" key={warning}>• {warning}</li>)}</ul></div></div></div> : null}

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_36px_-32px_rgba(0,20,76,0.45)]">
          <header className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon path="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></span><div><h3 className="text-sm font-extrabold text-brand-blue">Item approval checklist</h3><p className="mt-0.5 text-[10px] text-slate-400">Mark each line as approved or not approved.</p></div></div>
              </div>
              <div className="flex items-center gap-2"><button className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40" type="button" onClick={clearReview} disabled={!reviewedCount}>Clear review</button><label className={`flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-[10px] font-extrabold transition ${allItemsApproved ? 'border-emerald-600 bg-emerald-600 text-white shadow-[0_8px_20px_-12px_rgba(5,150,105,0.8)]' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'}`}><input ref={approveAllCheckboxRef} className="size-4 rounded accent-emerald-600" type="checkbox" checked={allItemsApproved} onChange={(event) => event.target.checked ? approveAllItems() : markAllItemsNotApproved()} /><span>Approve all items</span></label></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold"><p className="text-slate-500"><span className="text-brand-blue">{reviewedCount} of {quotation.items.length}</span> items reviewed</p><div className="flex items-center gap-3"><span className="text-emerald-700">{approvedCount} approved</span>{notApprovedCount ? <span className="text-red-600">{notApprovedCount} not approved</span> : null}{remainingCount ? <span className="text-amber-600">{remainingCount} pending</span> : null}</div></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${reviewedCount} of ${quotation.items.length} items reviewed`}><div className={`h-full rounded-full transition-[width,background-color] duration-300 ${notApprovedCount ? 'bg-red-500' : allItemsApproved ? 'bg-emerald-500' : 'bg-brand-blue'}`} style={{ width: `${progress}%` }} /></div>
          </header>

          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[940px] table-fixed text-left">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_rgba(226,232,240,0.9)]"><tr className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-400"><th className="w-[5%] px-4 py-3 text-center">#</th><th className="w-[27%] px-4 py-3">Item</th><th className="w-[9%] px-4 py-3">Unit</th><th className="w-[8%] px-4 py-3 text-right">Qty</th><th className="w-[13%] px-4 py-3 text-right">Unit price</th><th className="w-[13%] px-4 py-3 text-right">Amount</th><th className="w-[25%] px-4 py-3">Approval</th></tr></thead>
              <tbody>{quotation.items.map((item, index) => {
                const decision = itemDecisions[item.id]
                return <tr className={`border-t border-slate-100 transition-colors ${decision === 'approved' ? 'bg-emerald-50/30' : decision === 'not-approved' ? 'bg-red-50/35' : 'hover:bg-blue-50/25'}`} key={item.id}>
                  <td className="px-4 py-3 text-center text-xs font-extrabold text-brand-blue">{index + 1}</td>
                  <td className="px-4 py-3"><div className="flex min-w-0 items-center gap-3"><ProductPhoto photo={item.photo} name={item.itemName} /><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-700">{item.itemName}</p><p className="mt-1 truncate text-[9px] text-slate-400">{item.productCode || 'No product code'}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</p></div></div></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{item.unitOfMeasure}</td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-slate-600">{formatPeso(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(item.quantity * item.unitPrice)}</td>
                  <td className="px-4 py-3"><label className={`flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border px-3 transition ${decision === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : decision === 'not-approved' ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-500 hover:border-brand-blue/20 hover:bg-blue-50/40'}`}><input className="size-4 shrink-0 rounded accent-emerald-600" type="checkbox" checked={decision === 'approved'} onChange={(event) => setItemDecision(item.id, event.target.checked ? 'approved' : 'not-approved')} /><span className="min-w-0"><span className="block text-[9px] font-extrabold">{decision === 'approved' ? 'Approved' : decision === 'not-approved' ? 'Not approved' : 'Pending review'}</span><span className="mt-0.5 block truncate text-[8px] font-semibold opacity-65">{decision === 'approved' ? 'Included in final quote' : decision === 'not-approved' ? 'Requires correction' : 'Check to approve'}</span></span></label></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        </section>

        {notApprovedCount ? <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 sm:flex-row sm:items-start"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-red-600"><Icon path="M18 6 6 18M6 6l12 12" /></span><div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-red-700">{notApprovedCount} item{notApprovedCount === 1 ? ' is' : 's are'} marked for removal</p><p className="mt-1 text-[10px] leading-4 text-red-600/80">Nothing has been removed yet. Review the affected items and revised quotation total before applying the change.</p></div>{canRemoveNotApprovedItems ? <button className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3.5 text-[10px] font-bold text-white shadow-[0_8px_20px_-12px_rgba(220,38,38,0.8)] transition hover:-translate-y-0.5" type="button" onClick={() => setIsRemovalConfirmationOpen(true)}><Icon className="size-3.5" path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />Review removal</button> : <button className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-2 text-[10px] font-bold text-red-700 transition hover:bg-red-100" type="button" onClick={onEdit}>Keep at least one item</button>}</div> : allItemsApproved ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/65 px-4 py-3"><span className="grid size-8 place-items-center rounded-xl bg-white text-emerald-600"><Icon path="m5 12 4 4L19 6" /></span><div><p className="text-xs font-extrabold text-emerald-800">All quotation items are approved</p><p className="mt-0.5 text-[9px] text-emerald-700/70">Complete the final confirmation below to lock the quotation.</p></div></div> : <div className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/55 px-4 py-3"><span className="grid size-8 place-items-center rounded-xl bg-white text-brand-blue"><Icon path="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></span><div><p className="text-xs font-extrabold text-brand-blue">Review {remainingCount} remaining item{remainingCount === 1 ? '' : 's'}</p><p className="mt-0.5 text-[9px] text-slate-500">Every line needs an explicit decision before final approval.</p></div></div>}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Project and terms</h3><p className="mt-0.5 text-[9px] text-slate-400">Details saved with this quotation</p></div></div><dl className="mt-4 grid gap-3 sm:grid-cols-2"><Detail label="Subject" value={quotation.subject} /><Detail label="Lead time" value={quotation.leadTime} /><div className="sm:col-span-2"><Detail label="Project location" value={quotation.projectLocation} /></div></dl></section>
          <aside className="rounded-2xl bg-[linear-gradient(145deg,#00113f,#073078)] p-4 text-white"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">Price summary</p><div className="mt-4 space-y-2.5 text-xs"><Amount label="Items subtotal" value={quotation.subtotalAmount} /><Amount label="VAT (12%)" value={quotation.vatAmount} muted={!quotation.vatEnabled} />{quotation.otherCharges.map((charge) => <Amount label={charge.label} value={charge.amount} key={charge.id} />)}</div><div className="mt-4 border-t border-white/15 pt-4"><Amount label="Grand total" value={quotation.totalAmount} strong /></div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-4"><div><p className="text-[8px] font-bold uppercase text-white/40">Est. cost</p><p className="mt-1 text-xs font-extrabold">{formatPeso(totalCost)}</p></div><div><p className="text-[8px] font-bold uppercase text-white/40">Est. profit</p><p className={`mt-1 text-xs font-extrabold ${quotation.estimatedProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatPeso(quotation.estimatedProfit)} · {margin.toFixed(1)}%</p></div></div></aside>
        </div>

        <label className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 transition ${allItemsApproved ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${confirmed ? 'border-emerald-200 bg-emerald-50/65' : 'border-slate-200 bg-white'}`}>
          <input className="mt-0.5 size-4 accent-emerald-600" type="checkbox" checked={confirmed} disabled={!allItemsApproved} onChange={(event) => setConfirmed(event.target.checked)} />
          <span><span className="block text-xs font-extrabold text-slate-700">I confirm that every approved item, quantity, price, and term is correct.</span><span className="mt-1 block text-[10px] leading-4 text-slate-400">After approval, the quotation will appear in Sales and Statements of Account.</span></span>
        </label>
      </div>

      <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-[9px] font-semibold text-slate-400">{notApprovedCount ? 'Review and apply the proposed item removal before locking.' : remainingCount ? `${remainingCount} item${remainingCount === 1 ? '' : 's'} still need review.` : confirmed ? 'Ready to approve and lock.' : 'Complete the final confirmation.'}</p>
        <div className="flex justify-end gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onClose}>Cancel</button><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-brand-blue transition hover:bg-blue-50" type="button" onClick={onEdit}><Icon path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />Edit quotation</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#047857,#059669)] px-5 text-xs font-bold text-white shadow-[0_10px_24px_-12px_rgba(5,150,105,0.75)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0" type="button" disabled={!allItemsApproved || !confirmed} onClick={onApprove}><Icon path="m5 12 4 4L19 6" />Approve &amp; lock</button></div>
      </footer>
    </section>
    {isRemovalConfirmationOpen ? <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm animate-[content-enter_160ms_ease-out]" role="alertdialog" aria-modal="true" aria-labelledby="quotation-removal-title" aria-describedby="quotation-removal-description"><button className="absolute inset-0" type="button" onClick={() => setIsRemovalConfirmationOpen(false)} aria-label="Cancel item removal" /><section className="relative my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.45)]"><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-600">Quotation revision</p><h3 className="mt-1.5 text-lg font-extrabold tracking-[-0.025em] text-brand-blue" id="quotation-removal-title">Remove {notApprovedCount} unapproved item{notApprovedCount === 1 ? '' : 's'}?</h3><p className="mt-1 text-[10px] leading-4 text-slate-500" id="quotation-removal-description">These items will be removed only from this quotation. The Items catalog will not be affected.</p></div></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsRemovalConfirmationOpen(false)} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></header><div className="max-h-[calc(100svh-15rem)] overflow-y-auto bg-slate-50/45 p-5 sm:p-6"><div className="overflow-hidden rounded-2xl border border-red-100 bg-white"><div className="border-b border-red-100 bg-red-50/55 px-4 py-3"><p className="text-[10px] font-extrabold text-red-700">Items marked for removal</p></div><div className="max-h-52 divide-y divide-slate-100 overflow-y-auto">{notApprovedItems.map((item) => <div className="flex items-center gap-3 px-4 py-3" key={item.id}><ProductPhoto photo={item.photo} name={item.itemName} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-slate-700">{item.itemName}</p><p className="mt-1 truncate text-[9px] text-slate-400">{item.productCode || 'No product code'}{item.variantLabel ? ` · ${item.variantLabel}` : ''} · {item.quantity} {item.unitOfMeasure}</p></div><strong className="shrink-0 text-xs tabular-nums text-red-600">−{formatPeso(item.quantity * item.unitPrice)}</strong></div>)}</div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Current quotation</p><p className="mt-2 text-lg font-extrabold tabular-nums text-slate-500">{formatPeso(quotation.totalAmount)}</p><p className="mt-1 text-[9px] text-slate-400">{quotation.items.length} line items</p></article><article className="rounded-2xl border border-emerald-200 bg-emerald-50/65 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-600">Revised quotation</p><p className="mt-2 text-lg font-extrabold tabular-nums text-emerald-700">{formatPeso(revisedTotal)}</p><p className="mt-1 text-[9px] text-emerald-600/75">{revisedItems.length} line items · {formatPeso(revisedProfit)} estimated profit</p></article></div><div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-amber-700" path="M12 9v4M12 17h.01M10.3 3.6 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.6a2 2 0 0 0-3.4 0Z" /><p className="text-[10px] leading-4 text-amber-800">Subtotal, {quotation.vatEnabled ? 'VAT, ' : ''}grand total, and estimated profit will be recalculated. Additional charges remain unchanged. This revision will be recorded in System Logs.</p></div></div><footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={() => setIsRemovalConfirmationOpen(false)}>Keep items</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white shadow-[0_10px_24px_-12px_rgba(220,38,38,0.8)] transition hover:-translate-y-0.5" type="button" onClick={confirmItemRemoval}><Icon className="size-3.5" path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />Remove &amp; update quotation</button></footer></section></div> : null}
  </div>
}

function Overview({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'slate' | 'violet' | 'orange' }) {
  const tones = { blue: 'border-blue-100 bg-blue-50/60', slate: 'border-slate-200 bg-white', violet: 'border-violet-100 bg-violet-50/60', orange: 'border-orange-100 bg-orange-50/60' }
  return <article className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">{label}</p><p className="mt-2 truncate text-sm font-extrabold text-brand-blue">{value}</p><p className="mt-1 truncate text-[9px] font-semibold text-slate-400">{detail}</p></article>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50/70 p-3"><dt className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt><dd className="mt-1.5 text-xs font-bold leading-5 text-slate-600">{value}</dd></div>
}

function Amount({ label, value, muted = false, strong = false }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${muted ? 'text-white/30' : 'text-white/65'}`}><span className={strong ? 'font-extrabold text-white' : ''}>{label}</span><strong className={`${strong ? 'text-base' : ''} tabular-nums text-white`}>{formatPeso(value)}</strong></div>
}
