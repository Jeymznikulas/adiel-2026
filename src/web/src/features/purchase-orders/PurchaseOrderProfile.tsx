import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { FormErrorSummary } from '../../components/ui/FormErrorSummary'
import { WorkflowHeader, type WorkflowHeaderAction } from '../../components/ui/WorkflowHeader'
import type { PurchaseOrder, PurchaseOrderDeliveryStatus, PurchaseOrderDocumentStatus, PurchaseOrderPaymentStatus } from './PurchaseOrdersPage'
import { PurchaseOrderPaymentDialog, type PurchaseOrderPaymentInput } from './PurchaseOrderPaymentDialog'
import { PurchaseOrderRevisionDialog } from './PurchaseOrderRevisionDialog'
import { PurchaseOrderStatusCorrectionDialog } from './PurchaseOrderStatusCorrectionDialog'

type Props = {
  order: PurchaseOrder
  onBack: () => void
  onEdit: () => void
  onExport: () => void
  onArchive: () => void
  onVoid: () => void
  onLinkProject: () => void
  onOpenExpense: () => void
  onDocumentStatusChange: (status: PurchaseOrderDocumentStatus, reason?: string) => Promise<boolean>
  onDeliveryStatusChange: (status: PurchaseOrderDeliveryStatus, reason?: string) => Promise<boolean>
  onPaymentStatusChange: (status: PurchaseOrderPaymentStatus, reason?: string) => Promise<boolean>
  onRecordPayment: (payment: PurchaseOrderPaymentInput) => Promise<boolean>
  error?: string
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function statusCardTone(status: string) {
  if (status === 'Paid' || status === 'Delivered' || status === 'Approved') return 'border-emerald-100 bg-emerald-50/55 text-emerald-700'
  if (status === 'Overdue' || status === 'Cancelled') return 'border-red-100 bg-red-50/55 text-red-600'
  if (status === 'For Revision' || status === 'To Pay' || status === 'Partially Paid' || status === 'Partially Delivered') return 'border-amber-100 bg-amber-50/55 text-amber-700'
  if (status === 'Sent') return 'border-sky-100 bg-sky-50/55 text-sky-700'
  return 'border-slate-200 bg-slate-50/65 text-slate-600'
}

function IndependentProgress({ label, steps, current, iconPath }: { label: string; steps: string[]; current: string; iconPath: string }) {
  const activeIndex = current === 'Overdue' ? 1 : Math.max(0, steps.indexOf(current))
  return <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3.5 shadow-[0_14px_30px_-25px_rgba(0,20,76,0.6)] ring-1 ring-inset ring-slate-100/70">
    <div className="mb-3 flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[linear-gradient(145deg,#eef3ff,#ffffff)] text-brand-blue shadow-sm"><Icon className="size-3.5" path={iconPath} /></span><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-brand-blue">{label} progress</p></div>
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>{steps.map((step, index) => { const complete = index < activeIndex; const active = index === activeIndex; return <li className="relative text-center" key={step}>{index ? <span className={`absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${index <= activeIndex ? 'bg-[linear-gradient(90deg,#00144c,#0ea5e9)]' : 'bg-slate-200'}`} aria-hidden="true" /> : null}<span className={`relative mx-auto grid size-6 place-items-center rounded-full border-2 transition ${complete ? 'border-brand-blue bg-brand-blue text-white' : active ? 'border-brand-orange bg-orange-50 text-brand-orange shadow-[0_0_0_4px_rgba(253,77,0,0.08)]' : 'border-slate-200 bg-white text-slate-300'}`}><Icon className="size-3" path={complete ? 'm5 12 4 4L19 6' : active ? iconPath : 'M12 12h.01'} /></span><span className={`mt-2 block truncate px-1 text-[9px] font-bold ${active || complete ? 'text-brand-blue' : 'text-slate-400'}`}>{step}</span></li> })}</ol>
    {current === 'Overdue' ? <p className="mt-3 rounded-lg bg-rose-50 px-2.5 py-2 text-center text-[9px] font-extrabold text-rose-600">Payment is overdue</p> : null}
  </div>
}

const truckIcon = 'M3 7h11v10H3V7Zm11 3h4l3 3v4h-7v-7'
const paymentIcon = 'M2 7h20v12H2V7Zm0 4h20M6 15h4'

export function PurchaseOrderProfile({ order, onBack, onEdit, onExport, onArchive, onVoid, onLinkProject, onOpenExpense, onDocumentStatusChange, onDeliveryStatusChange, onPaymentStatusChange, onRecordPayment, error = '' }: Props) {
  const isCancelled = order.documentStatus === 'Cancelled'
  const canFulfill = !isCancelled && order.documentStatus !== 'Draft'
  const payments = order.payments ?? []
  const totalPaid = Number.isFinite(order.totalPaid) ? order.totalPaid : payments.reduce((total, payment) => total + payment.amount, 0)
  const balance = Number.isFinite(order.balance) ? order.balance : Math.max(0, order.totalAmount - totalPaid)
  const [correctionTrack, setCorrectionTrack] = useState<'Delivery' | 'Payment' | null>(null)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isRevisionOpen, setIsRevisionOpen] = useState(false)
  const workflowStep = order.documentStatus === 'Draft' || isCancelled ? 0 : order.documentStatus === 'Approved' ? 2 : 1
  const deliveryCorrectionOptions = order.deliveryStatus === 'Delivered' ? [{ value: 'Partially Delivered', label: 'Partially Delivered' }, { value: 'Pending', label: 'Pending' }] : order.deliveryStatus === 'Partially Delivered' ? [{ value: 'Pending', label: 'Pending' }] : []
  const paymentCorrectionOptions = payments.length ? order.paymentStatus === 'Overdue' ? [{ value: 'Partially Paid', label: 'Partially Paid' }] : [] : order.paymentStatus === 'Overdue' ? [{ value: 'To Pay', label: 'To Pay' }, { value: 'Not Due', label: 'Not Due' }] : order.paymentStatus === 'To Pay' ? [{ value: 'Not Due', label: 'Not Due' }] : []
  let primaryAction: WorkflowHeaderAction | undefined

  if (order.documentStatus === 'Draft') primaryAction = { label: 'Send Purchase Order', onClick: () => void onDocumentStatusChange('Sent') }
  else if (order.documentStatus === 'Sent') primaryAction = { label: 'Approve Purchase Order', onClick: () => void onDocumentStatusChange('Approved') }
  else if (order.documentStatus === 'For Revision') primaryAction = { label: 'Edit & Resend', onClick: onEdit }

  return <><div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <Button variant="ghost" size="small" leadingIcon={<Icon path="m15 18-6-6 6-6" />} onClick={onBack}>Back to purchase orders</Button>
    <FormErrorSummary message={error} />
    <WorkflowHeader
      eyebrow="Purchase order"
      recordNumber={order.poNumber}
      partyName={order.supplierName}
      amount={formatPeso(order.totalAmount)}
      createdLabel={`Created ${formatDate(order.date)}`}
      status={isCancelled ? 'Cancelled' : order.paymentStatus === 'Paid' && order.deliveryStatus === 'Delivered' ? 'Closed' : order.documentStatus}
      steps={['Draft', order.documentStatus === 'For Revision' ? 'For Revision' : 'Sent', 'Approved']}
      currentStep={workflowStep}
      module="Purchase Orders"
      recordId={order.id}
      badges={[
        { label: `Document: ${order.documentStatus}`, tone: order.documentStatus === 'Cancelled' ? 'red' : order.documentStatus === 'Approved' ? 'green' : order.documentStatus === 'For Revision' ? 'amber' : order.documentStatus === 'Sent' ? 'blue' : 'slate' },
        { label: `Delivery: ${order.deliveryStatus}`, tone: order.deliveryStatus === 'Delivered' ? 'green' : order.deliveryStatus === 'Partially Delivered' ? 'amber' : 'blue' },
        { label: `Payment: ${order.paymentStatus}`, tone: order.paymentStatus === 'Paid' ? 'green' : order.paymentStatus === 'Overdue' ? 'red' : order.paymentStatus === 'To Pay' || order.paymentStatus === 'Partially Paid' ? 'amber' : 'slate' },
      ]}
      primaryAction={primaryAction}
      secondaryActions={order.documentStatus === 'Sent' || order.documentStatus === 'Approved' ? [{ label: 'For Revision', onClick: () => setIsRevisionOpen(true) }] : []}
      menuActions={[
        { label: 'Edit', onClick: onEdit, disabled: isCancelled || order.documentStatus === 'Approved' },
        { label: 'Preview & Export', onClick: onExport },
        { label: order.quotationNumber ? `Project: ${order.quotationNumber}` : 'Link project', onClick: onLinkProject, disabled: isCancelled },
        ...(order.addedToExpenses ? [{ label: 'View related expense', onClick: onOpenExpense }] : []),
        { label: 'Archive', onClick: onArchive },
        ...(!isCancelled ? [{ label: 'Void', tone: 'danger' as const, onClick: onVoid }] : []),
      ]}
    >
      <p className="text-sm leading-6 text-slate-500">For {order.clientName}{order.subject ? ` · ${order.subject}` : ''}. Document review, delivery, and payment are tracked independently.</p>
    </WorkflowHeader>

    <section className="grid gap-3 lg:grid-cols-3">
      <article className={`rounded-[1.35rem] border p-4 shadow-[0_14px_34px_-30px_rgba(0,20,76,0.5)] ${statusCardTone(order.documentStatus)}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">Document review</p><p className="mt-2 text-base font-extrabold">{order.documentStatus}</p><p className="mt-1 text-[10px] leading-4 opacity-75">{order.documentStatus === 'Draft' ? 'Prepare and send this PO.' : order.documentStatus === 'Sent' ? 'Waiting for review and approval.' : order.documentStatus === 'Approved' ? 'Approved and locked from direct edits.' : order.documentStatus === 'For Revision' ? 'Editable; update and resend for review.' : 'This order is no longer active.'}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm"><Icon path="M5 3h14v18H5V3Zm4 5h6M9 12h6M9 16h4" /></span></div><div className="mt-4 flex flex-wrap gap-2">{order.documentStatus === 'Draft' ? <Button size="small" variant="primary" onClick={() => void onDocumentStatusChange('Sent')}>Send for review</Button> : null}{order.documentStatus === 'Sent' ? <><Button size="small" variant="primary" leadingIcon={<Icon path="m5 12 4 4L19 6" />} onClick={() => void onDocumentStatusChange('Approved')}>Approve</Button><Button size="small" variant="secondary" onClick={() => setIsRevisionOpen(true)}>For revision</Button></> : null}{order.documentStatus === 'Approved' ? <Button size="small" variant="secondary" onClick={() => setIsRevisionOpen(true)}>Request revision</Button> : null}{order.documentStatus === 'For Revision' ? <><Button size="small" variant="primary" leadingIcon={<Icon path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />} onClick={onEdit}>Edit PO</Button><Button size="small" variant="secondary" onClick={() => void onDocumentStatusChange('Sent')}>Resend</Button></> : null}</div></article>

      <article className={`rounded-[1.35rem] border p-4 shadow-[0_14px_34px_-30px_rgba(0,20,76,0.5)] ${statusCardTone(order.deliveryStatus)}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">Delivery status</p><p className="mt-2 text-base font-extrabold">{order.deliveryStatus}</p><p className="mt-1 text-[10px] opacity-75">{order.modeOfDelivery} · {order.deliveryLocation}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm"><Icon path={`${truckIcon}M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z`} /></span></div><IndependentProgress label="Delivery" steps={['Pending', 'Partially Delivered', 'Delivered']} current={order.deliveryStatus} iconPath={truckIcon} />{canFulfill ? <div className="mt-3 flex flex-wrap gap-2">{order.deliveryStatus === 'Pending' ? <Button size="small" variant="secondary" onClick={() => void onDeliveryStatusChange('Partially Delivered')}>Partially delivered</Button> : null}{order.deliveryStatus !== 'Delivered' ? <Button size="small" variant="primary" leadingIcon={<Icon path="m5 12 4 4L19 6" />} onClick={() => void onDeliveryStatusChange('Delivered')}>Mark delivered</Button> : null}{deliveryCorrectionOptions.length ? <Button size="small" variant="ghost" onClick={() => setCorrectionTrack('Delivery')}>Correct status</Button> : null}</div> : null}</article>

      <article className={`rounded-[1.35rem] border p-4 shadow-[0_14px_34px_-30px_rgba(0,20,76,0.5)] ${statusCardTone(order.paymentStatus)}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">Payment status</p><p className="mt-2 text-base font-extrabold">{order.paymentStatus}</p><p className="mt-1 text-[10px] opacity-75">{order.modeOfPayment} · {order.paymentTerm}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm"><Icon path={paymentIcon} /></span></div><IndependentProgress label="Payment" steps={['Not Due', 'To Pay', 'Partially Paid', 'Paid']} current={order.paymentStatus} iconPath={paymentIcon} /><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/70 bg-white/60 p-3"><div><p className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-60">Paid</p><p className="mt-1 text-xs font-extrabold">{formatPeso(totalPaid)}</p></div><div><p className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-60">Balance</p><p className="mt-1 text-xs font-extrabold">{formatPeso(balance)}</p></div></div>{canFulfill ? <div className="mt-3 flex flex-wrap gap-2">{order.paymentStatus === 'Not Due' ? <Button size="small" variant="secondary" onClick={() => void onPaymentStatusChange('To Pay')}>Mark to pay</Button> : null}{balance > 0 ? <Button size="small" variant="primary" leadingIcon={<Icon path="M12 5v14M5 12h14" />} onClick={() => setIsPaymentOpen(true)}>Record payment</Button> : null}{order.paymentStatus === 'To Pay' || order.paymentStatus === 'Partially Paid' ? <Button size="small" variant="secondary" onClick={() => void onPaymentStatusChange('Overdue')}>Mark overdue</Button> : null}{paymentCorrectionOptions.length ? <Button size="small" variant="ghost" onClick={() => setCorrectionTrack('Payment')}>Correct status</Button> : null}{order.addedToExpenses ? <Button size="small" variant="ghost" onClick={onOpenExpense}>View expense</Button> : null}</div> : null}</article>
    </section>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Payment history</h3><p className="mt-1 text-[10px] text-slate-400">Amounts, payment dates, references, and balance after each entry</p></div>{canFulfill && balance > 0 ? <Button size="small" variant="primary" leadingIcon={<Icon path="M12 5v14M5 12h14" />} onClick={() => setIsPaymentOpen(true)}>Record payment</Button> : <strong className="text-sm text-emerald-700">{balance === 0 ? 'Fully paid' : formatPeso(balance)}</strong>}</header>{payments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-5 py-3">Payment date</th><th className="px-5 py-3">Method / reference</th><th className="px-5 py-3">Notes</th><th className="px-5 py-3 text-right">Amount paid</th><th className="px-5 py-3 text-right">Balance after</th></tr></thead><tbody>{payments.map((payment) => <tr className="border-t border-slate-100 transition hover:bg-blue-50/25" key={payment.id}><td className="px-5 py-4 text-xs font-extrabold text-slate-700">{formatDate(payment.paymentDate)}</td><td className="px-5 py-4"><p className="text-xs font-bold text-brand-blue">{payment.method}</p><p className="mt-1 text-[9px] text-slate-400">{payment.referenceNumber || 'No reference'}</p></td><td className="max-w-xs px-5 py-4 text-[10px] text-slate-500">{payment.notes || '—'}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-emerald-700">{formatPeso(payment.amount)}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-amber-700">{formatPeso(payment.balanceAfter)}</td></tr>)}</tbody></table></div> : <div className="grid min-h-32 place-items-center p-6 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-300"><Icon path={paymentIcon} /></span><p className="mt-3 text-xs font-extrabold text-brand-blue">No payments recorded</p><p className="mt-1 text-[10px] text-slate-400">Partial and full payments will appear here.</p></div></div>}</section>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Ordered items</h3><p className="mt-1 text-[10px] text-slate-400">{order.items.length} line item{order.items.length === 1 ? '' : 's'} from {order.supplierName}</p></div><strong className="text-lg text-brand-blue">{formatPeso(order.totalAmount)}</strong></header><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-5 py-3">Item</th><th className="px-5 py-3">Unit</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-right">Unit cost</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody>{order.items.map((item) => <tr className="border-t border-slate-100" key={item.id}><td className="px-5 py-4"><p className="text-xs font-extrabold text-slate-700">{item.itemName}</p><p className="mt-1 text-[9px] text-slate-400">{item.productCode}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</p></td><td className="px-5 py-4 text-xs text-slate-500">{item.unitOfMeasure}</td><td className="px-5 py-4 text-right text-xs tabular-nums text-slate-600">{item.quantity}</td><td className="px-5 py-4 text-right text-xs tabular-nums text-slate-600">{formatPeso(item.unitCost)}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(item.quantity * item.unitCost)}</td></tr>)}</tbody></table></div></section>
  </div>
  {correctionTrack ? <PurchaseOrderStatusCorrectionDialog track={correctionTrack} currentStatus={correctionTrack === 'Delivery' ? order.deliveryStatus : order.paymentStatus} options={correctionTrack === 'Delivery' ? deliveryCorrectionOptions : paymentCorrectionOptions} onClose={() => setCorrectionTrack(null)} onConfirm={(status, reason) => correctionTrack === 'Delivery' ? onDeliveryStatusChange(status as PurchaseOrderDeliveryStatus, reason) : onPaymentStatusChange(status as PurchaseOrderPaymentStatus, reason)} /> : null}
  {isPaymentOpen ? <PurchaseOrderPaymentDialog poNumber={order.poNumber} total={order.totalAmount} paid={totalPaid} balance={balance} defaultMethod={order.modeOfPayment} onClose={() => setIsPaymentOpen(false)} onConfirm={onRecordPayment} /> : null}
  {isRevisionOpen ? <PurchaseOrderRevisionDialog onClose={() => setIsRevisionOpen(false)} onConfirm={(reason) => onDocumentStatusChange('For Revision', reason)} /> : null}</>
}
