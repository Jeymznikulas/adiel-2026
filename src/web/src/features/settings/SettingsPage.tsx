import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { loadCompanyProfile, loadDocumentDefaults, saveCompanyProfile, saveDocumentDefaults, type CompanyProfile, type DocumentDefaults } from './settingsStorage'

type SettingsSection = 'company' | 'documents'

const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const textAreaClassName = 'min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium leading-6 text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('company')
  const [company, setCompany] = useState(loadCompanyProfile)
  const [documents, setDocuments] = useState(loadDocumentDefaults)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function updateCompany(field: keyof CompanyProfile, value: string) {
    setCompany((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function updateDocuments(field: keyof DocumentDefaults, value: string) {
    setDocuments((current) => ({ ...current, [field]: value }))
  }

  function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company.companyName.trim() || !company.address.trim() || !company.mainOfficeNumber.trim() || !company.email.trim() || !company.tin.trim()) {
      setError('Complete the company name, address, main office number, email, and TIN.')
      return
    }
    const normalized = Object.fromEntries(Object.entries(company).map(([key, value]) => [key, value.trim()])) as CompanyProfile
    try {
      saveCompanyProfile(normalized)
      setCompany(normalized)
      setToast('Company profile saved')
    } catch {
      setError('The company profile could not be saved in browser storage.')
    }
  }

  function saveDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = Object.fromEntries(Object.entries(documents).map(([key, value]) => [key, value.trim()])) as DocumentDefaults
    try {
      saveDocumentDefaults(normalized)
      setDocuments(normalized)
      setToast('Document defaults saved')
    } catch {
      setError('The document defaults could not be saved in browser storage.')
    }
  }

  return <div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
    <section className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#00113f,#073078)] p-6 text-white shadow-[0_24px_55px_-34px_rgba(0,20,76,0.9)] sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/[0.06]" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">System configuration</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">One place for your document settings</h2><p className="mt-2 text-sm leading-6 text-white/60">Company information and default wording are shared by quotation, purchase-order, and statement-of-account PDFs.</p></div>
        <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-1.5">
          <button className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${activeSection === 'company' ? 'bg-white text-brand-blue shadow-sm' : 'text-white/65 hover:bg-white/10 hover:text-white'}`} type="button" onClick={() => setActiveSection('company')}><Icon path="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />Company Profile</button>
          <button className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${activeSection === 'documents' ? 'bg-white text-brand-blue shadow-sm' : 'text-white/65 hover:bg-white/10 hover:text-white'}`} type="button" onClick={() => setActiveSection('documents')}><Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6M14 2v6h6M8 13h8M8 17h5" />Document Defaults</button>
        </div>
      </div>
    </section>

    {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}
    {activeSection === 'company' ? <form className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]" onSubmit={saveCompany}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-base font-extrabold text-brand-blue">Company Profile</h3><p className="mt-1 text-xs text-slate-400">Used in the header of every generated PDF.</p></div><span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">Shared across 3 documents</span></header>
      <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-[15rem_1fr]">
        <aside className="self-start rounded-2xl border border-brand-blue/10 bg-[linear-gradient(145deg,#f8faff,#f1f5fb)] p-5 text-center"><span className="mx-auto grid size-32 place-items-center overflow-hidden rounded-2xl border border-white bg-white p-3 shadow-sm"><img className="size-full object-contain" src="/images/adiel-logo-flat.png" alt="ADIEL logo" /></span><p className="mt-4 text-sm font-extrabold text-brand-blue">PDF identity</p><p className="mt-1 text-[10px] leading-5 text-slate-400">The system logo and information entered here form the official document header.</p></aside>
        <div><div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelClassName} htmlFor="settings-company-name">Company name</label><input className={fieldClassName} id="settings-company-name" value={company.companyName} onChange={(event) => updateCompany('companyName', event.target.value)} required /></div>
          <div className="sm:col-span-2"><label className={labelClassName} htmlFor="settings-company-address">Business address</label><textarea className={textAreaClassName} id="settings-company-address" value={company.address} onChange={(event) => updateCompany('address', event.target.value)} placeholder="Complete registered business address" required /></div>
          <div><label className={labelClassName} htmlFor="settings-company-main">Main office number</label><input className={fieldClassName} id="settings-company-main" type="tel" value={company.mainOfficeNumber} onChange={(event) => updateCompany('mainOfficeNumber', event.target.value)} required /></div>
          <div><label className={labelClassName} htmlFor="settings-company-relations">Client relations number</label><input className={fieldClassName} id="settings-company-relations" type="tel" value={company.clientRelationsNumber} onChange={(event) => updateCompany('clientRelationsNumber', event.target.value)} /></div>
          <div><label className={labelClassName} htmlFor="settings-company-accounts">Accounts number</label><input className={fieldClassName} id="settings-company-accounts" type="tel" value={company.accountsNumber} onChange={(event) => updateCompany('accountsNumber', event.target.value)} /></div>
          <div><label className={labelClassName} htmlFor="settings-company-new-accounts">New accounts number</label><input className={fieldClassName} id="settings-company-new-accounts" type="tel" value={company.newAccountsNumber} onChange={(event) => updateCompany('newAccountsNumber', event.target.value)} /></div>
          <div><label className={labelClassName} htmlFor="settings-company-email">Company email</label><input className={fieldClassName} id="settings-company-email" type="email" value={company.email} onChange={(event) => updateCompany('email', event.target.value)} required /></div>
          <div><label className={labelClassName} htmlFor="settings-company-tin">TIN</label><input className={fieldClassName} id="settings-company-tin" value={company.tin} onChange={(event) => updateCompany('tin', event.target.value)} required /></div>
        </div></div>
      </div>
      <footer className="flex items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6"><p className="text-[10px] font-semibold text-slate-400">Existing PO company details are migrated automatically.</p><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit"><Icon path="m5 12 4 4L19 6" />Save company profile</button></footer>
    </form> : <form className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]" onSubmit={saveDocuments}>
      <header className="border-b border-slate-100 px-5 py-4 sm:px-6"><h3 className="text-base font-extrabold text-brand-blue">Document Defaults</h3><p className="mt-1 text-xs text-slate-400">Reusable wording applied when documents are created or exported.</p></header>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6" /></span><div><h4 className="text-sm font-extrabold text-brand-blue">Quotation terms</h4><p className="text-[10px] text-slate-400">One condition per line</p></div></div><textarea className={`${textAreaClassName} mt-4 min-h-40`} value={documents.quotationTerms} onChange={(event) => updateDocuments('quotationTerms', event.target.value)} aria-label="Default quotation terms" /></section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon path="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6" /></span><div><h4 className="text-sm font-extrabold text-brand-blue">Purchase-order terms</h4><p className="text-[10px] text-slate-400">Used as the default for new POs</p></div></div><textarea className={`${textAreaClassName} mt-4 min-h-40`} value={documents.purchaseOrderTerms} onChange={(event) => updateDocuments('purchaseOrderTerms', event.target.value)} aria-label="Default purchase order terms" /></section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4"><label className={labelClassName} htmlFor="settings-soa-instructions">SOA payment instructions</label><textarea className={textAreaClassName} id="settings-soa-instructions" value={documents.statementPaymentInstructions} onChange={(event) => updateDocuments('statementPaymentInstructions', event.target.value)} /></section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4"><label className={labelClassName} htmlFor="settings-pdf-footer">PDF footer</label><textarea className={textAreaClassName} id="settings-pdf-footer" value={documents.pdfFooter} onChange={(event) => updateDocuments('pdfFooter', event.target.value)} /></section>
      </div>
      <footer className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6"><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit"><Icon path="m5 12 4 4L19 6" />Save document defaults</button></footer>
    </form>}
    <SuccessToast message={toast} />
  </div>
}
