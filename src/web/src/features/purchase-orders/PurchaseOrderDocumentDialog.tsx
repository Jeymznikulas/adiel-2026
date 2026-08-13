import type { FormEvent } from 'react'
import { useState } from 'react'
import { DocumentExportDialog } from '../../components/ui/DocumentExportDialog'
import { createPurchaseOrderPdfBlob } from '../../services/pdf/documentPdf'
import { loadCompanyProfile, loadDocumentDefaults, type CompanyProfile } from '../settings/settingsStorage'

type DocumentLine = { id: string; itemName: string; variantLabel: string; productCode: string; unitOfMeasure: string; quantity: number; unitCost: number }
type DocumentCharge = { id: string; label: string; amount: number }
type DocumentOrder = { id: string; poNumber: string; date: string; subject: string; modeOfPayment: string; paymentTerm: string; deliveryLocation: string; modeOfDelivery: string; items: DocumentLine[]; subtotalAmount: number; vatEnabled: boolean; vatAmount: number; otherCharges: DocumentCharge[]; totalAmount: number; notes: string; terms: string }
type DocumentSupplier = { name: string; address: string; contactPerson: string; phone: string; email: string }

type PurchaseOrderDocumentDialogProps = {
  order: DocumentOrder
  supplier: DocumentSupplier
  onSaveOrderContent: (notes: string, terms: string) => void
  onClose: () => void
}

const labelClassName = 'mb-1.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function profileIsComplete(profile: CompanyProfile) {
  return Boolean(profile.companyName.trim() && profile.address.trim() && profile.mainOfficeNumber.trim() && profile.email.trim() && profile.tin.trim())
}

export function PurchaseOrderDocumentDialog({ order, supplier, onSaveOrderContent, onClose }: PurchaseOrderDocumentDialogProps) {
  const [profile] = useState(loadCompanyProfile)
  const [notes, setNotes] = useState(order.notes)
  const [terms, setTerms] = useState(() => order.terms || loadDocumentDefaults().purchaseOrderTerms)
  const [error, setError] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const isProfileComplete = profileIsComplete(profile)

  function openSettings() {
    onClose()
    window.history.pushState(null, '', '/settings')
    window.dispatchEvent(new Event('adiel:navigate'))
  }

  function previewDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isProfileComplete) {
      setError('Complete the shared Company Profile in Settings before exporting this PDF.')
      return
    }
    const normalizedNotes = notes.trim()
    const normalizedTerms = terms.trim()
    onSaveOrderContent(normalizedNotes, normalizedTerms)
    setIsPreviewOpen(true)
  }

  if (isPreviewOpen) return <DocumentExportDialog
    title="Purchase order preview"
    reference={order.poNumber}
    pdfFilename={`${order.poNumber}-purchase-order.pdf`}
    pngFilename={`${order.poNumber}-purchase-order.png`}
    createPdfBlob={() => createPurchaseOrderPdfBlob(order, supplier, profile, notes.trim(), terms.trim())}
    onClose={() => setIsPreviewOpen(false)}
  />

  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="po-document-title">
    <button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close purchase order export" />
    <form className="relative my-6 w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.36)]" onSubmit={previewDocument}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Professional document</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="po-document-title">Export purchase order</h2><p className="mt-1 text-xs text-slate-400">{order.poNumber} - Download a ready-to-send PDF</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></header>
      <div className="max-h-[calc(100svh-12rem)] space-y-5 overflow-y-auto px-6 py-5">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}
        <section className={`rounded-2xl border p-4 ${isProfileComplete ? 'border-emerald-100 bg-emerald-50/45' : 'border-amber-200 bg-amber-50/55'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${isProfileComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><Icon className="size-5" path="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Shared company profile</p><h3 className="mt-1 truncate text-sm font-extrabold text-brand-blue">{profile.companyName}</h3><p className="mt-1 truncate text-[10px] text-slate-500">{profile.email || 'Email not configured'} · {profile.tin ? `TIN ${profile.tin}` : 'TIN not configured'}</p></div></div><button className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-blue/10 bg-white px-3 text-[10px] font-bold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50" type="button" onClick={openSettings}><Icon className="size-3.5" path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />Open Settings</button></div>
          <p className="mt-3 border-t border-current/10 pt-3 text-[10px] leading-4 text-slate-500">Company details are managed once in Settings and shared by quotation, PO, and SOA PDFs.</p>
        </section>
        <section><div><h3 className="text-xs font-extrabold text-brand-blue">Document-specific content</h3><p className="mt-1 text-[10px] text-slate-400">These values are saved only with {order.poNumber}.</p></div><div className="mt-4 grid gap-4">
          <div><label className={labelClassName} htmlFor="po-document-notes">Notes / remarks</label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-xs font-medium leading-5 text-brand-blue outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="po-document-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery instructions or remarks..." /></div>
          <div><label className={labelClassName} htmlFor="po-document-terms">Terms &amp; conditions <span className="normal-case tracking-normal text-slate-300">(one per line)</span></label><textarea className="min-h-36 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-xs font-medium leading-5 text-brand-blue outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="po-document-terms" value={terms} onChange={(event) => setTerms(event.target.value)} /></div>
        </div></section>
        <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3.5 py-3"><Icon className="mt-0.5 size-3.5 shrink-0 text-brand-blue" path="M12 8h.01M11 12h1v4h1M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /><p className="text-[10px] leading-4 text-slate-500">A ready-to-send PDF will download directly to your device.</p></div>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onClose}>Cancel</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={!isProfileComplete}><Icon className="size-3.5" path="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />Preview &amp; Export</button></footer>
    </form>
  </div>
}
