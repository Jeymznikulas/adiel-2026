import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { appendSystemLog } from '../../services/activityLog'

type ClientStatus = 'Active' | 'Inactive'
type TransactionStatus = 'Paid' | 'Pending' | 'Overdue' | 'Completed' | 'Cancelled'
type TransactionType = 'Quotation' | 'Invoice' | 'Payment' | 'Project' | 'Service' | 'Other'

type ClientContact = {
  id: string
  name: string
  email: string
  phone: string
}

type ClientTransaction = {
  id: string
  date: string
  type: TransactionType
  referenceNumber: string
  amount: number
  status: TransactionStatus
  notes: string
}

type Client = {
  id: string
  photo: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  industry: string
  clientSince: string
  status: ClientStatus
  contacts: ClientContact[]
  transactions: ClientTransaction[]
  createdAt: string
  updatedAt: string
}

type ClientDraft = Omit<Client, 'id' | 'transactions' | 'createdAt' | 'updatedAt'>
type TransactionDraft = Omit<ClientTransaction, 'id' | 'amount'> & { amount: string }
type ClientsPageProps = { currentUsername: string }

const storageKey = 'adiel.clients'
const defaultIndustries = ['Construction', 'Retail', 'Real estate', 'Manufacturing', 'Hospitality', 'Government', 'Education', 'Healthcare', 'Professional services', 'Other']
const statusOptions = [{ value: 'Active' as const }, { value: 'Inactive' as const }]
const transactionStatusOptions = ['Paid', 'Pending', 'Overdue', 'Completed', 'Cancelled'].map((value) => ({ value: value as TransactionStatus }))
const transactionTypeOptions = ['Quotation', 'Invoice', 'Payment', 'Project', 'Service', 'Other'].map((value) => ({ value: value as TransactionType }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  if (!value) return 'Not provided'
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function initials(value: string) {
  return value.split(/\s+/).map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'CL'
}

function createEmptyClient(): ClientDraft {
  const contact = createEmptyContact()
  return { photo: '', name: '', contactPerson: '', email: '', phone: '', address: '', industry: 'Construction', clientSince: new Date().toISOString().slice(0, 10), status: 'Active', contacts: [contact] }
}

function createEmptyContact(): ClientContact {
  return { id: crypto.randomUUID(), name: '', email: '', phone: '' }
}

function createEmptyTransaction(): TransactionDraft {
  return { date: new Date().toISOString().slice(0, 10), type: 'Invoice', referenceNumber: '', amount: '', status: 'Pending', notes: '' }
}

function loadClients(): Client[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const client = value as Partial<Client>
      if (typeof client.id !== 'string' || typeof client.name !== 'string') return []
      const legacyClient = value as Partial<Client> & { contactPerson?: string; email?: string; phone?: string }
      const contacts = Array.isArray(client.contacts) ? (client.contacts as unknown[]).flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const contact = entry as Partial<ClientContact>
        if (typeof contact.id !== 'string' || typeof contact.name !== 'string') return []
        return [{ id: contact.id, name: contact.name, email: typeof contact.email === 'string' ? contact.email : '', phone: typeof contact.phone === 'string' ? contact.phone : '' }]
      }) : []
      if (!contacts.length && typeof legacyClient.contactPerson === 'string') contacts.push({ id: crypto.randomUUID(), name: legacyClient.contactPerson, email: typeof legacyClient.email === 'string' ? legacyClient.email : '', phone: typeof legacyClient.phone === 'string' ? legacyClient.phone : '' })
      const primaryContact = contacts[0]
      const transactions = Array.isArray(client.transactions) ? (client.transactions as unknown[]).flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const transaction = entry as Partial<ClientTransaction>
        if (typeof transaction.id !== 'string' || typeof transaction.date !== 'string' || typeof transaction.referenceNumber !== 'string') return []
        return [{
          id: transaction.id,
          date: transaction.date,
          type: typeof transaction.type === 'string' ? transaction.type : 'Other',
          referenceNumber: transaction.referenceNumber,
          amount: typeof transaction.amount === 'number' ? transaction.amount : 0,
          status: typeof transaction.status === 'string' ? transaction.status : 'Pending',
          notes: typeof transaction.notes === 'string' ? transaction.notes : '',
        }]
      }) : []
      const normalizedClient: Client = {
        id: client.id,
        photo: typeof client.photo === 'string' ? client.photo : '',
        name: client.name,
        contactPerson: primaryContact?.name ?? '',
        email: primaryContact?.email ?? '',
        phone: primaryContact?.phone ?? '',
        address: typeof client.address === 'string' ? client.address : '',
        industry: typeof client.industry === 'string' ? client.industry : 'Other',
        clientSince: typeof client.clientSince === 'string' ? client.clientSince : new Date().toISOString().slice(0, 10),
        status: client.status === 'Inactive' ? 'Inactive' : 'Active',
        contacts,
        transactions,
        createdAt: typeof client.createdAt === 'string' ? client.createdAt : new Date().toISOString(),
        updatedAt: typeof client.updatedAt === 'string' ? client.updatedAt : new Date().toISOString(),
      }
      return [normalizedClient]
    }).sort((left, right) => left.name.localeCompare(right.name))
  } catch { return [] }
}

function ClientPhoto({ client, size = 'card' }: { client: Pick<Client, 'photo' | 'name'>; size?: 'card' | 'profile' }) {
  const sizeClass = size === 'profile' ? 'size-24 rounded-2xl sm:size-28' : 'size-14 rounded-2xl'
  return client.photo ? <span className={`${sizeClass} grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-white shadow-sm`}><img className="size-full object-cover" src={client.photo} alt={client.name} /></span> : <span className={`${sizeClass} grid shrink-0 place-items-center bg-[linear-gradient(145deg,#eef3fb,#dfe8f6)] text-lg font-extrabold text-brand-blue shadow-sm`}>{initials(client.name)}</span>
}

function statusTone(status: TransactionStatus) {
  if (status === 'Paid' || status === 'Completed') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'Pending') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (status === 'Overdue') return 'border-red-100 bg-red-50 text-red-600'
  return 'border-slate-200 bg-slate-100 text-slate-500'
}

function clientTotals(client: Client) {
  const valid = client.transactions.filter((transaction) => transaction.status !== 'Cancelled')
  const total = valid.reduce((sum, transaction) => sum + transaction.amount, 0)
  const settled = valid.filter((transaction) => transaction.status === 'Paid' || transaction.status === 'Completed').reduce((sum, transaction) => sum + transaction.amount, 0)
  const outstanding = valid.filter((transaction) => transaction.status === 'Pending' || transaction.status === 'Overdue').reduce((sum, transaction) => sum + transaction.amount, 0)
  return { total, settled, outstanding, count: valid.length }
}

function monthlyActivity(transactions: ClientTransaction[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const entries = transactions.filter((transaction) => transaction.date.startsWith(key) && transaction.status !== 'Cancelled')
    return { key, label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), amount: entries.reduce((sum, transaction) => sum + transaction.amount, 0), count: entries.length }
  })
}

type ClientProfileProps = {
  client: Client
  onBack: () => void
  onEdit: () => void
  onAddTransaction: () => void
  onEditTransaction: (transaction: ClientTransaction) => void
  onDeleteTransaction: (transaction: ClientTransaction) => void
}

function ClientProfile({ client, onBack, onEdit, onAddTransaction, onEditTransaction, onDeleteTransaction }: ClientProfileProps) {
  const totals = clientTotals(client)
  const activity = monthlyActivity(client.transactions)
  const maxActivity = Math.max(...activity.map((point) => point.amount), 1)
  const sortedTransactions = [...client.transactions].sort((left, right) => right.date.localeCompare(left.date))

  return <div className="space-y-4 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Client intelligence</p></div><h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Client profile</h2></div><div className="flex gap-2"><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/20" type="button" onClick={onBack}><Icon path="m15 18-6-6 6-6" />Back to clients</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_9px_22px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="button" onClick={onEdit}><Icon className="size-3.5" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" />Edit client</button></div></div>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_16px_48px_-34px_rgba(0,20,76,0.4)]"><div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_1.35fr] lg:p-6"><div className="flex min-w-0 gap-4"><ClientPhoto client={client} size="profile" /><div className="min-w-0 pt-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-xl font-extrabold tracking-[-0.03em] text-brand-blue sm:text-2xl">{client.name}</h3><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold ${client.status === 'Active' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}><span className={`size-1.5 rounded-full ${client.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{client.status}</span></div><p className="mt-2 text-sm font-semibold text-slate-500">{client.industry}</p><p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Primary contact</p><p className="mt-1 text-sm font-bold text-slate-700">{client.contactPerson}</p><p className="mt-3 text-xs font-semibold text-slate-400">Client since {formatDate(client.clientSince)}</p></div></div><div className="min-w-0"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Contact persons</p><span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-brand-blue">{client.contacts.length}</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2">{client.contacts.map((contact) => <article className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/65 p-3 transition hover:border-brand-blue/15 hover:bg-white" key={contact.id}><div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-extrabold text-brand-blue shadow-sm">{initials(contact.name)}</span><p className="truncate text-sm font-bold text-slate-700">{contact.name}</p></div><div className="mt-2 space-y-1 pl-10"><a className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-brand-blue" href={`mailto:${contact.email}`}><Icon className="size-3 shrink-0" path="M4 4h16v16H4V4Zm0 2 8 7 8-7" /><span className="truncate">{contact.email}</span></a><a className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-brand-blue" href={`tel:${contact.phone}`}><Icon className="size-3 shrink-0" path="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3" /><span>{contact.phone}</span></a></div></article>)}</div><div className="mt-2 flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50/65 p-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-brand-orange shadow-sm"><Icon className="size-3.5" path="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Address</p><p className="mt-1 text-sm font-semibold leading-5 text-slate-600">{client.address}</p></div></div></div></div></section>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Transaction summary">{[
      { label: 'Lifetime value', value: formatPeso(totals.total), tone: 'text-brand-blue', dot: 'bg-brand-blue' },
      { label: 'Settled value', value: formatPeso(totals.settled), tone: 'text-emerald-600', dot: 'bg-emerald-500' },
      { label: 'Outstanding', value: formatPeso(totals.outstanding), tone: 'text-amber-600', dot: 'bg-amber-500' },
      { label: 'Transactions', value: totals.count, tone: 'text-violet-600', dot: 'bg-violet-500' },
    ].map((card, index) => <article className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_10px_28px_-24px_rgba(0,20,76,0.42)] transition hover:-translate-y-0.5 animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${index * 45}ms` }} key={card.label}><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${card.dot}`} /><p className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">{card.label}</p></div><p className={`mt-2 truncate text-xl font-extrabold tracking-[-0.035em] ${card.tone}`}>{card.value}</p></article>)}</section>

    <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]"><article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_-30px_rgba(0,20,76,0.35)]"><div><h3 className="text-base font-extrabold text-brand-blue">Activity overview</h3><p className="mt-1 text-xs text-slate-400">Transaction value during the last six months</p></div><div className="mt-5 flex h-40 items-end gap-2 rounded-2xl bg-slate-50/70 px-3 pb-3 pt-5">{activity.map((point) => <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" key={point.key}><span className="mb-2 text-[9px] font-bold text-slate-400">{point.count || ''}</span><span className={`w-full max-w-10 rounded-t-lg transition-[height] duration-500 ${point.amount ? 'bg-[linear-gradient(180deg,#174785,#00144c)] shadow-[0_8px_18px_-12px_rgba(0,20,76,0.7)]' : 'bg-slate-200'}`} style={{ height: `${point.amount ? Math.max((point.amount / maxActivity) * 100, 10) : 4}%` }} title={`${point.label}: ${formatPeso(point.amount)}`} /><span className="mt-2 text-[10px] font-bold text-slate-400">{point.label}</span></div>)}</div></article><article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_-30px_rgba(0,20,76,0.35)]"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-extrabold text-brand-blue">Relationship overview</h3><p className="mt-1 text-xs text-slate-400">A quick view of engagement and account health</p></div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-brand-blue">{client.industry}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-slate-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Latest activity</p><p className="mt-1.5 text-sm font-bold text-slate-700">{sortedTransactions[0] ? formatDate(sortedTransactions[0].date) : 'No activity yet'}</p></div><div className="rounded-xl bg-slate-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Account health</p><p className={`mt-1.5 text-sm font-bold ${client.status === 'Active' ? 'text-emerald-600' : 'text-slate-500'}`}>{client.status === 'Active' ? 'Active relationship' : 'Inactive account'}</p></div><div className="rounded-xl bg-slate-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Open transactions</p><p className="mt-1.5 text-sm font-bold text-amber-600">{client.transactions.filter((entry) => entry.status === 'Pending' || entry.status === 'Overdue').length}</p></div><div className="rounded-xl bg-slate-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Completed records</p><p className="mt-1.5 text-sm font-bold text-emerald-600">{client.transactions.filter((entry) => entry.status === 'Paid' || entry.status === 'Completed').length}</p></div></div></article></section>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_42px_-32px_rgba(0,20,76,0.38)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-base font-extrabold text-brand-blue">Transaction history</h3><p className="mt-1 text-xs text-slate-400">Quotes, invoices, payments, projects, and services</p></div><button className="group inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_9px_22px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="button" onClick={onAddTransaction}><Icon className="size-4 transition-transform group-hover:rotate-90" path="M12 5v14M5 12h14" />Add transaction</button></div>{sortedTransactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"><th className="w-[13%] px-4 py-3.5">Date</th><th className="w-[13%] px-4 py-3.5">Type</th><th className="w-[16%] px-4 py-3.5">Ref no.</th><th className="w-[15%] px-4 py-3.5 text-right">Amount</th><th className="w-[14%] px-4 py-3.5">Status</th><th className="w-[22%] px-4 py-3.5">Notes</th><th className="w-[7%] px-4 py-3.5 text-right">Action</th></tr></thead><tbody>{sortedTransactions.map((transaction, index) => <tr className="border-b border-slate-100 transition hover:bg-slate-50/70 animate-[po-row-enter_300ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${Math.min(index * 35, 175)}ms` }} key={transaction.id}><td className="px-4 py-4 text-[13px] font-semibold text-slate-600">{formatDate(transaction.date)}</td><td className="px-4 py-4 text-[13px] font-bold text-brand-blue">{transaction.type}</td><td className="px-4 py-4 font-mono text-[12px] font-bold text-slate-600">{transaction.referenceNumber}</td><td className="px-4 py-4 text-right text-[13px] font-extrabold tabular-nums text-brand-blue">{formatPeso(transaction.amount)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusTone(transaction.status)}`}>{transaction.status}</span></td><td className="px-4 py-4"><p className="truncate text-[12px] font-medium text-slate-500" title={transaction.notes}>{transaction.notes || '—'}</p></td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-1"><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-blue-50 hover:text-brand-blue" type="button" onClick={() => onEditTransaction(transaction)} aria-label={`Edit ${transaction.referenceNumber}`}><Icon className="size-3.5" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" /></button><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600" type="button" onClick={() => onDeleteTransaction(transaction)} aria-label={`Delete ${transaction.referenceNumber}`}><Icon className="size-3.5" path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div></td></tr>)}</tbody></table></div> : <div className="grid min-h-48 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-300"><Icon path="M4 2h16v20H4V2Zm4 6h8M8 12h8M8 16h5" /></span><p className="mt-3 text-sm font-bold text-brand-blue">No transactions recorded</p><p className="mt-1 text-xs text-slate-400">Add the first transaction to build this client’s history.</p></div></div>}</section>
  </div>
}

function ClientDirectoryCard({ client, index, onEdit, onView }: { client: Client; index: number; onEdit: () => void; onView: () => void }) {
  const totals = clientTotals(client)
  return <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_-26px_rgba(0,20,76,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_42px_-28px_rgba(0,20,76,0.4)] animate-[supplier-card-enter_360ms_cubic-bezier(0.22,1,0.36,1)_both] sm:p-5" style={{ animationDelay: `${Math.min(index * 45, 225)}ms` }}>
    <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[linear-gradient(90deg,#fd4d00,#ff9567)] transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
    <div className="flex min-w-0 items-start gap-3.5"><ClientPhoto client={client} /><div className="min-w-0 flex-1 pt-0.5"><h4 className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-brand-blue">{client.name}</h4><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-brand-blue">{client.industry}</span><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${client.status === 'Active' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}><span className={`size-1.5 rounded-full ${client.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{client.status}</span></div></div><button className="grid size-8 shrink-0 place-items-center rounded-xl border border-transparent text-slate-300 transition-all hover:border-slate-200 hover:bg-slate-50 hover:text-brand-blue" type="button" onClick={onEdit} aria-label={`Edit ${client.name}`}><Icon className="size-3.5" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" /></button></div>

    <div className="mt-4 grid gap-2 rounded-xl border border-slate-100 bg-slate-50/65 p-3 sm:grid-cols-2"><div className="flex min-w-0 items-center gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-brand-orange shadow-sm"><Icon className="size-3" path="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-slate-400">Address</p><p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600" title={client.address}>{client.address}</p></div></div><div className="flex min-w-0 items-center gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-brand-blue shadow-sm"><Icon className="size-3" path="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2Z" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-slate-400">Client since</p><p className="mt-0.5 text-[11px] font-semibold text-slate-600">{formatDate(client.clientSince)}</p></div></div></div>

    <div className="mt-3 border-y border-slate-100 py-3.5"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">Contact persons</p><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{client.contacts.length}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{client.contacts.slice(0, 2).map((contact) => <div className="min-w-0" key={contact.id}><div className="flex items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-[9px] font-extrabold text-brand-blue shadow-sm">{initials(contact.name)}</span><p className="truncate text-xs font-bold text-slate-700">{contact.name}</p></div><div className="mt-2 space-y-1 pl-9"><a className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-400 transition hover:text-brand-blue" href={`mailto:${contact.email}`}><Icon className="size-3 shrink-0" path="M4 4h16v16H4V4Zm0 2 8 7 8-7" /><span className="truncate">{contact.email}</span></a><a className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 transition hover:text-brand-blue" href={`tel:${contact.phone}`}><Icon className="size-3 shrink-0" path="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1" /><span className="truncate">{contact.phone}</span></a></div></div>)}{client.contacts.length > 2 ? <p className="self-center text-[10px] font-bold text-slate-400">+{client.contacts.length - 2} more contact{client.contacts.length > 3 ? 's' : ''}</p> : null}</div></div>

    <div className="mt-auto flex items-end justify-between gap-3 pt-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Transaction summary</p><div className="mt-1.5 flex items-baseline gap-2"><p className="text-sm font-extrabold text-brand-blue">{formatPeso(totals.total)}</p><span className="text-[10px] font-semibold text-slate-400">{totals.count} records</span></div></div><button className="group/profile inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={onView}>View profile<Icon className="size-3.5 transition-transform group-hover/profile:translate-x-0.5" path="m9 18 6-6-6-6" /></button></div>
  </article>
}

export function ClientsPage({ currentUsername }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>(loadClients)
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('All industries')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => window.location.pathname.match(/^\/clients\/([^/]+)$/)?.[1] ?? null)
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [clientDraft, setClientDraft] = useState<ClientDraft>(createEmptyClient)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [transactionDraft, setTransactionDraft] = useState<TransactionDraft>(createEmptyTransaction)
  const [formError, setFormError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [toast, setToast] = useState('')
  const [deleteClientArmed, setDeleteClientArmed] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const selectedClient = selectedClientId ? clients.find((client) => client.id === selectedClientId) : undefined
  const industries = useMemo(() => Array.from(new Set([...defaultIndustries, ...clients.map((client) => client.industry)])).sort(), [clients])
  const industryOptions = [{ value: 'All industries' }, ...industries.map((value) => ({ value }))]
  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    return clients.filter((client) => (!query || [client.name, client.address, client.industry, ...client.contacts.flatMap((contact) => [contact.name, contact.email, contact.phone])].some((value) => value.toLowerCase().includes(query))) && (industryFilter === 'All industries' || client.industry === industryFilter))
  }, [clients, industryFilter, search])

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(clients)); setStorageError('') }
    catch { setStorageError('Clients could not be saved in browser storage.') }
  }, [clients])

  useEffect(() => {
    function syncPath() { setSelectedClientId(window.location.pathname.match(/^\/clients\/([^/]+)$/)?.[1] ?? null) }
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!isClientDialogOpen && !isTransactionDialogOpen) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [isClientDialogOpen, isTransactionDialogOpen])

  function openProfile(client: Client) {
    window.history.pushState({ adielClientProfile: true }, '', `/clients/${client.id}`)
    setSelectedClientId(client.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeProfile() {
    const state: unknown = window.history.state
    const openedFromDirectory = typeof state === 'object' && state !== null && 'adielClientProfile' in state && state.adielClientProfile === true
    if (openedFromDirectory) window.history.back()
    else {
      window.history.replaceState(null, '', '/clients')
      setSelectedClientId(null)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  function openAddClient() {
    setEditingClientId(null)
    setClientDraft(createEmptyClient())
    setFormError('')
    setPhotoError('')
    setDeleteClientArmed(false)
    setIsClientDialogOpen(true)
  }

  function openEditClient(client: Client) {
    setEditingClientId(client.id)
    setClientDraft({ photo: client.photo, name: client.name, contactPerson: client.contactPerson, email: client.email, phone: client.phone, address: client.address, industry: client.industry, clientSince: client.clientSince, status: client.status, contacts: client.contacts.map((contact) => ({ ...contact })) })
    setFormError('')
    setPhotoError('')
    setDeleteClientArmed(false)
    setIsClientDialogOpen(true)
  }

  function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clientDraft.name.trim() || !clientDraft.address.trim() || !clientDraft.industry.trim() || !clientDraft.clientSince || !clientDraft.contacts.length || clientDraft.contacts.some((contact) => !contact.name.trim() || !contact.email.trim() || !contact.phone.trim())) {
      setFormError('Complete the client details and provide a name, email, and number for every contact person.')
      return
    }
    const now = new Date().toISOString()
    const previous = editingClientId ? clients.find((client) => client.id === editingClientId) : undefined
    const contacts = clientDraft.contacts.map((contact) => ({ ...contact, name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim() }))
    const primaryContact = contacts[0]
    const values: Client = { id: previous?.id ?? crypto.randomUUID(), ...clientDraft, name: clientDraft.name.trim(), contactPerson: primaryContact?.name ?? '', email: primaryContact?.email ?? '', phone: primaryContact?.phone ?? '', address: clientDraft.address.trim(), industry: clientDraft.industry.trim(), contacts, transactions: previous?.transactions ?? [], createdAt: previous?.createdAt ?? now, updatedAt: now }
    setClients((current) => previous ? current.map((client) => client.id === previous.id ? values : client) : [...current, values].sort((left, right) => left.name.localeCompare(right.name)))
    appendSystemLog({ recordId: values.id, module: 'Clients', action: previous ? 'Updated' : 'Created', entity: values.name, description: previous ? 'Client profile was updated.' : 'Client was added to the directory.', actor: currentUsername, tone: previous ? 'info' : 'success', status: values.status })
    setIsClientDialogOpen(false)
    setToast(previous ? 'Client updated successfully' : 'Client added successfully')
  }

  function deleteClient() {
    const client = editingClientId ? clients.find((entry) => entry.id === editingClientId) : undefined
    if (!client) return
    setClients((current) => current.filter((entry) => entry.id !== client.id))
    appendSystemLog({ recordId: client.id, module: 'Clients', action: 'Deleted', entity: client.name, description: 'Client was removed from the directory.', actor: currentUsername, tone: 'danger', status: client.status })
    setIsClientDialogOpen(false)
    if (selectedClientId === client.id) closeProfile()
    setToast('Client removed')
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setPhotoError('Use a PNG, JPG, or WebP image up to 5 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') { setClientDraft((current) => ({ ...current, photo: reader.result as string })); setPhotoError('') } }
    reader.onerror = () => setPhotoError('The image could not be read.')
    reader.readAsDataURL(file)
  }

  function addClientContact() {
    setClientDraft((current) => ({ ...current, contacts: [...current.contacts, createEmptyContact()] }))
  }

  function updateClientContact(contactId: string, field: 'name' | 'email' | 'phone', value: string) {
    setClientDraft((current) => ({ ...current, contacts: current.contacts.map((contact) => contact.id === contactId ? { ...contact, [field]: value } : contact) }))
  }

  function removeClientContact(contactId: string) {
    setClientDraft((current) => ({ ...current, contacts: current.contacts.filter((contact) => contact.id !== contactId) }))
  }

  function openAddTransaction() {
    setEditingTransactionId(null)
    setTransactionDraft(createEmptyTransaction())
    setFormError('')
    setIsTransactionDialogOpen(true)
  }

  function openEditTransaction(transaction: ClientTransaction) {
    setEditingTransactionId(transaction.id)
    setTransactionDraft({ date: transaction.date, type: transaction.type, referenceNumber: transaction.referenceNumber, amount: String(transaction.amount), status: transaction.status, notes: transaction.notes })
    setFormError('')
    setIsTransactionDialogOpen(true)
  }

  function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedClient || !transactionDraft.date || !transactionDraft.referenceNumber.trim() || Number(transactionDraft.amount) <= 0) { setFormError('Enter a date, reference number, and positive transaction amount.'); return }
    const transaction: ClientTransaction = { id: editingTransactionId ?? crypto.randomUUID(), ...transactionDraft, referenceNumber: transactionDraft.referenceNumber.trim(), amount: Number(transactionDraft.amount), notes: transactionDraft.notes.trim() }
    setClients((current) => current.map((client) => client.id === selectedClient.id ? { ...client, transactions: editingTransactionId ? client.transactions.map((entry) => entry.id === editingTransactionId ? transaction : entry) : [...client.transactions, transaction], updatedAt: new Date().toISOString() } : client))
    appendSystemLog({ recordId: selectedClient.id, module: 'Clients', action: 'Updated', entity: selectedClient.name, description: `${editingTransactionId ? 'Updated' : 'Added'} ${transaction.type.toLowerCase()} ${transaction.referenceNumber}.`, actor: currentUsername, tone: 'info', amount: transaction.amount, status: transaction.status })
    setIsTransactionDialogOpen(false)
    setToast(editingTransactionId ? 'Transaction updated' : 'Transaction added')
  }

  function deleteTransaction(transaction: ClientTransaction) {
    if (!selectedClient) return
    setClients((current) => current.map((client) => client.id === selectedClient.id ? { ...client, transactions: client.transactions.filter((entry) => entry.id !== transaction.id), updatedAt: new Date().toISOString() } : client))
    appendSystemLog({ recordId: selectedClient.id, module: 'Clients', action: 'Updated', entity: selectedClient.name, description: `Removed transaction ${transaction.referenceNumber}.`, actor: currentUsername, tone: 'warning', amount: transaction.amount, status: transaction.status })
    setToast('Transaction removed')
  }

  const totalPortfolio = clients.reduce((sum, client) => sum + clientTotals(client).total, 0)
  const stats = [
    { label: 'Total clients', value: clients.length, color: 'text-brand-blue', dot: 'bg-brand-blue' },
    { label: 'Active clients', value: clients.filter((client) => client.status === 'Active').length, color: 'text-emerald-600', dot: 'bg-emerald-500' },
    { label: 'Industries', value: new Set(clients.map((client) => client.industry)).size, color: 'text-violet-600', dot: 'bg-violet-500' },
    { label: 'Portfolio value', value: formatPeso(totalPortfolio), color: 'text-brand-orange', dot: 'bg-brand-orange' },
  ]

  if (selectedClient) return <><ClientProfile client={selectedClient} onBack={closeProfile} onEdit={() => openEditClient(selectedClient)} onAddTransaction={openAddTransaction} onEditTransaction={openEditTransaction} onDeleteTransaction={deleteTransaction} />{renderDialogs()}<SuccessToast message={toast} /></>

  return <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center" aria-label="Client summary"><div><div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Customer relationships</p></div><h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Client directory</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Keep contact details, account activity, and transaction history together in a clear relationship workspace.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">{stats.map((stat, index) => <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-3 py-3.5 shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] ring-1 ring-inset ring-white/70 transition hover:-translate-y-0.5 animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both] sm:min-w-32 sm:px-4" style={{ animationDelay: `${index * 45}ms` }} key={stat.label}><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${stat.dot}`} /><p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{stat.label}</p></div><p className={`mt-2 truncate text-xl font-bold tracking-[-0.04em] ${stat.color}`}>{stat.value}</p></article>)}</div></SummarySurface>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]"><div className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div><h3 className="text-base font-bold text-brand-blue">All clients</h3><p className="mt-1 text-[11px] text-slate-400">{visibleClients.length} of {clients.length} relationships</p></div><div className="ml-auto flex w-full flex-col gap-2 sm:flex-row xl:max-w-3xl"><label className="relative flex-1"><span className="sr-only">Search clients</span><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-400 focus:border-brand-blue/30 focus:bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, contact, industry, or location" /></label><div className="sm:w-48"><AnimatedDropdown size="filter" value={industryFilter} options={industryOptions} onChange={setIndustryFilter} ariaLabel="Filter clients by industry" /></div><button className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition-all hover:-translate-y-0.5" type="button" onClick={openAddClient}><Icon className="size-4 transition-transform group-hover:rotate-90" path="M12 5v14M5 12h14" />Add client</button></div></div>{storageError ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{storageError}</p> : null}</div>
      {visibleClients.length ? <div className="supplier-readable-cards grid gap-3 p-4 lg:grid-cols-2 2xl:grid-cols-3 sm:p-5">{visibleClients.map((client, index) => <ClientDirectoryCard client={client} index={index} onEdit={() => openEditClient(client)} onView={() => openProfile(client)} key={client.id} />)}</div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-300"><Icon className="size-6" path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" /></span><h3 className="mt-4 text-lg font-bold text-brand-blue">{clients.length ? 'No matching clients' : 'Build your client directory'}</h3><p className="mt-2 text-xs text-slate-400">{clients.length ? 'Clear the filters or try a different search.' : 'Add the first client to begin tracking relationships and transactions.'}</p><button className="mt-4 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={clients.length ? () => { setSearch(''); setIndustryFilter('All industries') } : openAddClient}>{clients.length ? 'Clear filters' : 'Add first client'}</button></div></div>}
    </section>
    {renderDialogs()}
    <SuccessToast message={toast} />
  </div>

  function renderDialogs() {
    return <>
      {isClientDialogOpen ? <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm animate-[supplier-backdrop-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="client-form-title"><button className="absolute inset-0" type="button" onClick={() => setIsClientDialogOpen(false)} aria-label="Close client form" /><form className="relative my-6 w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_35px_100px_rgba(0,20,76,0.34)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)]" onSubmit={saveClient}><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">Relationship record</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="client-form-title">{editingClientId ? 'Edit client' : 'Add a client'}</h2><p className="mt-1 text-sm text-slate-500">Contact and relationship information</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsClientDialogOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></button></div><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">{formError ? <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{formError}</p> : null}<div className="grid gap-5 lg:grid-cols-[13rem_1fr]"><aside><p className={labelClassName}>Client picture</p><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-center"><div className="flex justify-center"><ClientPhoto client={{ photo: clientDraft.photo, name: clientDraft.name || 'Client' }} size="profile" /></div><input className="sr-only" ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} /><button className="mt-4 h-9 w-full rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-brand-blue transition hover:border-brand-blue/20" type="button" onClick={() => photoInputRef.current?.click()}>{clientDraft.photo ? 'Replace picture' : 'Upload picture'}</button>{clientDraft.photo ? <button className="mt-2 text-[10px] font-bold text-red-500" type="button" onClick={() => setClientDraft((current) => ({ ...current, photo: '' }))}>Remove picture</button> : null}{photoError ? <p className="mt-2 text-[10px] text-red-600">{photoError}</p> : <p className="mt-3 text-[10px] leading-4 text-slate-400">PNG, JPG, or WebP<br />up to 5 MB</p>}</div></aside><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClassName} htmlFor="client-name">Client / company name</label><input className={fieldClassName} id="client-name" value={clientDraft.name} onChange={(event) => setClientDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Client or organization" autoFocus required /></div><div><label className={labelClassName}>Status</label><AnimatedDropdown value={clientDraft.status} options={statusOptions} onChange={(status) => setClientDraft((current) => ({ ...current, status }))} ariaLabel="Client status" /></div><div><label className={labelClassName}>Industry</label><AnimatedDropdown value={clientDraft.industry} options={industries.map((value) => ({ value }))} onChange={(industry) => setClientDraft((current) => ({ ...current, industry }))} ariaLabel="Client industry" /></div><div><label className={labelClassName}>Client since</label><AnimatedDatePicker value={clientDraft.clientSince} onChange={(clientSince) => setClientDraft((current) => ({ ...current, clientSince }))} ariaLabel="Client since date" required /></div><div className="sm:col-span-2"><label className={labelClassName} htmlFor="client-address">Address</label><textarea className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium leading-5 text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="client-address" value={clientDraft.address} onChange={(event) => setClientDraft((current) => ({ ...current, address: event.target.value }))} placeholder="Complete client address" required /></div><section className="border-t border-slate-100 pt-4 sm:col-span-2"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-brand-blue">Contact persons</h3><p className="mt-1 text-[10px] text-slate-400">Add the people your team coordinates with for this client.</p></div><button className="group inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-blue/10 bg-blue-50 px-3 text-[11px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:bg-blue-100" type="button" onClick={addClientContact}><Icon className="size-3.5 transition-transform group-hover:rotate-90" path="M12 5v14M5 12h14" />Add contact</button></div><div className="mt-3 space-y-2.5">{clientDraft.contacts.map((contact, index) => <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/55 p-3 animate-[supplier-card-enter_220ms_ease-out] sm:grid-cols-[1fr_1.15fr_0.8fr_auto]" key={contact.id}><div><label className={labelClassName} htmlFor={`client-contact-name-${contact.id}`}>Name</label><input className={fieldClassName} id={`client-contact-name-${contact.id}`} value={contact.name} onChange={(event) => updateClientContact(contact.id, 'name', event.target.value)} placeholder={`Contact ${index + 1}`} required /></div><div><label className={labelClassName} htmlFor={`client-contact-email-${contact.id}`}>Email</label><input className={fieldClassName} id={`client-contact-email-${contact.id}`} type="email" value={contact.email} onChange={(event) => updateClientContact(contact.id, 'email', event.target.value)} placeholder="name@company.com" required /></div><div><label className={labelClassName} htmlFor={`client-contact-phone-${contact.id}`}>Number</label><input className={fieldClassName} id={`client-contact-phone-${contact.id}`} value={contact.phone} onChange={(event) => updateClientContact(contact.id, 'phone', event.target.value)} placeholder="Contact number" required /></div><button className="grid size-11 place-items-center self-end rounded-xl text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30" type="button" onClick={() => removeClientContact(contact.id)} disabled={clientDraft.contacts.length === 1} aria-label={`Remove ${contact.name || `contact ${index + 1}`}`}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div>)}</div></section></div></div></div><div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">{editingClientId ? deleteClientArmed ? <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-red-600">Delete this client?</span><button className="h-9 rounded-xl px-3 text-xs font-bold text-slate-500" type="button" onClick={() => setDeleteClientArmed(false)}>Cancel</button><button className="h-9 rounded-xl bg-red-600 px-3 text-xs font-bold text-white" type="button" onClick={deleteClient}>Delete</button></div> : <button className="h-10 rounded-xl px-3 text-xs font-bold text-red-500 transition hover:bg-red-50" type="button" onClick={() => setDeleteClientArmed(true)}>Delete client</button> : <span />}<div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={() => setIsClientDialogOpen(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">{editingClientId ? 'Save changes' : 'Create client'}</button></div></div></form></div> : null}

      {isTransactionDialogOpen && selectedClient ? <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title"><button className="absolute inset-0" type="button" onClick={() => setIsTransactionDialogOpen(false)} aria-label="Close transaction form" /><form className="relative my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_35px_100px_rgba(0,20,76,0.38)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)]" onSubmit={saveTransaction}><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">{selectedClient.name}</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="transaction-form-title">{editingTransactionId ? 'Edit transaction' : 'Add transaction'}</h2></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => setIsTransactionDialogOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></button></div><div className="px-6 py-5">{formError ? <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{formError}</p> : null}<div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>Date</label><AnimatedDatePicker value={transactionDraft.date} onChange={(date) => setTransactionDraft((current) => ({ ...current, date }))} ariaLabel="Transaction date" required /></div><div><label className={labelClassName}>Type</label><AnimatedDropdown value={transactionDraft.type} options={transactionTypeOptions} onChange={(type) => setTransactionDraft((current) => ({ ...current, type }))} ariaLabel="Transaction type" /></div><div><label className={labelClassName} htmlFor="transaction-reference">Reference number</label><input className={`${fieldClassName} font-mono`} id="transaction-reference" value={transactionDraft.referenceNumber} onChange={(event) => setTransactionDraft((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="INV-2026-001" required /></div><div><label className={labelClassName} htmlFor="transaction-amount">Amount</label><input className={fieldClassName} id="transaction-amount" type="number" min="0.01" step="0.01" value={transactionDraft.amount} onChange={(event) => setTransactionDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" required /></div><div><label className={labelClassName}>Status</label><AnimatedDropdown value={transactionDraft.status} options={transactionStatusOptions} onChange={(status) => setTransactionDraft((current) => ({ ...current, status }))} ariaLabel="Transaction status" /></div><div className="sm:col-span-2"><label className={labelClassName} htmlFor="transaction-notes">Notes</label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-brand-blue outline-none focus:border-brand-blue/40" id="transaction-notes" value={transactionDraft.notes} onChange={(event) => setTransactionDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional context or remarks" /></div></div></div><div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setIsTransactionDialogOpen(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">{editingTransactionId ? 'Save changes' : 'Add transaction'}</button></div></form></div> : null}
    </>
  }
}
