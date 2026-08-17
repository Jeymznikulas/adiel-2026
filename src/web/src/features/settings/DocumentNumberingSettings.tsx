import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { formatDocumentNumber, loadDocumentNumbering, nextDocumentNumber, saveDocumentNumbering, type DocumentNumberingRule, type DocumentNumberingSettings, type DocumentNumberingType } from './settingsStorage'

const documentTypes: Array<{ type: DocumentNumberingType; title: string; detail: string; storageKey: string; numberKey: string; tone: string }> = [
  { type: 'quotation', title: 'Quotation', detail: 'Used for every new quotation', storageKey: 'adiel.quotations', numberKey: 'quotationNumber', tone: 'bg-violet-50 text-violet-700' },
  { type: 'purchaseOrder', title: 'Purchase Order', detail: 'One sequence across all suppliers', storageKey: 'adiel.purchase-orders', numberKey: 'poNumber', tone: 'bg-amber-50 text-amber-700' },
  { type: 'statementOfAccount', title: 'Statement of Account', detail: 'Used for every new SOA', storageKey: 'adiel.statements-of-account', numberKey: 'soaNumber', tone: 'bg-sky-50 text-sky-700' },
]

const digitOptions = ['2', '3', '4', '5', '6', '7', '8'].map((value) => ({ value, label: `${value} digits` }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function readExistingNumbers(storageKey: string, numberKey: string) {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const number = (value as Record<string, unknown>)[numberKey]
      return typeof number === 'string' ? [number] : []
    })
  } catch {
    return []
  }
}

export function DocumentNumberingSettings() {
  const [settings, setSettings] = useState<DocumentNumberingSettings>(loadDocumentNumbering)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const existingNumbers = useMemo(() => Object.fromEntries(documentTypes.map((document) => [document.type, readExistingNumbers(document.storageKey, document.numberKey)])) as Record<DocumentNumberingType, string[]>, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function updateRule(type: DocumentNumberingType, changes: Partial<DocumentNumberingRule>) {
    setSettings((current) => ({ ...current, [type]: { ...current[type], ...changes } }))
    setError('')
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prefixes = documentTypes.map(({ type }) => settings[type].prefix.trim().toUpperCase())
    if (prefixes.some((prefix) => !prefix)) {
      setError('Enter a prefix for every document type.')
      return
    }
    if (new Set(prefixes).size !== prefixes.length) {
      setError('Use a different prefix for Quotations, Purchase Orders, and SOAs.')
      return
    }
    try {
      saveDocumentNumbering(settings)
      setSettings(loadDocumentNumbering())
      setToast('Document numbering settings saved')
    } catch {
      setError('Document numbering settings could not be saved in browser storage.')
    }
  }

  return <form className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]" onSubmit={save}>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-base font-extrabold text-brand-blue">Document Numbering</h3><p className="mt-1 text-xs text-slate-400">Set the prefix and sequence used when a new document is created.</p></div><span className="rounded-lg bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-brand-blue">Existing numbers stay unchanged</span></header>
    {error ? <div className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 sm:mx-6">{error}</div> : null}
    <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-3">
      {documentTypes.map((document) => {
        const rule = settings[document.type]
        const nextNumber = nextDocumentNumber(document.type, existingNumbers[document.type], today, settings)
        const startingPreview = formatDocumentNumber(rule, rule.startingNumber, today)
        return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/45" key={document.type}>
          <div className="border-b border-slate-200/70 bg-white p-4"><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${document.tone}`}><Icon path="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" /></span><div className="min-w-0"><h4 className="text-sm font-extrabold text-brand-blue">{document.title}</h4><p className="mt-1 text-[10px] text-slate-400">{document.detail}</p></div></div><div className="mt-4 rounded-xl bg-[linear-gradient(145deg,#00113f,#073078)] px-4 py-3 text-white"><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/45">Next number</p><p className="mt-1.5 truncate font-mono text-sm font-extrabold">{nextNumber}</p></div></div>
          <div className="space-y-4 p-4">
            <div><label className={labelClassName} htmlFor={`number-prefix-${document.type}`}>Prefix</label><input className={`${fieldClassName} uppercase`} id={`number-prefix-${document.type}`} maxLength={12} value={rule.prefix} onChange={(event) => updateRule(document.type, { prefix: event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase() })} placeholder="Example: QT" required /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className={labelClassName} htmlFor={`number-start-${document.type}`}>Start at</label><input className={fieldClassName} id={`number-start-${document.type}`} type="number" min="1" max="99999999" value={rule.startingNumber} onChange={(event) => updateRule(document.type, { startingNumber: Math.max(1, Math.min(99_999_999, Number(event.target.value) || 1)) })} /></div><div><label className={labelClassName}>Number width</label><AnimatedDropdown value={String(rule.digits)} options={digitOptions} onChange={(digits) => updateRule(document.type, { digits: Number(digits) })} ariaLabel={`${document.title} number width`} /></div></div>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3"><span><span className="block text-xs font-bold text-brand-blue">Include year</span><span className="mt-1 block text-[9px] leading-4 text-slate-400">Adds {today.slice(0, 4)} before the sequence</span></span><input className="mt-0.5 size-4 shrink-0 accent-brand-blue" type="checkbox" checked={rule.includeYear} onChange={(event) => updateRule(document.type, { includeYear: event.target.checked, resetYearly: event.target.checked ? rule.resetYearly : false })} /></label>
            <label className={`flex items-start justify-between gap-4 rounded-xl border p-3 ${rule.includeYear ? 'cursor-pointer border-slate-200 bg-white' : 'cursor-not-allowed border-slate-100 bg-slate-100/70 opacity-55'}`}><span><span className="block text-xs font-bold text-brand-blue">Reset every year</span><span className="mt-1 block text-[9px] leading-4 text-slate-400">Starts again from {rule.startingNumber} in January</span></span><input className="mt-0.5 size-4 shrink-0 accent-brand-blue" type="checkbox" checked={rule.resetYearly} disabled={!rule.includeYear} onChange={(event) => updateRule(document.type, { resetYearly: event.target.checked })} /></label>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 pt-4"><span className="text-[9px] font-semibold text-slate-400">Starting format</span><code className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-extrabold text-brand-blue shadow-sm">{startingPreview}</code></div>
          </div>
        </section>
      })}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6"><p className="max-w-xl text-[10px] font-semibold leading-5 text-slate-400">If a matching number already exists, the system automatically moves to the next available sequence.</p><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit"><Icon path="m5 12 4 4L19 6" />Save numbering</button></footer>
    <SuccessToast message={toast} />
  </form>
}
