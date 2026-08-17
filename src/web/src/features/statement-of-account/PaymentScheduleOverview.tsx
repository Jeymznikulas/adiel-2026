import { lateChargeProgress, statementScheduleProgress } from './latePayment'
import type { StatementOfAccount } from './statementOfAccountTypes'

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function tone(status: string) {
  if (status === 'Paid') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'Partially paid' || status === 'Due today' || status === 'Grace period') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (status === 'Overdue') return 'border-red-100 bg-red-50 text-red-600'
  return 'border-sky-100 bg-sky-50 text-sky-700'
}

type Props = {
  statement: StatementOfAccount
  onReviewLateCharge?: (scheduleEntryId: string) => void
}

export function PaymentScheduleOverview({ statement, onReviewLateCharge }: Props) {
  const progress = statementScheduleProgress(statement)
  const charges = lateChargeProgress(statement)
  const nextPayment = progress.find((entry) => entry.balance > 0.009)
  const paidCount = progress.filter((entry) => entry.status === 'Paid').length

  return <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
    <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="text-sm font-extrabold text-brand-blue">Payment arrangement</h3><p className="mt-1 text-[10px] text-slate-400">Principal is applied oldest-first. Late charges remain separate and can be reviewed per overdue payment.</p></div>
      <span className="inline-flex rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{statement.paymentArrangement}{statement.paymentArrangement === 'Installment' ? ` · ${statement.paymentFrequency}` : ''}</span>
    </header>
    <div className="grid gap-3 border-b border-slate-100 bg-slate-50/35 p-4 sm:grid-cols-3">
      <article className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Schedule progress</p><p className="mt-2 text-lg font-extrabold text-brand-blue">{paidCount} of {progress.length}</p><p className="mt-1 text-[9px] text-slate-400">payments completed</p></article>
      <article className="rounded-xl border border-sky-100 bg-sky-50/60 p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-sky-600">Next payment</p><p className="mt-2 text-lg font-extrabold text-sky-700">{nextPayment ? formatPeso(nextPayment.balance) : 'Fully paid'}</p><p className="mt-1 text-[9px] text-sky-600/70">{nextPayment ? `Due ${formatDate(nextPayment.dueDate)}` : 'No remaining schedule'}</p></article>
      <article className="rounded-xl border border-emerald-100 bg-emerald-50/55 p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-600">Received</p><p className="mt-2 text-lg font-extrabold text-emerald-700">{formatPeso(statement.totalPayments)}</p><p className="mt-1 text-[9px] text-emerald-600/70">Payments recorded on this SOA</p></article>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left"><thead><tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-5 py-3.5">Payment</th><th className="px-5 py-3.5">Due date</th><th className="px-5 py-3.5 text-right">Scheduled</th><th className="px-5 py-3.5 text-right">Applied</th><th className="px-5 py-3.5 text-right">Principal due</th><th className="px-5 py-3.5 text-right">Late charge</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Action</th></tr></thead>
      <tbody>{progress.map((entry) => {
        const charge = charges.find((item) => item.scheduleEntryId === entry.id)
        const reviewed = statement.lateCharges.find((item) => item.scheduleEntryId === entry.id)
        const canReview = entry.status === 'Overdue' || Boolean(reviewed)
        return <tr className="border-t border-slate-100" key={entry.id}><td className="px-5 py-4 text-xs font-extrabold text-slate-700">{entry.label}</td><td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDate(entry.dueDate)}{entry.daysLate ? <span className="ml-2 text-[9px] font-bold text-red-500">{entry.daysLate}d late</span> : null}</td><td className="px-5 py-4 text-right text-xs font-bold tabular-nums text-brand-blue">{formatPeso(entry.amount)}</td><td className="px-5 py-4 text-right text-xs font-bold tabular-nums text-emerald-700">{formatPeso(entry.amountPaid)}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-amber-700">{formatPeso(entry.balance)}</td><td className="px-5 py-4 text-right text-xs font-extrabold tabular-nums text-red-600">{charge ? formatPeso(charge.balance) : reviewed?.status === 'Waived' ? 'Waived' : '—'}</td><td className="px-5 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-[9px] font-bold ${tone(entry.status)}`}>{entry.status}</span></td><td className="px-5 py-4 text-right">{canReview && onReviewLateCharge ? <button className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[9px] font-bold text-brand-blue hover:bg-blue-50" type="button" onClick={() => onReviewLateCharge(entry.id)}>{reviewed ? 'Edit charge' : 'Review charge'}</button> : <span className="text-[9px] text-slate-300">No action</span>}</td></tr>
      })}</tbody>
    </table></div>
  </section>
}
