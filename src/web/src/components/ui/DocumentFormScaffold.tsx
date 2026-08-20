import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type DocumentFormAction = {
  label: string
  intent?: string
  tone?: 'primary' | 'neutral'
  disabled?: boolean
}

type DocumentFormScaffoldProps = {
  dialogTitleId: string
  breakdown: Array<{ label: string; value: string; muted?: boolean }>
  totalLabel: string
  totalValue: string
  onCancel: () => void
  actions: DocumentFormAction[]
  helperText?: string
  backLabel?: string
  hideFieldIds?: string[]
}

const emptyFieldIds: string[] = []

function submitWithIntent(form: HTMLFormElement, intent?: string) {
  const button = document.createElement('button')
  button.type = 'submit'
  button.hidden = true
  if (intent) button.dataset.intent = intent
  form.append(button)
  const previousNoValidate = form.noValidate
  if (intent === 'draft') form.noValidate = true
  form.requestSubmit(button)
  form.noValidate = previousNoValidate
  button.remove()
}

export function DocumentFormScaffold({ dialogTitleId, breakdown, totalLabel, totalValue, onCancel, actions, helperText, backLabel = 'Back to register', hideFieldIds = emptyFieldIds }: DocumentFormScaffoldProps) {
  const [form, setForm] = useState<HTMLFormElement | null>(null)
  const [backHost, setBackHost] = useState<HTMLDivElement | null>(null)
  const [footerHost, setFooterHost] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const page = document.querySelector<HTMLElement>(`[aria-labelledby="${dialogTitleId}"]`)
    const nextForm = page?.querySelector<HTMLFormElement>('form')
    const header = nextForm?.firstElementChild
    const scrollArea = nextForm?.children.item(1)
    if (!page || !nextForm || !(header instanceof HTMLElement) || !(scrollArea instanceof HTMLElement)) return

    const originalFooter = nextForm.lastElementChild instanceof HTMLElement ? nextForm.lastElementChild : null
    const moduleRoot = page.parentElement
    const backdrop = page.firstElementChild instanceof HTMLButtonElement ? page.firstElementChild : null
    const closeButton = header.querySelector<HTMLButtonElement>(':scope > button:last-child')
    const titleBlock = header.firstElementChild instanceof HTMLElement ? header.firstElementChild : null
    const backContainer = document.createElement('div')
    const footerContainer = document.createElement('div')
    const original = {
      pageClass: page.className,
      pageRole: page.getAttribute('role'),
      modal: page.getAttribute('aria-modal'),
      formClass: nextForm.className,
      headerClass: header.className,
      scrollClass: scrollArea.className,
      footerDisplay: originalFooter?.style.display ?? '',
      backdropDisplay: backdrop?.style.display ?? '',
      closeDisplay: closeButton?.style.display ?? '',
      titleClass: titleBlock?.className ?? '',
      pageMarker: page.dataset.documentFormPage,
    }

    backContainer.dataset.documentFormBack = dialogTitleId
    footerContainer.dataset.documentFormFooter = dialogTitleId
    header.insertBefore(backContainer, header.firstChild)
    nextForm.append(footerContainer)

    const pageIndex = moduleRoot ? Array.from(moduleRoot.children).indexOf(page) : -1
    const hiddenRegisterElements = moduleRoot && pageIndex > 0 ? Array.from(moduleRoot.children).slice(0, pageIndex).flatMap((element) => {
      if (!(element instanceof HTMLElement)) return []
      const display = element.style.display
      element.style.display = 'none'
      return [{ element, display }]
    }) : []

    page.className = 'app-document-page relative !mt-0'
    page.dataset.documentFormPage = dialogTitleId
    page.setAttribute('role', 'region')
    page.removeAttribute('aria-modal')
    nextForm.className = 'app-form-page mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-7xl flex-col overflow-visible rounded-[1.5rem] border border-slate-200 bg-white'
    header.className = `${original.headerClass} sticky top-16 z-10 rounded-t-[1.5rem] bg-white/95 backdrop-blur lg:top-[4.75rem]`
    scrollArea.className = `${original.scrollClass} !max-h-none flex-1 !overflow-visible !px-4 sm:!px-6 lg:!px-8`
    if (originalFooter && originalFooter !== scrollArea) originalFooter.style.display = 'none'
    if (backdrop) backdrop.style.display = 'none'
    if (closeButton) closeButton.style.display = 'none'
    if (titleBlock) titleBlock.classList.add('min-w-0', 'flex-1')

    const hiddenElements = hideFieldIds.flatMap((id) => {
      const field = document.getElementById(id)
      const wrapper = field?.parentElement
      if (!wrapper) return []
      const display = wrapper.style.display
      wrapper.style.display = 'none'
      return [{ element: wrapper, display }]
    })

    setForm(nextForm)
    setBackHost(backContainer)
    setFooterHost(footerContainer)

    return () => {
      page.className = original.pageClass
      if (original.pageRole) page.setAttribute('role', original.pageRole); else page.removeAttribute('role')
      if (original.modal) page.setAttribute('aria-modal', original.modal); else page.removeAttribute('aria-modal')
      nextForm.className = original.formClass
      header.className = original.headerClass
      scrollArea.className = original.scrollClass
      if (originalFooter) originalFooter.style.display = original.footerDisplay
      if (backdrop) backdrop.style.display = original.backdropDisplay
      if (closeButton) closeButton.style.display = original.closeDisplay
      if (titleBlock) titleBlock.className = original.titleClass
      if (original.pageMarker) page.dataset.documentFormPage = original.pageMarker; else delete page.dataset.documentFormPage
      hiddenRegisterElements.forEach(({ element, display }) => { element.style.display = display })
      hiddenElements.forEach(({ element, display }) => { element.style.display = display })
      backContainer.remove()
      footerContainer.remove()
    }
  }, [dialogTitleId, hideFieldIds])

  const back = backHost ? createPortal(<button className="mr-3 inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={onCancel} aria-label={backLabel}><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span className="hidden sm:inline">{backLabel}</span></button>, backHost) : null

  const footer = footerHost && form ? createPortal(<footer className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-16px_36px_-30px_rgba(0,20,76,0.55)] backdrop-blur sm:px-6 lg:px-8"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">{breakdown.map((item) => <div className={item.muted ? 'opacity-45' : ''} key={item.label}><p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">{item.label}</p><p className="mt-0.5 text-xs font-extrabold tabular-nums text-slate-600">{item.value}</p></div>)}<div className="border-l border-slate-200 pl-5"><p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-orange">{totalLabel}</p><p className="mt-0.5 text-base font-extrabold tabular-nums text-brand-blue">{totalValue}</p></div>{helperText ? <p className="hidden max-w-sm text-[9px] leading-4 text-slate-400 2xl:block">{helperText}</p> : null}</div><div className="flex shrink-0 flex-wrap justify-end gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button>{actions.map((action) => <button className={`h-10 rounded-xl px-4 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${action.tone === 'primary' ? 'bg-[linear-gradient(115deg,#00113f,#073078)] text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] hover:-translate-y-0.5' : 'border border-slate-200 bg-white text-brand-blue hover:bg-blue-50'}`} type="button" onClick={() => submitWithIntent(form, action.intent)} disabled={action.disabled} key={action.label}>{action.label}</button>)}</div></div></footer>, footerHost) : null

  return <>{back}{footer}</>
}
