import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { createBusinessOption, deleteBusinessOption, listBusinessOptions, renameBusinessOption, reorderBusinessOptions, setBusinessOptionActive, type BusinessOption, type BusinessOptionType } from '../../services/api/settings'
import type { BusinessSettingsTab } from './settingsStorage'

const tabs: Array<{ id: BusinessSettingsTab; type: BusinessOptionType; label: string; singular: string; description: string }> = [
  { id: 'expense-categories', type: 'expense_category', label: 'Expense categories', singular: 'expense category', description: 'Classify business and project spending.' },
  { id: 'payment-methods', type: 'payment_method', label: 'Payment methods', singular: 'payment method', description: 'Control the methods available when recording expenses.' },
  { id: 'client-industries', type: 'client_industry', label: 'Client industries', singular: 'client industry', description: 'Keep client classifications consistent.' },
  { id: 'supplier-categories', type: 'supplier_category', label: 'Supplier categories', singular: 'supplier category', description: 'Standardize supplier capability tags.' },
  { id: 'item-categories', type: 'item_category', label: 'Item categories', singular: 'item category', description: 'Organize the product and service catalogue.' },
]

function Icon({ path }: { path: string }) {
  return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function BusinessOptionsSettings({ initialTab }: { initialTab: BusinessSettingsTab }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [options, setOptions] = useState<BusinessOption[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isBusy, setIsBusy] = useState(true)
  const detail = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]!
  const activeCount = options.filter((option) => option.isActive).length

  useEffect(() => {
    let isActive = true
    setIsBusy(true)
    void listBusinessOptions(detail.type).then((result) => { if (isActive) { setOptions(result); setError('') } }).catch((failure: unknown) => { if (isActive) setError(failure instanceof Error ? failure.message : 'Business options could not be loaded.') }).finally(() => { if (isActive) setIsBusy(false) })
    return () => { isActive = false }
  }, [detail.type])

  function chooseTab(tab: BusinessSettingsTab) {
    setActiveTab(tab); setNewName(''); setEditingId(null); setError(''); setMessage('')
    window.history.replaceState(null, '', `/settings?section=options&tab=${tab}`)
  }

  async function run(action: () => Promise<void>) {
    setIsBusy(true); setError(''); setMessage('')
    try { await action(); window.dispatchEvent(new Event('adiel:settings-changed')) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The business option could not be updated.') }
    finally { setIsBusy(false) }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) { setError(`Enter a ${detail.singular} name.`); return }
    void run(async () => { const created = await createBusinessOption(detail.type, name); setOptions((current) => [...current, created]); setNewName(''); setMessage(`${created.name} added`) })
  }

  function rename(event: FormEvent<HTMLFormElement>, option: BusinessOption) {
    event.preventDefault()
    const name = editingName.trim()
    if (!name) { setError(`Enter a ${detail.singular} name.`); return }
    void run(async () => { const saved = await renameBusinessOption(option.id, name, option.version); setOptions((current) => current.map((entry) => entry.id === saved.id ? saved : entry)); setEditingId(null); setMessage(`${option.name} renamed to ${saved.name}`) })
  }

  function toggle(option: BusinessOption) {
    if (option.isActive && activeCount === 1) { setError('At least one option must remain active.'); return }
    void run(async () => { const saved = await setBusinessOptionActive(option.id, !option.isActive, option.version); setOptions((current) => current.map((entry) => entry.id === saved.id ? saved : entry)); setMessage(`${saved.name} ${saved.isActive ? 'activated' : 'deactivated'}`) })
  }

  function move(option: BusinessOption, direction: -1 | 1) {
    const index = options.findIndex((entry) => entry.id === option.id)
    const destination = index + direction
    if (index < 0 || destination < 0 || destination >= options.length) return
    const next = [...options]
    const target = next[destination]
    if (!target) return
    next[index] = target; next[destination] = option
    void run(async () => { setOptions(await reorderBusinessOptions(detail.type, next)); setMessage('Display order updated') })
  }

  function remove(option: BusinessOption) {
    if (option.usageCount) { setError(`${option.name} is used by ${option.usageCount} record${option.usageCount === 1 ? '' : 's'} and cannot be deleted.`); return }
    void run(async () => { await deleteBusinessOption(option.id, option.version); setOptions((current) => current.filter((entry) => entry.id !== option.id)); setMessage(`${option.name} deleted`) })
  }

  return <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]">
    <header className="border-b border-slate-100 px-5 py-4 sm:px-6"><h3 className="text-base font-extrabold text-brand-blue">Business Options</h3><p className="mt-1 text-xs text-slate-400">Reusable classifications shared by daily entry forms.</p></header>
    <div className="grid lg:grid-cols-[15rem_1fr]">
      <nav className="border-b border-slate-100 bg-slate-50/55 p-3 lg:border-b-0 lg:border-r" aria-label="Business option groups">{tabs.map((tab) => <button className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:-translate-y-0.5 ${activeTab === tab.id ? 'bg-white text-brand-blue shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-brand-blue'}`} type="button" onClick={() => chooseTab(tab.id)} key={tab.id}><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${activeTab === tab.id ? 'bg-blue-50 text-brand-blue' : 'bg-slate-100 text-slate-400'}`}><Icon path={tab.type === 'payment_method' ? 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' : tab.type.includes('supplier') || tab.type.includes('client') ? 'M3 21h18M5 21V7l7-4 7 4v14' : 'M4 5h16v14H4V5Zm4 4h8M8 13h5'} /></span><span><span className="block text-xs font-extrabold">{tab.label}</span><span className="mt-1 block text-[9px] leading-4 text-slate-400">{tab.description}</span></span></button>)}</nav>
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-extrabold text-brand-blue">{detail.label}</h4><p className="mt-1 text-[10px] text-slate-400">{activeCount} active of {options.length} options</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[9px] font-bold text-emerald-700">Synced with database</span></div>
        <form className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50/55 p-3" onSubmit={add}><label className="sr-only" htmlFor="business-option-name">New option</label><input className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40" id="business-option-name" value={newName} onChange={(event) => { setNewName(event.target.value); setError(''); setMessage('') }} placeholder={`Add ${detail.singular}`} /><button className="h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-40" type="submit" disabled={isBusy || !newName.trim()}>Add</button></form>
        {error ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-600">{error}</p> : message ? <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">{message}</p> : null}
        {isBusy && !options.length ? <p className="mt-4 text-xs font-semibold text-slate-400">Loading options…</p> : <div className="mt-4 space-y-2">{options.map((option, index) => <article className={`rounded-xl border px-3.5 py-3 ${option.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60'}`} key={option.id}>{editingId === option.id ? <form className="flex gap-2" onSubmit={(event) => rename(event, option)}><input className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-brand-blue outline-none focus:border-brand-blue/40" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button className="h-9 rounded-lg bg-brand-blue px-3 text-[10px] font-bold text-white" type="submit" disabled={isBusy}>Save</button><button className="h-9 rounded-lg px-3 text-[10px] font-bold text-slate-400" type="button" onClick={() => setEditingId(null)}>Cancel</button></form> : <div className="flex items-center gap-3"><span className={`size-2 shrink-0 rounded-full ${option.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} /><div className="min-w-0 flex-1"><p className={`truncate text-xs font-bold ${option.isActive ? 'text-slate-700' : 'text-slate-400'}`}>{option.name}</p><p className="mt-0.5 text-[9px] text-slate-400">{option.usageCount} linked record{option.usageCount === 1 ? '' : 's'} · {option.isActive ? 'Active' : 'Inactive'}</p></div><div className="flex shrink-0 items-center gap-1"><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-brand-blue disabled:opacity-25" type="button" onClick={() => move(option, -1)} disabled={isBusy || index === 0} aria-label={`Move ${option.name} up`}><Icon path="m18 15-6-6-6 6" /></button><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:translate-y-0.5 hover:bg-slate-50 hover:text-brand-blue disabled:opacity-25" type="button" onClick={() => move(option, 1)} disabled={isBusy || index === options.length - 1} aria-label={`Move ${option.name} down`}><Icon path="m6 9 6 6 6-6" /></button><button className={`h-8 rounded-lg px-2.5 text-[9px] font-bold transition hover:-translate-y-0.5 ${option.isActive ? 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`} type="button" onClick={() => toggle(option)} disabled={isBusy}>{option.isActive ? 'Deactivate' : 'Activate'}</button><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:text-brand-blue" type="button" onClick={() => { setEditingId(option.id); setEditingName(option.name); setError(''); setMessage('') }} aria-label={`Rename ${option.name}`}><Icon path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></button><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 disabled:opacity-25" type="button" onClick={() => remove(option)} disabled={isBusy || option.usageCount > 0} aria-label={`Delete ${option.name}`}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div></div>}</article>)}</div>}
      </div>
    </div>
  </section>
}
