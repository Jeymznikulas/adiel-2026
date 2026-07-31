import type { FormEvent } from 'react'
import { useState } from 'react'

export type ExpenseOption = {
  id: string
  name: string
  isActive: boolean
}

export type ExpenseOptionKind = 'categories' | 'paymentMethods'

type ExpenseSettingsDialogProps = {
  tab: ExpenseOptionKind
  categoryOptions: ExpenseOption[]
  paymentMethodOptions: ExpenseOption[]
  usedCategories: Set<string>
  usedPaymentMethods: Set<string>
  onTabChange: (tab: ExpenseOptionKind) => void
  onAdd: (kind: ExpenseOptionKind, name: string) => boolean
  onRename: (kind: ExpenseOptionKind, id: string, name: string) => boolean
  onMove: (kind: ExpenseOptionKind, id: string, direction: -1 | 1) => void
  onToggle: (kind: ExpenseOptionKind, id: string) => void
  onDelete: (kind: ExpenseOptionKind, id: string) => void
  onClose: () => void
}

export function ExpenseSettingsDialog({ tab, categoryOptions, paymentMethodOptions, usedCategories, usedPaymentMethods, onTabChange, onAdd, onRename, onMove, onToggle, onDelete, onClose }: ExpenseSettingsDialogProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const options = tab === 'categories' ? categoryOptions : paymentMethodOptions
  const usedNames = tab === 'categories' ? usedCategories : usedPaymentMethods
  const activeCount = options.filter((option) => option.isActive).length
  const singularLabel = tab === 'categories' ? 'category' : 'payment method'

  function switchTab(nextTab: ExpenseOptionKind) {
    setNewName('')
    setEditingId(null)
    setErrorMessage(null)
    onTabChange(nextTab)
  }

  function addOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (onAdd(tab, newName)) {
      setNewName('')
      setErrorMessage(null)
    } else {
      setErrorMessage(`That ${singularLabel} already exists.`)
    }
  }

  function beginRename(option: ExpenseOption) {
    setEditingId(option.id)
    setEditingName(option.name)
    setErrorMessage(null)
  }

  function saveRename(event: FormEvent<HTMLFormElement>, option: ExpenseOption) {
    event.preventDefault()
    if (onRename(tab, option.id, editingName)) {
      setEditingId(null)
      setErrorMessage(null)
    } else {
      setErrorMessage(`That ${singularLabel} name is already in use.`)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="expense-settings-title">
      <button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close expense settings" />
      <section className="relative my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.32)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">Expense configuration</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="expense-settings-title">Expense settings</h2><p className="mt-1 text-sm text-slate-500">Keep entry options organized and consistent.</p></div>
          <button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose} aria-label="Close settings"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </header>

        <div className="border-b border-slate-100 px-6 pt-4">
          <div className="flex gap-1" role="tablist" aria-label="Expense settings sections">
            {([['categories', 'Categories', categoryOptions.length], ['paymentMethods', 'Payment methods', paymentMethodOptions.length]] as const).map(([value, label, count]) => <button className={`border-b-2 px-4 py-3 text-xs font-bold transition ${tab === value ? 'border-brand-orange text-brand-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`} type="button" role="tab" aria-selected={tab === value} key={value} onClick={() => switchTab(value)}>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${tab === value ? 'bg-brand-blue/[0.07] text-brand-blue' : 'bg-slate-100 text-slate-400'}`}>{count}</span></button>)}
          </div>
        </div>

        <div className="px-6 py-5">
          <form className="flex gap-2" onSubmit={addOption}>
            <label className="sr-only" htmlFor="new-expense-option">Add {singularLabel}</label>
            <input className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-brand-blue outline-none placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="new-expense-option" value={newName} onChange={(event) => { setNewName(event.target.value); setErrorMessage(null) }} placeholder={`New ${singularLabel} name`} maxLength={60} required />
            <button className="h-11 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5" type="submit">Add option</button>
          </form>
          <p className={`mt-2 text-[11px] ${errorMessage ? 'font-semibold text-red-600' : 'text-slate-400'}`} role={errorMessage ? 'alert' : undefined}>{errorMessage ?? 'Names must be unique. Changes are saved automatically.'}</p>

          <div className="mt-5 max-h-[23rem] space-y-2 overflow-y-auto pr-1">
            {options.map((option, index) => {
              const isUsed = usedNames.has(option.name)
              const cannotDeactivate = option.isActive && activeCount === 1
              return (
                <div className={`rounded-xl border p-3 transition ${option.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/70'}`} key={option.id}>
                  <div className="flex items-center gap-3">
                    <span className={`size-2 shrink-0 rounded-full ${option.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
                    {editingId === option.id ? (
                      <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => saveRename(event, option)}><label className="sr-only" htmlFor={`edit-option-${option.id}`}>Rename {option.name}</label><input className="h-9 min-w-0 flex-1 rounded-lg border border-brand-blue/30 px-3 text-sm font-semibold text-brand-blue outline-none ring-4 ring-brand-blue/[0.05]" id={`edit-option-${option.id}`} value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={60} autoFocus required /><button className="rounded-lg bg-brand-blue px-3 text-[11px] font-bold text-white" type="submit">Save</button><button className="rounded-lg px-2 text-[11px] font-bold text-slate-400 hover:bg-slate-100" type="button" onClick={() => setEditingId(null)}>Cancel</button></form>
                    ) : (
                      <div className="min-w-0 flex-1"><p className={`truncate text-sm font-bold ${option.isActive ? 'text-brand-blue' : 'text-slate-400'}`}>{option.name}</p><div className="mt-1 flex items-center gap-2"><span className={`text-[10px] font-bold uppercase tracking-wider ${option.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{option.isActive ? 'Active' : 'Inactive'}</span>{isUsed ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">In use</span> : null}</div></div>
                    )}

                    {editingId !== option.id ? <div className="flex shrink-0 items-center gap-1"><button className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-25" type="button" onClick={() => onMove(tab, option.id, -1)} disabled={index === 0} aria-label={`Move ${option.name} up`}><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg></button><button className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-25" type="button" onClick={() => onMove(tab, option.id, 1)} disabled={index === options.length - 1} aria-label={`Move ${option.name} down`}><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button><button className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => beginRename(option)} aria-label={`Rename ${option.name}`}><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" /></svg></button><button className={`h-8 rounded-lg px-2.5 text-[10px] font-bold transition ${option.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`} type="button" onClick={() => onToggle(tab, option.id)} disabled={cannotDeactivate} title={cannotDeactivate ? `At least one ${singularLabel} must remain active` : undefined}>{option.isActive ? 'Disable' : 'Enable'}</button><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-25" type="button" onClick={() => onDelete(tab, option.id)} disabled={isUsed || options.length === 1 || cannotDeactivate} title={isUsed ? 'Options used by expense records cannot be deleted' : cannotDeactivate ? `At least one ${singularLabel} must remain active` : undefined} aria-label={`Delete ${option.name}`}><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></svg></button></div> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4"><p className="text-[11px] text-slate-400">Inactive options stay on existing expense records.</p><button className="h-10 rounded-xl bg-brand-blue px-5 text-xs font-bold text-white" type="button" onClick={onClose}>Done</button></footer>
      </section>
    </div>
  )
}