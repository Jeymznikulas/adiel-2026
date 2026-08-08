import type { FormEvent } from 'react'
import { useState } from 'react'
import { loadPurchaseOrderCompanyProfile, savePurchaseOrderCompanyProfile, type PurchaseOrderCompanyProfile } from './purchaseOrderDocumentDefaults'

type PurchaseOrderCompanyDetailsDialogProps = {
  onSaved: () => void
  onClose: () => void
}

const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function PurchaseOrderCompanyDetailsDialog({ onSaved, onClose }: PurchaseOrderCompanyDetailsDialogProps) {
  const [profile, setProfile] = useState(loadPurchaseOrderCompanyProfile)
  const [error, setError] = useState('')

  function update(field: keyof PurchaseOrderCompanyProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile.companyName.trim() || !profile.address.trim() || !profile.mainOfficeNumber.trim() || !profile.email.trim() || !profile.tin.trim()) {
      setError('Complete the company name, address, main office number, email, and TIN.')
      return
    }
    const normalized = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value.trim()])) as PurchaseOrderCompanyProfile
    savePurchaseOrderCompanyProfile(normalized)
    onSaved()
    onClose()
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="po-company-details-title"><button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close company details" /><form className="relative my-6 w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.36)]" onSubmit={save}><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Document settings</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="po-company-details-title">Own company details</h2><p className="mt-1 text-xs text-slate-400">Used in the header of every generated purchase order.</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></div><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">{error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}<div className="grid gap-6 lg:grid-cols-[13rem_1fr]"><aside className="self-start rounded-2xl border border-brand-blue/10 bg-[linear-gradient(145deg,#f8faff,#f1f5fb)] p-4 text-center"><span className="mx-auto grid size-28 place-items-center overflow-hidden rounded-2xl border border-white bg-white p-2 shadow-sm"><img className="size-full object-contain" src="/images/adiel-logo-flat.png" alt="ADIEL logo" /></span><p className="mt-4 text-xs font-extrabold text-brand-blue">ADIEL document identity</p><p className="mt-1 text-[10px] leading-5 text-slate-400">Configure these details once. You can update them here whenever company contact information changes.</p></aside><div><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClassName} htmlFor="company-detail-name">Company name</label><input className={fieldClassName} id="company-detail-name" value={profile.companyName} onChange={(event) => update('companyName', event.target.value)} required /></div><div className="sm:col-span-2"><label className={labelClassName} htmlFor="company-detail-address">Business address</label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium leading-6 text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="company-detail-address" value={profile.address} onChange={(event) => update('address', event.target.value)} placeholder="Complete registered business address" required /></div><div><label className={labelClassName} htmlFor="company-detail-main">Main office number</label><input className={fieldClassName} id="company-detail-main" type="tel" value={profile.mainOfficeNumber} onChange={(event) => update('mainOfficeNumber', event.target.value)} placeholder="Main office" required /></div><div><label className={labelClassName} htmlFor="company-detail-relations">Client relations number</label><input className={fieldClassName} id="company-detail-relations" type="tel" value={profile.clientRelationsNumber} onChange={(event) => update('clientRelationsNumber', event.target.value)} placeholder="Client relations" /></div><div><label className={labelClassName} htmlFor="company-detail-accounts">Accounts number</label><input className={fieldClassName} id="company-detail-accounts" type="tel" value={profile.accountsNumber} onChange={(event) => update('accountsNumber', event.target.value)} placeholder="Accounts department" /></div><div><label className={labelClassName} htmlFor="company-detail-new-accounts">New accounts number</label><input className={fieldClassName} id="company-detail-new-accounts" type="tel" value={profile.newAccountsNumber} onChange={(event) => update('newAccountsNumber', event.target.value)} placeholder="New accounts" /></div><div><label className={labelClassName} htmlFor="company-detail-email">Company email</label><input className={fieldClassName} id="company-detail-email" type="email" value={profile.email} onChange={(event) => update('email', event.target.value)} placeholder="company@email.com" required /></div><div><label className={labelClassName} htmlFor="company-detail-tin">TIN</label><input className={fieldClassName} id="company-detail-tin" value={profile.tin} onChange={(event) => update('tin', event.target.value)} placeholder="Tax identification number" required /></div></div><div className="mt-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3.5 py-3"><Icon className="mt-0.5 size-3.5 shrink-0 text-brand-blue" path="M12 8h.01M11 12h1v4h1M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /><p className="text-[10px] leading-4 text-slate-500">This is your own company information, not the supplier’s. Supplier details are pulled separately from the Supplier Directory.</p></div></div></div></div><div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onClose}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">Save company details</button></div></form></div>
}
