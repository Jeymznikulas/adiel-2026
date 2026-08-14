import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import type { BusinessSettingsTab } from './settingsStorage'

type ManagedOption = { id: string; name: string; isActive: boolean }
type StoredRecord = Record<string, unknown>

const expenseCategoryDefaults = ['Materials', 'Transportation', 'Office supplies', 'Utilities', 'Meals', 'Equipment', 'Professional fees', 'Other']
const paymentMethodDefaults = ['Cash', 'GCash', 'Bank transfer', 'Credit card', 'Cheque', 'Other']
const clientIndustryDefaults = ['Construction', 'Retail', 'Real estate', 'Manufacturing', 'Hospitality', 'Government', 'Education', 'Healthcare', 'Professional services', 'Other']
const itemCategoryDefaults = ['Electrical', 'Hardware', 'Construction materials', 'Safety equipment', 'Plumbing', 'Tools', 'Office supplies', 'Other']

const tabDetails: Array<{ id: BusinessSettingsTab; label: string; description: string }> = [
  { id: 'expense-categories', label: 'Expense categories', description: 'Classify business and project spending.' },
  { id: 'payment-methods', label: 'Payment methods', description: 'Control the methods available when recording expenses.' },
  { id: 'client-industries', label: 'Client industries', description: 'Keep client classifications consistent.' },
  { id: 'item-categories', label: 'Item categories', description: 'Organize the product and service catalogue.' },
]

const optionStorageKeys: Record<BusinessSettingsTab, string> = {
  'expense-categories': 'adiel.expense-categories',
  'payment-methods': 'adiel.expense-payment-methods',
  'client-industries': 'adiel.client-industries',
  'item-categories': 'adiel.item-categories',
}

const defaults: Record<BusinessSettingsTab, string[]> = {
  'expense-categories': expenseCategoryDefaults,
  'payment-methods': paymentMethodDefaults,
  'client-industries': clientIndustryDefaults,
  'item-categories': itemCategoryDefaults,
}

function readArray(key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function defaultOptions(tab: BusinessSettingsTab) {
  return defaults[tab].map((name, index) => ({ id: `${tab}-${index + 1}`, name, isActive: true }))
}

function loadOptions(tab: BusinessSettingsTab): ManagedOption[] {
  const stored = readArray(optionStorageKeys[tab])
  if (tab === 'item-categories') {
    const names = stored.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    const used = readArray('adiel.items').flatMap((value) => typeof value === 'object' && value !== null && typeof (value as StoredRecord).category === 'string' ? [(value as StoredRecord).category as string] : [])
    const source = names.length ? names : defaults[tab]
    return Array.from(new Set([...source, ...used])).sort((left, right) => left.localeCompare(right)).map((name) => ({ id: `item-category-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, isActive: true }))
  }

  const options = stored.flatMap((value): ManagedOption[] => {
    if (typeof value !== 'object' || value === null) return []
    const option = value as Partial<ManagedOption>
    return typeof option.id === 'string' && typeof option.name === 'string' && typeof option.isActive === 'boolean' ? [{ id: option.id, name: option.name, isActive: option.isActive }] : []
  })
  const normalized = options.length ? options : defaultOptions(tab)
  return normalized.some((option) => option.isActive) ? normalized : normalized.map((option, index) => index === 0 ? { ...option, isActive: true } : option)
}

function loadAllOptions() {
  return Object.fromEntries(tabDetails.map((tab) => [tab.id, loadOptions(tab.id)])) as Record<BusinessSettingsTab, ManagedOption[]>
}

function usageDefinition(tab: BusinessSettingsTab) {
  if (tab === 'expense-categories') return { storageKey: 'adiel.expenses', field: 'category', singular: 'expense' }
  if (tab === 'payment-methods') return { storageKey: 'adiel.expenses', field: 'paymentMethod', singular: 'expense' }
  if (tab === 'client-industries') return { storageKey: 'adiel.clients', field: 'industry', singular: 'client' }
  return { storageKey: 'adiel.items', field: 'category', singular: 'item' }
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function BusinessOptionsSettings({ initialTab }: { initialTab: BusinessSettingsTab }) {
  const [activeTab, setActiveTab] = useState<BusinessSettingsTab>(initialTab)
  const [groups, setGroups] = useState(loadAllOptions)
  const [records, setRecords] = useState<Record<BusinessSettingsTab, StoredRecord[]>>(() => Object.fromEntries(tabDetails.map(({ id }) => [id, readArray(usageDefinition(id).storageKey).filter((value): value is StoredRecord => typeof value === 'object' && value !== null)])) as Record<BusinessSettingsTab, StoredRecord[]>)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const options = groups[activeTab]
  const detail = tabDetails.find((tab) => tab.id === activeTab) ?? { id: 'expense-categories' as const, label: 'Expense categories', description: 'Classify business and project spending.' }
  const supportsActivation = activeTab !== 'item-categories'
  const activeCount = options.filter((option) => option.isActive).length
  const definition = usageDefinition(activeTab)
  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    records[activeTab].forEach((record) => {
      const value = record[definition.field]
      if (typeof value === 'string') counts.set(value, (counts.get(value) ?? 0) + 1)
    })
    return counts
  }, [activeTab, definition.field, records])

  function chooseTab(tab: BusinessSettingsTab) {
    setActiveTab(tab)
    setNewName('')
    setEditingId(null)
    setError('')
    setMessage('')
    window.history.replaceState(null, '', `/settings?section=options&tab=${tab}`)
  }

  function persist(tab: BusinessSettingsTab, next: ManagedOption[]) {
    const stored = tab === 'item-categories' ? next.map((option) => option.name) : next
    window.localStorage.setItem(optionStorageKeys[tab], JSON.stringify(stored))
    setGroups((current) => ({ ...current, [tab]: next }))
    window.dispatchEvent(new Event('adiel:settings-changed'))
  }

  function addOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name || options.some((option) => option.name.toLowerCase() === name.toLowerCase())) {
      setError(name ? 'That option already exists.' : 'Enter an option name.')
      return
    }
    try {
      const next = [...options, { id: crypto.randomUUID(), name, isActive: true }]
      persist(activeTab, activeTab === 'item-categories' ? next.sort((left, right) => left.name.localeCompare(right.name)) : next)
      setNewName('')
      setError('')
      setMessage(`${name} added`)
    } catch { setError('This option could not be saved.') }
  }

  function renameOption(event: FormEvent<HTMLFormElement>, option: ManagedOption) {
    event.preventDefault()
    const name = editingName.trim()
    if (!name || options.some((entry) => entry.id !== option.id && entry.name.toLowerCase() === name.toLowerCase())) {
      setError(name ? 'That option name is already in use.' : 'Enter an option name.')
      return
    }
    try {
      const updatedRecords = records[activeTab].map((record) => record[definition.field] === option.name ? { ...record, [definition.field]: name } : record)
      window.localStorage.setItem(definition.storageKey, JSON.stringify(updatedRecords))
      setRecords((current) => ({ ...current, [activeTab]: updatedRecords }))
      const next = options.map((entry) => entry.id === option.id ? { ...entry, name } : entry)
      persist(activeTab, activeTab === 'item-categories' ? next.sort((left, right) => left.name.localeCompare(right.name)) : next)
      setEditingId(null)
      setError('')
      setMessage(`${option.name} renamed to ${name}`)
    } catch { setError('This option could not be renamed.') }
  }

  function toggleOption(option: ManagedOption) {
    if (!supportsActivation || (option.isActive && activeCount === 1)) {
      if (supportsActivation) setError('At least one option must remain active.')
      return
    }
    try {
      persist(activeTab, options.map((entry) => entry.id === option.id ? { ...entry, isActive: !entry.isActive } : entry))
      setError('')
      setMessage(`${option.name} ${option.isActive ? 'deactivated' : 'activated'}`)
    } catch { setError('This option could not be updated.') }
  }

  function moveOption(option: ManagedOption, direction: -1 | 1) {
    const index = options.findIndex((entry) => entry.id === option.id)
    const destination = index + direction
    if (index < 0 || destination < 0 || destination >= options.length) return
    const next = [...options]
    const target = next[destination]
    if (!target) return
    next[index] = target
    next[destination] = option
    try { persist(activeTab, next); setMessage('Display order updated'); setError('') } catch { setError('The display order could not be saved.') }
  }

  function deleteOption(option: ManagedOption) {
    const usage = usageCounts.get(option.name) ?? 0
    if (usage) {
      setError(`${option.name} is used by ${usage} ${definition.singular}${usage === 1 ? '' : 's'} and cannot be deleted.`)
      return
    }
    if (options.length === 1 || (supportsActivation && option.isActive && activeCount === 1)) {
      setError('At least one option must remain available.')
      return
    }
    try {
      persist(activeTab, options.filter((entry) => entry.id !== option.id))
      setEditingId(null)
      setError('')
      setMessage(`${option.name} deleted`)
    } catch { setError('This option could not be deleted.') }
  }

  return <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]">
    <header className="border-b border-slate-100 px-5 py-4 sm:px-6"><h3 className="text-base font-extrabold text-brand-blue">Business Options</h3><p className="mt-1 text-xs text-slate-400">Reusable classifications shared by daily entry forms.</p></header>
    <div className="grid lg:grid-cols-[15rem_1fr]">
      <nav className="border-b border-slate-100 bg-slate-50/55 p-3 lg:border-b-0 lg:border-r" aria-label="Business option groups">{tabDetails.map((tab) => <button className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${activeTab === tab.id ? 'bg-white text-brand-blue shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-brand-blue'}`} type="button" onClick={() => chooseTab(tab.id)} key={tab.id}><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${activeTab === tab.id ? 'bg-blue-50 text-brand-blue' : 'bg-slate-100 text-slate-400'}`}><Icon className="size-3.5" path={tab.id === 'payment-methods' ? 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' : tab.id === 'client-industries' ? 'M3 21h18M5 21V7l7-4 7 4v14' : 'M4 5h16v14H4V5Zm4 4h8M8 13h5'} /></span><span><span className="block text-xs font-extrabold">{tab.label}</span><span className="mt-1 block text-[9px] leading-4 text-slate-400">{tab.description}</span></span></button>)}</nav>
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-extrabold text-brand-blue">{detail.label}</h4><p className="mt-1 text-[10px] text-slate-400">{supportsActivation ? `${activeCount} active of ${options.length} options` : `${options.length} available categories`}</p></div><span className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[9px] font-bold text-violet-700">Used across the system</span></div>
        <form className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50/55 p-3" onSubmit={addOption}><label className="sr-only" htmlFor="business-option-name">New option</label><input className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40" id="business-option-name" value={newName} onChange={(event) => { setNewName(event.target.value); setError(''); setMessage('') }} placeholder={`Add ${detail.label.toLowerCase().replace(/s$/, '')}`} /><button className="h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white disabled:opacity-40" type="submit" disabled={!newName.trim()}>Add</button></form>
        {error ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-600">{error}</p> : message ? <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">{message}</p> : null}
        <div className="mt-4 space-y-2">{options.map((option, index) => {
          const usage = usageCounts.get(option.name) ?? 0
          return <article className={`rounded-xl border px-3.5 py-3 ${option.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60'}`} key={option.id}>{editingId === option.id ? <form className="flex gap-2" onSubmit={(event) => renameOption(event, option)}><input className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-brand-blue outline-none focus:border-brand-blue/40" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button className="h-9 rounded-lg bg-brand-blue px-3 text-[10px] font-bold text-white" type="submit">Save</button><button className="h-9 rounded-lg px-3 text-[10px] font-bold text-slate-400" type="button" onClick={() => setEditingId(null)}>Cancel</button></form> : <div className="flex items-center gap-3"><span className={`size-2 shrink-0 rounded-full ${option.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} /><div className="min-w-0 flex-1"><p className={`truncate text-xs font-bold ${option.isActive ? 'text-slate-700' : 'text-slate-400'}`}>{option.name}</p><p className="mt-0.5 text-[9px] text-slate-400">{usage} {definition.singular}{usage === 1 ? '' : 's'} using this option{supportsActivation ? ` · ${option.isActive ? 'Active' : 'Inactive'}` : ''}</p></div><div className="flex shrink-0 items-center gap-1">{supportsActivation ? <><button className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-brand-blue disabled:opacity-25" type="button" onClick={() => moveOption(option, -1)} disabled={index === 0} aria-label={`Move ${option.name} up`}><Icon className="size-3.5" path="m18 15-6-6-6 6" /></button><button className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-brand-blue disabled:opacity-25" type="button" onClick={() => moveOption(option, 1)} disabled={index === options.length - 1} aria-label={`Move ${option.name} down`}><Icon className="size-3.5" path="m6 9 6 6 6-6" /></button><button className={`h-8 rounded-lg px-2.5 text-[9px] font-bold ${option.isActive ? 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`} type="button" onClick={() => toggleOption(option)}>{option.isActive ? 'Deactivate' : 'Activate'}</button></> : null}<button className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-blue-50 hover:text-brand-blue" type="button" onClick={() => { setEditingId(option.id); setEditingName(option.name); setError(''); setMessage('') }} aria-label={`Rename ${option.name}`}><Icon className="size-3.5" path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></button><button className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-25" type="button" onClick={() => deleteOption(option)} disabled={usage > 0} aria-label={`Delete ${option.name}`} title={usage ? `Used by ${usage} ${definition.singular}${usage === 1 ? '' : 's'}` : 'Delete'}><Icon className="size-3.5" path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div></div>}</article>
        })}</div>
      </div>
    </div>
  </section>
}
