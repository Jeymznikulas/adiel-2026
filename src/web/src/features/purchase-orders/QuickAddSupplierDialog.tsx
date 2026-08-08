import type { FormEvent } from 'react'
import { useState } from 'react'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'

export type QuickSupplierInput = {
  name: string
  type: 'Contractor' | 'Distributor' | 'Manufacturer' | 'Service provider' | 'Other'
  contactName: string
  email: string
  phone: string
  address: string
}

type QuickAddSupplierDialogProps = {
  existingNames: string[]
  onCreate: (values: QuickSupplierInput) => string | null
  onClose: () => void
}

const typeOptions: { value: QuickSupplierInput['type'] }[] = ['Contractor', 'Distributor', 'Manufacturer', 'Service provider', 'Other'].map((value) => ({ value: value as QuickSupplierInput['type'] }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function QuickAddSupplierDialog({ existingNames, onCreate, onClose }: QuickAddSupplierDialogProps) {
  const [draft, setDraft] = useState<QuickSupplierInput>({ name: '', type: 'Distributor', contactName: '', email: '', phone: '', address: '' })
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = {
      ...draft,
      name: draft.name.trim(),
      contactName: draft.contactName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
    }
    if (!values.name || !values.contactName || !values.email || !values.phone) {
      setError('Enter the supplier name and primary contact details.')
      return
    }
    if (existingNames.some((name) => name.toLowerCase() === values.name.toLowerCase())) {
      setError('A supplier with this name already exists. Select it from the list instead.')
      return
    }
    const createError = onCreate(values)
    if (createError) setError(createError)
  }

  return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="quick-supplier-title">
    <button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close add supplier dialog" />
    <form className="relative my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)]" onSubmit={submit}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Quick setup</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="quick-supplier-title">Add a supplier</h2><p className="mt-1 text-xs leading-5 text-slate-400">Create the essential record now and continue building this purchase order.</p></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose} aria-label="Close dialog"><Icon path="M18 6 6 18M6 6l12 12" /></button></header>
      <div className="px-6 py-5">{error ? <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600" role="alert">{error}</p> : null}<div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClassName} htmlFor="quick-supplier-name">Supplier name</label><input className={fieldClassName} id="quick-supplier-name" value={draft.name} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setError('') }} placeholder="Company or supplier name" autoFocus required /></div><div><label className={labelClassName}>Supplier type</label><AnimatedDropdown value={draft.type} options={typeOptions} onChange={(type) => setDraft((current) => ({ ...current, type }))} ariaLabel="Supplier type" /></div><div><label className={labelClassName} htmlFor="quick-supplier-contact">Primary contact</label><input className={fieldClassName} id="quick-supplier-contact" value={draft.contactName} onChange={(event) => setDraft((current) => ({ ...current, contactName: event.target.value }))} placeholder="Contact person" required /></div><div><label className={labelClassName} htmlFor="quick-supplier-email">Email</label><input className={fieldClassName} id="quick-supplier-email" type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} placeholder="supplier@company.com" required /></div><div><label className={labelClassName} htmlFor="quick-supplier-phone">Contact number</label><input className={fieldClassName} id="quick-supplier-phone" type="tel" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="+63 917 000 0000" required /></div><div className="sm:col-span-2"><label className={labelClassName} htmlFor="quick-supplier-address">Address <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><input className={fieldClassName} id="quick-supplier-address" value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} placeholder="Street, city, province, postal code" /></div></div><div className="mt-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3.5 py-3"><Icon className="mt-0.5 size-3.5 shrink-0 text-brand-blue" path="M12 8h.01M11 12h1v4h1M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /><p className="text-[10px] leading-4 text-slate-500">The supplier is saved to the Supplier Directory. Add its TIN, categories, logo, and catalog items there when needed.</p></div></div>
      <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onClose}>Cancel</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit"><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add and select supplier</button></footer>
    </form>
  </div>
}
