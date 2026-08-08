import type { FormEvent } from 'react'
import { useState } from 'react'
import { defaultPurchaseOrderTerms, loadPurchaseOrderCompanyProfile, savePurchaseOrderCompanyProfile, type PurchaseOrderCompanyProfile } from './purchaseOrderDocumentDefaults'

type DocumentLine = {
  id: string
  itemName: string
  variantLabel: string
  productCode: string
  unitOfMeasure: string
  quantity: number
  unitCost: number
}

type DocumentCharge = { id: string; label: string; amount: number }

type DocumentOrder = {
  id: string
  poNumber: string
  date: string
  subject: string
  modeOfPayment: string
  paymentTerm: string
  deliveryLocation: string
  modeOfDelivery: string
  items: DocumentLine[]
  subtotalAmount: number
  vatEnabled: boolean
  vatAmount: number
  otherCharges: DocumentCharge[]
  totalAmount: number
  notes: string
  terms: string
}

type DocumentSupplier = {
  name: string
  address: string
  contactPerson: string
  phone: string
  email: string
}

type PurchaseOrderDocumentDialogProps = {
  order: DocumentOrder
  supplier: DocumentSupplier
  onSaveOrderContent: (notes: string, terms: string) => void
  onClose: () => void
}

function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character)
}

function htmlLines(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

function printPurchaseOrder(order: DocumentOrder, supplier: DocumentSupplier, profile: PurchaseOrderCompanyProfile, notes: string, terms: string) {
  const popup = window.open('', '_blank', 'width=1100,height=850')
  if (!popup) return false
  const logoUrl = `${window.location.origin}/images/adiel-logo-flat.png`
  const itemRows = order.items.map((line, index) => `<tr><td class="center muted">${index + 1}</td><td><strong>${escapeHtml(line.itemName)}</strong><small>${escapeHtml(line.productCode)}${line.variantLabel ? ` · ${escapeHtml(line.variantLabel)}` : ''}</small></td><td>${escapeHtml(line.unitOfMeasure)}</td><td class="number">${escapeHtml(line.quantity)}</td><td class="number">${escapeHtml(formatPeso(line.unitCost))}</td><td class="number strong">${escapeHtml(formatPeso(line.quantity * line.unitCost))}</td></tr>`).join('')
  const charges = order.otherCharges.map((charge) => `<div class="total-row"><span>${escapeHtml(charge.label)}</span><strong>${escapeHtml(formatPeso(charge.amount))}</strong></div>`).join('')
  const termItems = terms.split(/\r?\n/).map((term) => term.trim()).filter(Boolean).map((term) => `<li>${escapeHtml(term)}</li>`).join('')
  const companyContacts: Array<[string, string]> = [
    ['Main office', profile.mainOfficeNumber],
    ['Client relations', profile.clientRelationsNumber],
    ['Accounts', profile.accountsNumber],
    ['New accounts', profile.newAccountsNumber],
  ]
  const contactRows = companyContacts.filter(([, value]) => value).map(([label, value]) => `<span><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</span>`).join('')

  popup.document.open()
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(order.poNumber)} · Purchase Order</title><style>
    @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#23324a;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:190mm;min-height:277mm;margin:16px auto;background:#fff;padding:10mm;box-shadow:0 18px 50px rgba(0,20,76,.14)}.top-rule{height:4px;background:linear-gradient(90deg,#00143f 0 78%,#f97316 78%);border-radius:99px;margin-bottom:18px}.header{display:grid;grid-template-columns:76px 1fr 58mm;gap:15px;align-items:start}.logo{width:70px;height:70px;object-fit:contain}.company h1{margin:1px 0 5px;color:#00143f;font-size:20px;line-height:1.1;letter-spacing:-.4px}.company .address{max-width:92mm;color:#526075;font-size:9px}.contacts{display:flex;flex-wrap:wrap;gap:2px 12px;margin-top:7px;color:#526075;font-size:8px}.contacts b{color:#00143f}.company-meta{margin-top:5px;color:#526075;font-size:8px}.po-title{border-left:3px solid #f97316;padding-left:14px}.po-title .eyebrow{color:#f97316;font-size:8px;font-weight:800;letter-spacing:1.8px}.po-title h2{margin:3px 0 10px;color:#00143f;font-size:25px;letter-spacing:-.8px}.meta-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dce3ed;border-radius:8px;overflow:hidden}.meta-grid div{padding:7px 8px;border-bottom:1px solid #e6ebf2}.meta-grid div:nth-last-child(-n+2){border-bottom:0}.meta-grid div:nth-child(odd){border-right:1px solid #e6ebf2}.label{display:block;margin-bottom:2px;color:#8995a7;font-size:7px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}.value{color:#1f2d43;font-size:9px;font-weight:700}.section{margin-top:16px}.section-title{display:flex;align-items:center;gap:8px;margin-bottom:7px;color:#00143f;font-size:9px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase}.section-title:before{content:"";width:16px;height:2px;background:#f97316;border-radius:99px}.recipient{display:grid;grid-template-columns:1.35fr 1fr;border:1px solid #dce3ed;border-radius:10px;overflow:hidden}.recipient>div{padding:11px 12px}.recipient>div+div{border-left:1px solid #e6ebf2;background:#f8fafc}.recipient h3{margin:0 0 5px;color:#00143f;font-size:13px}.recipient p{margin:2px 0;color:#526075}.subject{margin-top:10px;border-left:3px solid #f97316;background:#fff7ed;padding:8px 10px;border-radius:0 8px 8px 0}.subject b{color:#9a3412}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dce3ed;border-radius:10px;overflow:hidden}thead{display:table-header-group}th{padding:8px;background:#00143f;color:#fff;font-size:7.5px;letter-spacing:.7px;text-align:left;text-transform:uppercase}td{padding:8px;border-top:1px solid #e6ebf2;vertical-align:top}tbody tr:nth-child(even){background:#f8fafc}td small{display:block;margin-top:2px;color:#8995a7;font-size:7.5px}.number{text-align:right;font-variant-numeric:tabular-nums}.center{text-align:center}.strong{color:#00143f;font-weight:800}.muted{color:#8995a7}.after-table{display:grid;grid-template-columns:1fr 64mm;gap:14px;margin-top:12px;align-items:start}.notes{border:1px solid #dce3ed;border-radius:9px;padding:10px;min-height:52px}.notes p{margin:4px 0 0;color:#526075}.totals{border:1px solid #dce3ed;border-radius:10px;overflow:hidden}.total-row{display:flex;justify-content:space-between;gap:10px;padding:7px 10px;border-bottom:1px solid #e6ebf2;color:#526075}.grand{display:flex;justify-content:space-between;align-items:end;padding:11px;background:#00143f;color:#fff}.grand span{font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase}.grand strong{font-size:16px}.terms{margin-top:14px;border-top:1px solid #dce3ed;padding-top:11px}.terms ol{margin:6px 0 0;padding-left:18px;color:#526075}.terms li{margin:3px 0;padding-left:3px}.footer{display:flex;justify-content:space-between;gap:12px;margin-top:18px;border-top:3px solid #00143f;padding-top:7px;color:#8995a7;font-size:7.5px}.footer strong{color:#00143f}@media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.no-print{display:none!important}tr,.recipient,.after-table,.terms{break-inside:avoid}}
  </style></head><body><main class="page"><div class="top-rule"></div><header class="header"><img class="logo" src="${escapeHtml(logoUrl)}" alt="ADIEL logo"><div class="company"><h1>${escapeHtml(profile.companyName)}</h1><div class="address">${profile.address ? htmlLines(profile.address) : 'Company address not configured'}</div><div class="contacts">${contactRows || '<span>Contact numbers not configured</span>'}</div><div class="company-meta">${profile.email ? `<b>Email:</b> ${escapeHtml(profile.email)}` : 'Email not configured'} &nbsp; · &nbsp; ${profile.tin ? `<b>TIN:</b> ${escapeHtml(profile.tin)}` : 'TIN not configured'}</div></div><div class="po-title"><span class="eyebrow">PROCUREMENT DOCUMENT</span><h2>PURCHASE<br>ORDER</h2><div class="meta-grid"><div><span class="label">PO No.</span><span class="value">${escapeHtml(order.poNumber)}</span></div><div><span class="label">Date</span><span class="value">${escapeHtml(formatDate(order.date))}</span></div><div><span class="label">Payment</span><span class="value">${escapeHtml(order.modeOfPayment)}</span></div><div><span class="label">Terms</span><span class="value">${escapeHtml(order.paymentTerm)}</span></div><div><span class="label">Delivery mode</span><span class="value">${escapeHtml(order.modeOfDelivery)}</span></div><div><span class="label">Delivery location</span><span class="value">${escapeHtml(order.deliveryLocation)}</span></div></div></div></header><section class="section"><div class="section-title">Purchase order to</div><div class="recipient"><div><span class="label">Company name</span><h3>${escapeHtml(supplier.name)}</h3><span class="label">Address</span><p>${supplier.address ? htmlLines(supplier.address) : 'Not provided'}</p></div><div><span class="label">Contact person</span><p><strong>${escapeHtml(supplier.contactPerson || 'Not provided')}</strong></p><span class="label">Phone</span><p>${escapeHtml(supplier.phone || 'Not provided')}</p><span class="label">Email</span><p>${escapeHtml(supplier.email || 'Not provided')}</p></div></div>${order.subject ? `<div class="subject"><b>Subject:</b> ${escapeHtml(order.subject)}</div>` : ''}</section><section class="section"><div class="section-title">Order items</div><table><thead><tr><th style="width:7%;text-align:center">#</th><th style="width:37%">Description</th><th style="width:12%">Unit</th><th style="width:10%;text-align:right">Qty</th><th style="width:16%;text-align:right">Unit cost</th><th style="width:18%;text-align:right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table><div class="after-table"><div class="notes"><span class="label">Notes / remarks</span><p>${notes ? htmlLines(notes) : 'No additional remarks.'}</p></div><div class="totals"><div class="total-row"><span>Subtotal</span><strong>${escapeHtml(formatPeso(order.subtotalAmount))}</strong></div>${order.vatEnabled ? `<div class="total-row"><span>VAT (12%)</span><strong>${escapeHtml(formatPeso(order.vatAmount))}</strong></div>` : ''}${charges}<div class="grand"><span>Grand total</span><strong>${escapeHtml(formatPeso(order.totalAmount))}</strong></div></div></div></section><section class="terms"><span class="label">Standard terms &amp; conditions</span><ol>${termItems}</ol></section><footer class="footer"><span>This document was generated electronically by the ADIEL Operations System.</span><strong>${escapeHtml(order.poNumber)}</strong></footer></main></body></html>`)
  popup.document.close()
  window.setTimeout(() => { popup.focus(); popup.print() }, 500)
  return true
}

const fieldClassName = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-1.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function PurchaseOrderDocumentDialog({ order, supplier, onSaveOrderContent, onClose }: PurchaseOrderDocumentDialogProps) {
  const [profile, setProfile] = useState(loadPurchaseOrderCompanyProfile)
  const [notes, setNotes] = useState(order.notes)
  const [terms, setTerms] = useState(order.terms || defaultPurchaseOrderTerms)
  const [error, setError] = useState('')

  function updateProfile(field: keyof PurchaseOrderCompanyProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function exportDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile.companyName.trim() || !profile.address.trim() || !profile.mainOfficeNumber.trim() || !profile.email.trim() || !profile.tin.trim()) {
      setError('Complete the company name, address, main office number, email, and TIN before exporting.')
      return
    }
    const normalized = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value.trim()])) as PurchaseOrderCompanyProfile
    savePurchaseOrderCompanyProfile(normalized)
    onSaveOrderContent(notes.trim(), terms.trim())
    if (!printPurchaseOrder({ ...order, notes: notes.trim(), terms: terms.trim() }, supplier, normalized, notes.trim(), terms.trim())) {
      setError('The print window was blocked. Allow pop-ups for this site and try again.')
    } else {
      onClose()
    }
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="po-document-title"><button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close purchase order export" /><form className="relative my-6 w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.36)]" onSubmit={exportDocument}><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Professional document</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="po-document-title">Export purchase order</h2><p className="mt-1 text-xs text-slate-400">{order.poNumber} · Configure once, then save or print as PDF</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></div><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">{error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}<div className="grid gap-6 lg:grid-cols-[12rem_1fr]"><aside className="self-start rounded-2xl border border-brand-blue/10 bg-[linear-gradient(145deg,#f8faff,#f1f5fb)] p-4 text-center"><span className="mx-auto grid size-24 place-items-center overflow-hidden rounded-2xl border border-white bg-white p-2 shadow-sm"><img className="size-full object-contain" src="/images/adiel-logo-flat.png" alt="ADIEL logo" /></span><p className="mt-3 text-[10px] font-extrabold text-brand-blue">Official document header</p><p className="mt-1 text-[9px] leading-4 text-slate-400">These company details are saved and reused for future purchase orders.</p></aside><div className="space-y-5"><section><div><h3 className="text-xs font-extrabold text-brand-blue">Company header information</h3><p className="mt-1 text-[10px] text-slate-400">Displayed beside the ADIEL logo at the top of the document.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClassName} htmlFor="po-company-name">Company name</label><input className={fieldClassName} id="po-company-name" value={profile.companyName} onChange={(event) => updateProfile('companyName', event.target.value)} required /></div><div className="sm:col-span-2"><label className={labelClassName} htmlFor="po-company-address">Address</label><textarea className="min-h-20 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold leading-5 text-brand-blue outline-none focus:border-brand-blue/40" id="po-company-address" value={profile.address} onChange={(event) => updateProfile('address', event.target.value)} placeholder="Complete business address" required /></div><div><label className={labelClassName} htmlFor="po-main-office">Main office number</label><input className={fieldClassName} id="po-main-office" value={profile.mainOfficeNumber} onChange={(event) => updateProfile('mainOfficeNumber', event.target.value)} placeholder="Main office" required /></div><div><label className={labelClassName} htmlFor="po-client-relations">Client relations number</label><input className={fieldClassName} id="po-client-relations" value={profile.clientRelationsNumber} onChange={(event) => updateProfile('clientRelationsNumber', event.target.value)} placeholder="Optional" /></div><div><label className={labelClassName} htmlFor="po-accounts">Accounts number</label><input className={fieldClassName} id="po-accounts" value={profile.accountsNumber} onChange={(event) => updateProfile('accountsNumber', event.target.value)} placeholder="Optional" /></div><div><label className={labelClassName} htmlFor="po-new-accounts">New accounts number</label><input className={fieldClassName} id="po-new-accounts" value={profile.newAccountsNumber} onChange={(event) => updateProfile('newAccountsNumber', event.target.value)} placeholder="Optional" /></div><div><label className={labelClassName} htmlFor="po-company-email">Email</label><input className={fieldClassName} id="po-company-email" type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} placeholder="company@email.com" required /></div><div><label className={labelClassName} htmlFor="po-company-tin">TIN</label><input className={fieldClassName} id="po-company-tin" value={profile.tin} onChange={(event) => updateProfile('tin', event.target.value)} placeholder="Tax identification number" required /></div></div></section><section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-extrabold text-brand-blue">Document notes and terms</h3><p className="mt-1 text-[10px] text-slate-400">Saved with this purchase order and included in the PDF.</p><div className="mt-4 grid gap-3"><div><label className={labelClassName} htmlFor="po-document-notes">Notes / remarks</label><textarea className="min-h-20 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium leading-5 text-brand-blue outline-none focus:border-brand-blue/40" id="po-document-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery instructions or remarks..." /></div><div><label className={labelClassName} htmlFor="po-document-terms">Standard terms & conditions <span className="normal-case tracking-normal text-slate-300">(one per line)</span></label><textarea className="min-h-32 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium leading-5 text-brand-blue outline-none focus:border-brand-blue/40" id="po-document-terms" value={terms} onChange={(event) => setTerms(event.target.value)} /></div></div></section></div></div><div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3.5 py-3"><Icon className="mt-0.5 size-3.5 shrink-0 text-brand-blue" path="M12 8h.01M11 12h1v4h1M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /><p className="text-[10px] leading-4 text-slate-500">Your browser print dialog will open. Select <strong>Save as PDF</strong> for a digital copy or choose a printer for a physical copy.</p></div></div><div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onClose}>Cancel</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit"><Icon className="size-3.5" path="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8Z" />Print / Save PDF</button></div></form></div>
}
