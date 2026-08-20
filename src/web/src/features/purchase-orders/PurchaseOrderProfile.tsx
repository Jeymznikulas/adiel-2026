import { WorkflowHeader, type WorkflowHeaderAction } from '../../components/ui/WorkflowHeader'
import type { PurchaseOrder, PurchaseOrderDeliveryStatus, PurchaseOrderDocumentStatus, PurchaseOrderPaymentStatus } from './PurchaseOrdersPage'

type PurchaseOrderProfileProps = {
  order: PurchaseOrder
  onBack: () => void
  onEdit: () => void
  onExport: () => void
  onArchive: () => void
  onVoid: () => void
  onLinkProject: () => void
  onOpenExpense: () => void
  onDocumentStatusChange: (status: PurchaseOrderDocumentStatus) => void
  onDeliveryStatusChange: (status: PurchaseOrderDeliveryStatus) => void
  onPaymentStatusChange: (status: PurchaseOrderPaymentStatus) => void
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
  if (status === 'Paid' || status === 'Delivered' || status === 'Sent') return 'border-emerald-100 bg-emerald-50/55 text-emerald-700'
  if (status === 'Overdue' || status === 'Cancelled') return 'border-red-100 bg-red-50/55 text-red-600'
  if (status === 'To Pay' || status === 'Partially Delivered') return 'border-amber-100 bg-amber-50/55 text-amber-700'
  return 'border-slate-200 bg-slate-50/65 text-slate-600'
}

export function PurchaseOrderProfile({ order, onBack, onEdit, onExport, onArchive, onVoid, onLinkProject, onOpenExpense, onDocumentStatusChange, onDeliveryStatusChange, onPaymentStatusChange }: PurchaseOrderProfileProps) {
  const isCancelled = order.documentStatus === 'Cancelled'
  const workflowStep = isCancelled ? 0 : order.documentStatus === 'Draft' ? 0 : order.deliveryStatus !== 'Delivered' ? 2 : order.paymentStatus === 'Paid' ? 4 : 3
  let primaryAction: WorkflowHeaderAction | undefined
  let secondaryActions: WorkflowHeaderAction[] = []

  if (!isCancelled && order.documentStatus === 'Draft') primaryAction = { label: 'Send Purchase Order', onClick: () => onDocumentStatusChange('Sent') }
  else if (!isCancelled && order.deliveryStatus !== 'Delivered') {
    primaryAction = { label: 'Mark Delivered', onClick: () => onDeliveryStatusChange('Delivered') }
    if (order.deliveryStatus === 'Pending') secondaryActions = [{ label: 'Partially Delivered', onClick: () => onDeliveryStatusChange('Partially Delivered') }]
  } else if (!isCancelled && order.paymentStatus === 'Not Due') primaryAction = { label: 'Mark To Pay', onClick: () => onPaymentStatusChange('To Pay') }
  else if (!isCancelled && (order.paymentStatus === 'To Pay' || order.paymentStatus === 'Overdue')) {
    primaryAction = { label: 'Mark Paid', onClick: () => onPaymentStatusChange('Paid') }
    secondaryActions = [{ label: 'View related expense', onClick: onOpenExpense }]
  }

  return <div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <button className="group inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-400 transition hover:bg-white hover:text-brand-blue" type="button" onClick={onBack}><Icon className="size-3.5 transition-transform group-hover:-translate-x-0.5" path="m15 18-6-6 6-6" />Back to purchase orders</button>
    <WorkflowHeader
      eyebrow="Purchase order"
      recordNumber={order.poNumber}
      partyName={order.supplierName}
      amount={formatPeso(order.totalAmount)}
      createdLabel={`Created ${formatDate(order.date)}`}
      status={isCancelled ? 'Cancelled' : order.documentStatus === 'Draft' ? 'Draft' : order.paymentStatus === 'Paid' && order.deliveryStatus === 'Delivered' ? 'Closed' : 'In progress'}
      steps={['Draft', 'Sent', 'Delivery', 'Payment', 'Closed']}
      currentStep={workflowStep}
      module="Purchase Orders"
      recordId={order.id}
      badges={[
        { label: `Document: ${order.documentStatus}`, tone: order.documentStatus === 'Cancelled' ? 'red' : order.documentStatus === 'Sent' ? 'green' : 'slate' },
        { label: `Delivery: ${order.deliveryStatus}`, tone: order.deliveryStatus === 'Delivered' ? 'green' : order.deliveryStatus === 'Partially Delivered' ? 'amber' : 'blue' },
        { label: `Payment: ${order.paymentStatus}`, tone: order.paymentStatus === 'Paid' ? 'green' : order.paymentStatus === 'Overdue' ? 'red' : order.paymentStatus === 'To Pay' ? 'amber' : 'slate' },
      ]}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      menuActions={[
        { label: 'Edit', onClick: onEdit, disabled: isCancelled },
        { label: 'Preview & Export', onClick: onExport },
        { label: order.quotationNumber ? `Project: ${order.quotationNumber}` : 'Link project', onClick: onLinkProject, disabled: isCancelled },
        ...(order.addedToExpenses ? [{ label: 'View related expense', onClick: onOpenExpense }] : []),
        { label: 'Archive', onClick: onArchive },
        ...(!isCancelled ? [{ label: 'Void', tone: 'danger' as const, onClick: onVoid }] : []),
      ]}
    >
      <p className="text-sm leading-6 text-slate-500">For {order.clientName}{order.subject ? ` · ${order.subject}` : ''}</p>
    </WorkflowHeader>

    <section className="grid gap-3 lg:grid-cols-3">
      <article className={`rounded-2xl border p-4 ${statusCardTone(order.documentStatus)}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">Document status</p><p className="mt-2 text-base font-extrabold">{order.documentStatus}</p><p className="mt-1 text-[10px] opacity-75">{order.documentStatus === 'Draft' ? 'Not yet sent to the supplier.' : order.documentStatus === 'Sent' ? 'Supplier order has been issued.' : 'This order is no longer active.'}</p>{order.documentStatus === 'Draft' ? <button className="mt-3 h-8 rounded-lg bg-white px-3 text-[10px] font-bold shadow-sm" type="button" onClick={() => onDocumentStatusChange('Sent')}>Mark sent</button> : null}</article>
      <article className={`rounded-2xl border p-4 ${statusCardTone(order.deliveryStatus)}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">Delivery status</p><p className="mt-2 text-base font-extrabold">{order.deliveryStatus}</p><p className="mt-1 text-[10px] opacity-75">{order.modeOfDelivery} · {order.deliveryLocation}</p>{!isCancelled && order.documentStatus === 'Sent' && order.deliveryStatus !== 'Delivered' ? <div className="mt-3 flex gap-2">{order.deliveryStatus === 'Pending' ? <button className="h-8 rounded-lg bg-white px-3 text-[10px] font-bold shadow-sm" type="button" onClick={() => onDeliveryStatusChange('Partially Delivered')}>Partial</button> : null}<button className="h-8 rounded-lg bg-white px-3 text-[10px] font-bold shadow-sm" type="button" onClick={() => onDeliveryStatusChange('Delivered')}>Delivered</button></div> : null}</article>
      <article className={`rounded-2xl border p-4 ${statusCardTone(order.paymentStatus)}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">Payment status</p><p className="mt-2 text-base font-extrabold">{order.paymentStatus}</p><p className="mt-1 text-[10px] opacity-75">{order.modeOfPayment} · {order.paymentTerm}</p>{!isCancelled && order.deliveryStatus === 'Delivered' ? <div className="mt-3 flex flex-wrap gap-2">{order.paymentStatus === 'Not Due' ? <button className="h-8 rounded-lg bg-white px-3 text-[10px] font-bold shadow-sm" type="button" onClick={() => onPaymentStatusChange('To Pay')}>Mark to pay</button> : null}{order.paymentStatus === 'To Pay' ? <button className="h-8 rounded-lg bg-white px-3 text-[10px] font-bold shadow-sm" type="button" onClick={() => onPaymentStatusChange('Overdue')}>Mark overdue</button> : null}{order.paymentStatus === 'To Pay' || order.paymentStatus === 'Overdue' ? <button className="h-8 rounded-lg bg-white px-3 text-[10px] font-bold shadow-sm" type="button" onClick={() => onPaymentStatusChange('Paid')}>Mark paid</button> : null}{order.addedToExpenses ? <button className="h-8 rounded-lg bg-white px-3 text-[10px] font-bold shadow-sm" type="button" onClick={onOpenExpense}>View expense</button> : null}</div> : null}</article>
    </section>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Ordered items</h3><p className="mt-1 text-[10px] text-slate-400">{order.items.length} line item{order.items.length === 1 ? '' : 's'} from {order.supplierName}</p></div><strong className="text-lg text-brand-blue">{formatPeso(order.totalAmount)}</strong></header><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-5 py-3">Item</th><th className="px-5 py-3">Unit</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-right">Unit cost</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody>{order.items.map((item) => <tr className="border-t border-slate-100" key={item.id}><td className="px-5 py-4"><p className="text-xs font-extrabold text-slate-700">{item.itemName}</p><p className="mt-1 text-[9px] text-slate-400">{item.productCode}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</p></td><td className="px-5 py-4 text-xs text-slate-500">{item.unitOfMeasure}</td><td className="px-5 py-4 text-right text-xs tabular-nums text-slate-600">{item.quantity}</td><td className="px-5 py-4 text-right text-xs tabular-nums text-slate-600">{formatPeso(item.unitCost)}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(item.quantity * item.unitCost)}</td></tr>)}</tbody></table></div></section>
  </div>
}
