import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type DocumentContentFieldsProps = {
  idPrefix: string
  notes: string
  terms: string
  defaultTerms: string
  onNotesChange: (value: string) => void
  onTermsChange: (value: string) => void
  notesLabel?: string
  termsLabel?: string
  addTermsLabel?: string
  notesPlaceholder?: string
  termsPlaceholder?: string
}

const textareaClassName = 'w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs font-medium leading-5 text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'

export function DocumentContentFields({
  idPrefix,
  notes,
  terms,
  defaultTerms,
  onNotesChange,
  onTermsChange,
  notesLabel = 'Notes / remarks',
  termsLabel = 'Terms and conditions',
  addTermsLabel = 'Add terms and conditions',
  notesPlaceholder = 'Add information specific to this document...',
  termsPlaceholder = 'Add one condition per line...',
}: DocumentContentFieldsProps) {
  const [notesOpen, setNotesOpen] = useState(Boolean(notes))
  const [termsOpen, setTermsOpen] = useState(Boolean(terms))

  function addTerms() {
    setTermsOpen(true)
    if (!terms.trim() && defaultTerms.trim()) onTermsChange(defaultTerms)
  }

  return <section className="mt-6 border-t border-slate-100 pt-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xs font-extrabold text-brand-blue">Additional document details</h3><p className="mt-1 text-[10px] text-slate-400">Optional content saved with this document and included in its PDF.</p></div>
      <div className="flex flex-wrap gap-2">
        {!notesOpen ? <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={() => setNotesOpen(true)}><span className="text-base font-medium leading-none text-brand-orange">+</span>Add note</button> : null}
        {!termsOpen ? <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={addTerms}><span className="text-base font-medium leading-none text-brand-orange">+</span>{addTermsLabel}</button> : null}
      </div>
    </div>

    {notesOpen || termsOpen ? <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {notesOpen ? <div className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4">
        <div className="mb-2 flex items-center justify-between gap-3"><label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor={`${idPrefix}-notes`}>{notesLabel}</label><button className="text-[9px] font-bold text-slate-400 transition hover:text-red-600" type="button" onClick={() => { onNotesChange(''); setNotesOpen(false) }}>Remove</button></div>
        <textarea className={`${textareaClassName} min-h-28`} id={`${idPrefix}-notes`} value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder={notesPlaceholder} />
      </div> : null}

      {termsOpen ? <div className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor={`${idPrefix}-terms`}>{termsLabel}</label><div className="flex items-center gap-3">{defaultTerms.trim() ? <button className="text-[9px] font-bold text-brand-blue transition hover:text-brand-orange" type="button" onClick={() => onTermsChange(defaultTerms)}>Restore company default</button> : null}<button className="text-[9px] font-bold text-slate-400 transition hover:text-red-600" type="button" onClick={() => { onTermsChange(''); setTermsOpen(false) }}>Remove</button></div></div>
        <textarea className={`${textareaClassName} min-h-36`} id={`${idPrefix}-terms`} value={terms} onChange={(event) => onTermsChange(event.target.value)} placeholder={termsPlaceholder} />
        <p className="mt-2 text-[9px] leading-4 text-slate-400">Use one condition or instruction per line for a cleaner PDF.</p>
      </div> : null}
    </div> : null}
  </section>
}

type DocumentContentFormSectionPortalProps = DocumentContentFieldsProps & {
  dialogTitleId: string
  hideExistingFieldId?: string
}

export function DocumentContentFormSectionPortal({ dialogTitleId, hideExistingFieldId, ...props }: DocumentContentFormSectionPortalProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const form = document.querySelector<HTMLFormElement>(`[aria-labelledby="${dialogTitleId}"] form`)
    const scrollArea = form?.children.item(1)
    if (!(scrollArea instanceof HTMLElement)) return

    const container = document.createElement('div')
    container.dataset.documentContentSection = dialogTitleId
    scrollArea.append(container)

    const existingField = hideExistingFieldId ? document.getElementById(hideExistingFieldId) : null
    const existingFieldLabel = existingField?.previousElementSibling instanceof HTMLElement ? existingField.previousElementSibling : null
    const previousFieldDisplay = existingField?.style.display ?? ''
    const previousLabelDisplay = existingFieldLabel?.style.display ?? ''
    if (existingField) existingField.style.display = 'none'
    if (existingFieldLabel) existingFieldLabel.style.display = 'none'

    setHost(container)
    return () => {
      if (existingField) existingField.style.display = previousFieldDisplay
      if (existingFieldLabel) existingFieldLabel.style.display = previousLabelDisplay
      container.remove()
    }
  }, [dialogTitleId, hideExistingFieldId])

  return host ? createPortal(<DocumentContentFields {...props} />, host) : null
}
