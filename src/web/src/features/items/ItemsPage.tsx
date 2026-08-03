import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { appendSystemLog } from '../../services/activityLog'

type ItemStatus = 'Active' | 'Inactive' | 'Discontinued'
type ItemStatusFilter = 'All statuses' | ItemStatus

type ItemVariant = {
  id: string
  name: string
  value: string
  photo: string
  rawCost: number
  sellingPrice: number
  priceHistory: VariantPriceRecord[]
}

type VariantPriceRecord = {
  id: string
  date: string
  rawCost: number
  sellingPrice: number
}

type DirectorySupplier = {
  id: string
  name: string
  address: string
  status: string
}

type Item = {
  id: string
  photo: string
  name: string
  category: string
  subcategory: string
  brand: string
  unitOfMeasure: string
  unitWeight: number
  productCode: string
  barcode: string
  variants: ItemVariant[]
  description: string
  status: ItemStatus
  lastPriceUpdate: string
  rawCost: number
  sellingPrice: number
  supplierId: string
  createdAt: string
  updatedAt: string
}

type ItemDraft = Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'unitWeight' | 'rawCost' | 'sellingPrice'> & {
  unitWeight: string
  rawCost: string
  sellingPrice: string
}

type ItemsPageProps = {
  currentUsername: string
}

const storageKey = 'adiel.items'
const categoryStorageKey = 'adiel.item-categories'
const supplierStorageKey = 'adiel.suppliers'
const defaultCategories = ['Electrical', 'Hardware', 'Construction materials', 'Safety equipment', 'Plumbing', 'Tools', 'Office supplies', 'Other']
const itemStatuses: ItemStatus[] = ['Active', 'Inactive', 'Discontinued']
const statusOptions = [
  { value: 'Active' as const, dotClassName: 'bg-emerald-500', toneClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  { value: 'Inactive' as const, dotClassName: 'bg-slate-400', toneClassName: 'border-slate-200 bg-slate-100 text-slate-600' },
  { value: 'Discontinued' as const, dotClassName: 'bg-red-400', toneClassName: 'border-red-100 bg-red-50 text-red-600' },
]
const statusFilterOptions: { value: ItemStatusFilter }[] = [{ value: 'All statuses' }, ...itemStatuses.map((value) => ({ value }))]
const unitOptions = ['Piece', 'Box', 'Pack', 'Set', 'Kilogram', 'Gram', 'Liter', 'Meter', 'Roll', 'Pair'].map((value) => ({ value }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500'

function createEmptyDraft(supplierId = '', category = ''): ItemDraft {
  return {
    photo: '',
    name: '',
    category,
    subcategory: '',
    brand: '',
    unitOfMeasure: 'Piece',
    unitWeight: '',
    productCode: '',
    barcode: '',
    variants: [],
    description: '',
    status: 'Active',
    lastPriceUpdate: new Date().toISOString().slice(0, 10),
    rawCost: '',
    sellingPrice: '',
    supplierId,
  }
}

function createEmptyVariant(rawCost = 0, sellingPrice = 0): ItemVariant {
  return { id: crypto.randomUUID(), name: '', value: '', photo: '', rawCost, sellingPrice, priceHistory: [] }
}

function loadItems(): Item[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const item = value as Partial<Item>
      if (typeof item.id !== 'string' || typeof item.name !== 'string') return []
      const itemRawCost = typeof item.rawCost === 'number' ? item.rawCost : 0
      const itemSellingPrice = typeof item.sellingPrice === 'number' ? item.sellingPrice : 0
      const itemPriceDate = typeof item.lastPriceUpdate === 'string' ? item.lastPriceUpdate : ''
      return [{
        id: item.id,
        photo: typeof item.photo === 'string' ? item.photo : '',
        name: item.name,
        category: typeof item.category === 'string' ? item.category : '',
        subcategory: typeof item.subcategory === 'string' ? item.subcategory : '',
        brand: typeof item.brand === 'string' ? item.brand : '',
        unitOfMeasure: typeof item.unitOfMeasure === 'string' ? item.unitOfMeasure : 'Piece',
        unitWeight: typeof item.unitWeight === 'number' ? item.unitWeight : 0,
        productCode: typeof item.productCode === 'string' ? item.productCode : '',
        barcode: typeof item.barcode === 'string' ? item.barcode : '',
        variants: Array.isArray(item.variants) ? item.variants.flatMap((variant) => {
          if (typeof variant === 'string') return [{ id: crypto.randomUUID(), name: 'Variant', value: variant, photo: '', rawCost: itemRawCost, sellingPrice: itemSellingPrice, priceHistory: [] }]
          if (typeof variant !== 'object' || variant === null) return []
          const savedVariant = variant as Partial<ItemVariant>
          if (typeof savedVariant.name !== 'string' || typeof savedVariant.value !== 'string') return []
          const rawCost = typeof savedVariant.rawCost === 'number' ? savedVariant.rawCost : itemRawCost
          const sellingPrice = typeof savedVariant.sellingPrice === 'number' ? savedVariant.sellingPrice : itemSellingPrice
          const priceHistory = Array.isArray(savedVariant.priceHistory) ? savedVariant.priceHistory.flatMap((record) => {
            if (typeof record !== 'object' || record === null) return []
            const savedRecord = record as Partial<VariantPriceRecord>
            if (typeof savedRecord.date !== 'string' || typeof savedRecord.rawCost !== 'number' || typeof savedRecord.sellingPrice !== 'number') return []
            return [{ id: typeof savedRecord.id === 'string' ? savedRecord.id : crypto.randomUUID(), date: savedRecord.date, rawCost: savedRecord.rawCost, sellingPrice: savedRecord.sellingPrice }]
          }) : []
          return [{ id: typeof savedVariant.id === 'string' ? savedVariant.id : crypto.randomUUID(), name: savedVariant.name, value: savedVariant.value, photo: typeof savedVariant.photo === 'string' ? savedVariant.photo : '', rawCost, sellingPrice, priceHistory: priceHistory.length ? priceHistory : [{ id: crypto.randomUUID(), date: itemPriceDate || new Date().toISOString().slice(0, 10), rawCost, sellingPrice }] }]
        }) : [],
        description: typeof item.description === 'string' ? item.description : '',
        status: itemStatuses.includes(item.status as ItemStatus) ? item.status as ItemStatus : 'Active',
        lastPriceUpdate: itemPriceDate,
        rawCost: itemRawCost,
        sellingPrice: itemSellingPrice,
        supplierId: typeof item.supplierId === 'string' ? item.supplierId : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
      }]
    })
  } catch {
    return []
  }
}

function loadItemCategories(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(categoryStorageKey) ?? '[]')
    const saved = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : []
    const used = loadItems().map((item) => item.category).filter(Boolean)
    return Array.from(new Set([...defaultCategories, ...saved, ...used])).sort((left, right) => left.localeCompare(right))
  } catch {
    return defaultCategories
  }
}

function loadDirectorySuppliers(): DirectorySupplier[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(supplierStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const supplier = value as Partial<DirectorySupplier>
      if (typeof supplier.id !== 'string' || typeof supplier.name !== 'string') return []
      return [{ id: supplier.id, name: supplier.name, address: typeof supplier.address === 'string' ? supplier.address : '', status: typeof supplier.status === 'string' ? supplier.status : 'Active' }]
    }).sort((left, right) => left.name.localeCompare(right.name))
  } catch {
    return []
  }
}

function resizeItemPhoto(file: File, maxSize = 800, quality = 0.84) {
  return new Promise<string>((resolve, reject) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      reject(new Error('Upload a PNG, JPG, or WebP image.'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('The photo must be smaller than 5 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The photo could not be read.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error('The photo could not be read.'))
      const image = new Image()
      image.onerror = () => reject(new Error('The image appears to be invalid.'))
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) return reject(new Error('The photo could not be processed.'))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', quality))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function getItemIdFromPath() {
  const match = window.location.pathname.match(/^\/items\/([^/]+)$/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function ProductPhoto({ item, size = 'large' }: { item: Pick<Item, 'photo' | 'name'>; size?: 'hero' | 'large' | 'small' }) {
  const sizeClass = size === 'hero' ? 'size-28 rounded-[1.75rem] sm:size-36' : size === 'large' ? 'size-16 rounded-2xl' : 'size-11 rounded-xl'
  const iconClass = size === 'hero' ? 'size-10' : size === 'large' ? 'size-6' : 'size-4'
  return item.photo ? <span className={`${sizeClass} grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-white shadow-sm`}><img className={`size-full ${size === 'hero' ? 'object-contain p-2' : 'object-cover'}`} src={item.photo} alt={item.name} /></span> : <span className={`${sizeClass} grid shrink-0 place-items-center bg-[linear-gradient(145deg,#eef3fb,#e2e9f5)] text-brand-blue`}><Icon className={iconClass} path="M4 5h16v14H4V5Zm0 10 4-4 4 4 2-2 6 6M16 9h.01" /></span>
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt><dd className={`mt-1.5 break-words text-sm font-bold text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</dd></div>
}

function VariantEditor({ variant, index, isProcessingPhoto, onUpdate, onPhotoChange, onRemove, showRemove = true }: { variant: ItemVariant; index: number; isProcessingPhoto: boolean; onUpdate: (id: string, field: 'name' | 'value' | 'rawCost' | 'sellingPrice', value: string) => void; onPhotoChange: (id: string, event: ChangeEvent<HTMLInputElement>) => void; onRemove: (id: string) => void; showRemove?: boolean }) {
  const variantProfit = variant.sellingPrice - variant.rawCost
  return <div className="rounded-2xl border border-slate-200/80 bg-slate-50/55 p-4 shadow-[0_10px_24px_-22px_rgba(0,20,76,0.38)] animate-[content-enter_160ms_ease-out]">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-white text-[10px] font-extrabold text-violet-600 shadow-sm">{String(index + 1).padStart(2, '0')}</span><div><p className="text-xs font-extrabold text-brand-blue">Variant {index + 1}</p><p className="text-[9px] text-slate-400">Photo, option, and individual pricing</p></div></div>{showRemove ? <button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600" type="button" onClick={() => onRemove(variant.id)} aria-label={`Remove variant ${index + 1}`}><Icon className="size-3.5" path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></button> : null}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[5.5rem_1fr_1fr]">
      <div className="sm:row-span-2"><label className={`group grid h-full min-h-24 place-items-center rounded-xl border border-dashed bg-white p-2 text-center transition ${isProcessingPhoto ? 'cursor-wait border-brand-blue/20' : 'cursor-pointer border-slate-200 hover:border-brand-blue/30 hover:bg-blue-50/30'}`}><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onPhotoChange(variant.id, event)} disabled={isProcessingPhoto} />{isProcessingPhoto ? <span><span className="mx-auto block size-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-blue" /><span className="mt-2 block text-[9px] font-bold text-brand-blue">Optimizing...</span></span> : variant.photo ? <span><span className="mx-auto block size-14 overflow-hidden rounded-lg"><img className="size-full object-cover" src={variant.photo} alt="" /></span><span className="mt-1.5 block text-[9px] font-bold text-brand-blue">Replace</span></span> : <span><span className="mx-auto grid size-9 place-items-center rounded-lg bg-blue-50 text-brand-blue"><Icon path="M4 5h16v14H4V5Zm0 10 4-4 4 4 2-2 6 6M16 9h.01" /></span><span className="mt-1.5 block text-[9px] font-bold text-slate-500">Add photo</span></span>}</label></div>
      <div><label className={labelClassName} htmlFor={`variant-name-${variant.id}`}>Variant name</label><input className={`${fieldClassName} h-10 text-xs`} id={`variant-name-${variant.id}`} value={variant.name} onChange={(event) => onUpdate(variant.id, 'name', event.target.value)} placeholder="e.g. Color" /></div>
      <div><label className={labelClassName} htmlFor={`variant-value-${variant.id}`}>Variant value</label><input className={`${fieldClassName} h-10 text-xs`} id={`variant-value-${variant.id}`} value={variant.value} onChange={(event) => onUpdate(variant.id, 'value', event.target.value)} placeholder="e.g. Red" /></div>
      <div><label className={labelClassName} htmlFor={`variant-raw-${variant.id}`}>Raw cost</label><input className={`${fieldClassName} h-10 text-xs`} id={`variant-raw-${variant.id}`} type="number" min="0" step="0.01" value={variant.rawCost} onChange={(event) => onUpdate(variant.id, 'rawCost', event.target.value)} /></div>
      <div><label className={labelClassName} htmlFor={`variant-selling-${variant.id}`}>Selling price</label><input className={`${fieldClassName} h-10 text-xs`} id={`variant-selling-${variant.id}`} type="number" min="0" step="0.01" value={variant.sellingPrice} onChange={(event) => onUpdate(variant.id, 'sellingPrice', event.target.value)} /></div>
    </div>
    <div className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2 ${variantProfit >= 0 ? 'border-emerald-100 bg-emerald-50/65' : 'border-red-100 bg-red-50/65'}`}><span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Variant profit</span><span className={`text-xs font-extrabold ${variantProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPeso(variantProfit)}</span></div>
  </div>
}

function VariantCatalog({ item, supplier, onSelect, onAdd, onEdit }: { item: Item; supplier?: DirectorySupplier; onSelect: (id: string) => void; onAdd: () => void; onEdit: (variant: ItemVariant) => void }) {
  return <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-32px_rgba(0,20,76,0.34)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Product variants</h3><p className="mt-0.5 text-[11px] text-slate-400">Individual photos, pricing, and profitability for each option</p></div><div className="flex items-center gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{item.variants.length} {item.variants.length === 1 ? 'variant' : 'variants'}</span><button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 text-[10px] font-bold text-white shadow-sm transition hover:-translate-y-0.5" type="button" onClick={onAdd}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add variant</button></div></div>
    {item.variants.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1080px] table-fixed text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="w-[6%] px-4 py-3.5 text-center">#</th><th className="w-[23%] px-4 py-3.5">Variant photo & details</th><th className="w-[20%] px-4 py-3.5">Supplier & location</th><th className="w-[9%] px-4 py-3.5">Unit</th><th className="w-[11%] px-4 py-3.5">Updated</th><th className="w-[11%] px-4 py-3.5 text-right">Raw cost</th><th className="w-[11%] px-4 py-3.5 text-right">Selling price</th><th className="w-[8%] px-4 py-3.5 text-right">Profit</th><th className="w-[7%] px-4 py-3.5 text-right">Action</th></tr></thead><tbody>{item.variants.map((variant, index) => { const variantProfit = variant.sellingPrice - variant.rawCost; const latestDate = variant.priceHistory.at(-1)?.date || item.lastPriceUpdate; return <tr className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/35" key={variant.id} onClick={() => onSelect(variant.id)}><td className="border-l-4 border-l-brand-orange px-4 py-4 text-center text-xs font-extrabold text-brand-blue">{index + 1}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><ProductPhoto item={{ photo: variant.photo || item.photo, name: variant.value }} size="small" /><div className="min-w-0"><p className="truncate text-xs font-extrabold text-brand-blue">{variant.value}</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-400">{variant.name} · {item.brand}</p></div></div></td><td className="px-4 py-4"><p className="truncate text-xs font-bold text-slate-600">{supplier?.name ?? 'Supplier unavailable'}</p><p className="mt-1 truncate text-[10px] text-slate-400">{supplier?.address || 'No location provided'}</p></td><td className="px-4 py-4 text-xs font-bold text-slate-600">{item.unitOfMeasure}</td><td className="px-4 py-4"><p className="text-xs font-bold text-slate-600">{formatDate(latestDate)}</p><p className="mt-1 text-[9px] text-slate-400">{variant.priceHistory.length} price {variant.priceHistory.length === 1 ? 'record' : 'records'}</p></td><td className="px-4 py-4 text-right text-xs font-bold tabular-nums text-slate-600">{formatPeso(variant.rawCost)}</td><td className="px-4 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(variant.sellingPrice)}</td><td className={`px-4 py-4 text-right text-xs font-extrabold tabular-nums ${variantProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPeso(variantProfit)}</td><td className="px-4 py-4 text-right"><button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] font-bold text-brand-blue transition hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={(event) => { event.stopPropagation(); onEdit(variant) }}><Icon className="size-3" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" />Edit</button></td></tr> })}</tbody></table></div> : <div className="grid min-h-52 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon path="m21 8-9-5-9 5 9 5 9-5" /></span><p className="mt-4 text-sm font-bold text-brand-blue">No variants added</p><p className="mt-1 text-xs text-slate-400">Edit this product to add its available options.</p></div></div>}
  </section>
}

function ProductSpecifications({ item }: { item: Item }) {
  const profit = item.sellingPrice - item.rawCost
  const margin = item.sellingPrice > 0 ? (profit / item.sellingPrice) * 100 : 0
  return <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_45px_-32px_rgba(0,20,76,0.34)] sm:p-6"><div className="grid gap-5 lg:grid-cols-2"><div><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Icon path="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" /></span><div><h3 className="text-sm font-extrabold text-brand-blue">Product specifications</h3><p className="mt-0.5 text-xs text-slate-400">Identification and measurement details</p></div></div><dl className="mt-5 grid gap-3 sm:grid-cols-2"><DetailField label="Product code" value={item.productCode} mono /><DetailField label="Barcode" value={item.barcode} mono /><DetailField label="Category" value={item.category} /><DetailField label="Subcategory" value={item.subcategory} /><DetailField label="Brand" value={item.brand} /><DetailField label="Unit of measure" value={item.unitOfMeasure} /><DetailField label="Unit weight" value={item.unitWeight ? `${item.unitWeight} kg` : 'No weight provided'} /><DetailField label="Status" value={item.status} /></dl></div><div><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon path="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></span><div><h3 className="text-sm font-extrabold text-brand-blue">Pricing & record details</h3><p className="mt-0.5 text-xs text-slate-400">Base pricing and product history</p></div></div><dl className="mt-5 grid gap-3 sm:grid-cols-2"><DetailField label="Raw cost" value={formatPeso(item.rawCost)} /><DetailField label="Selling price" value={formatPeso(item.sellingPrice)} /><DetailField label="Profit per unit" value={formatPeso(profit)} /><DetailField label="Margin" value={`${margin.toFixed(1)}%`} /><DetailField label="Created" value={formatTimestamp(item.createdAt)} /><DetailField label="Last updated" value={formatTimestamp(item.updatedAt)} /></dl><div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Description</p><p className="mt-2 text-sm leading-6 text-slate-600">{item.description || 'No product description has been added.'}</p></div></div></div></section>
}

function VariantPriceHistory({ item }: { item: Item }) {
  const records = item.variants.flatMap((variant) => variant.priceHistory.map((record, index) => ({ ...record, variant, previous: variant.priceHistory[index - 1] }))).sort((left, right) => right.date.localeCompare(left.date))
  return <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-32px_rgba(0,20,76,0.34)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-brand-blue">Variant price history</h3><p className="mt-0.5 text-[11px] text-slate-400">A timeline is saved automatically whenever variant pricing changes</p></div><span className="rounded-lg bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-brand-orange">{records.length} {records.length === 1 ? 'adjustment' : 'adjustments'}</span></div>{records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] table-fixed text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="w-[28%] px-5 py-3.5">Variant</th><th className="w-[18%] px-4 py-3.5">Effective date</th><th className="w-[18%] px-4 py-3.5 text-right">Raw cost</th><th className="w-[18%] px-4 py-3.5 text-right">Selling price</th><th className="w-[18%] px-5 py-3.5 text-right">Price change</th></tr></thead><tbody>{records.map((entry) => { const change = entry.previous ? entry.sellingPrice - entry.previous.sellingPrice : 0; return <tr className="border-b border-slate-100" key={entry.id}><td className="border-l-4 border-l-brand-orange px-5 py-4"><div className="flex items-center gap-3"><ProductPhoto item={{ photo: entry.variant.photo || item.photo, name: entry.variant.value }} size="small" /><div><p className="text-xs font-extrabold text-brand-blue">{entry.variant.value}</p><p className="mt-1 text-[10px] text-slate-400">{entry.variant.name}</p></div></div></td><td className="px-4 py-4 text-xs font-bold text-slate-600">{formatDate(entry.date)}</td><td className="px-4 py-4 text-right text-xs font-bold tabular-nums text-slate-600">{formatPeso(entry.rawCost)}</td><td className="px-4 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(entry.sellingPrice)}</td><td className={`px-5 py-4 text-right text-xs font-extrabold tabular-nums ${change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-slate-400'}`}>{entry.previous ? `${change > 0 ? '+' : ''}${formatPeso(change)}` : 'Initial price'}</td></tr> })}</tbody></table></div> : <div className="grid min-h-52 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-orange-50 text-brand-orange"><Icon path="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" /></span><p className="mt-4 text-sm font-bold text-brand-blue">No price history yet</p><p className="mt-1 text-xs text-slate-400">The first record will appear after a variant is saved.</p></div></div>}</section>
}

function ItemDetailsView({ item, supplier, onBack, onEdit, onAddVariant, onEditVariant }: { item: Item; supplier?: DirectorySupplier; onBack: () => void; onEdit: () => void; onAddVariant: () => void; onEditVariant: (variant: ItemVariant) => void }) {
  const statusClass = item.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : item.status === 'Inactive' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'
  const [activeDetailTab, setActiveDetailTab] = useState<'variants' | 'specifications' | 'history'>('variants')
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const selectedVariant = item.variants.find((variant) => variant.id === selectedVariantId)
  const displayedPhoto = selectedVariant?.photo || item.photo
  const displayedRawCost = selectedVariant?.rawCost ?? item.rawCost
  const displayedSellingPrice = selectedVariant?.sellingPrice ?? item.sellingPrice
  const displayedProfit = displayedSellingPrice - displayedRawCost
  const displayedMargin = displayedSellingPrice > 0 ? (displayedProfit / displayedSellingPrice) * 100 : 0

  return <div className="item-detail-page space-y-4 animate-[content-enter_300ms_cubic-bezier(0.22,1,0.36,1)]">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Product catalog</p></div><h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Product specification & variant detail</h2></div>
      <div className="flex flex-wrap gap-2"><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/20 hover:text-brand-blue" type="button" onClick={onBack}><Icon path="m15 18-6-6 6-6" />Back to items</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition hover:-translate-y-0.5" type="button" onClick={onEdit}><Icon path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" />Edit product</button></div>
    </div>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_55px_-35px_rgba(0,20,76,0.38)]" aria-label={`${item.name} summary`}>
      <div className="grid xl:grid-cols-[15rem_minmax(24rem,1fr)_21rem]">
        <div className="grid place-items-center border-b border-slate-100 bg-[radial-gradient(circle_at_50%_42%,rgba(219,234,254,0.55),transparent_65%)] p-6 xl:border-b-0 xl:border-r">
          <div className="flex w-full flex-col items-center justify-center text-center"><ProductPhoto item={{ photo: displayedPhoto, name: selectedVariant ? `${item.name} ${selectedVariant.value}` : item.name }} size="hero" /><p className="mt-2 max-w-full truncate text-xs font-extrabold text-brand-blue">{selectedVariant?.value ?? item.name}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{selectedVariant ? selectedVariant.name : 'Main product'}</p>{selectedVariant ? <button className="mt-2 text-[9px] font-bold text-slate-400 transition hover:text-brand-orange" type="button" onClick={() => setSelectedVariantId(null)}>View main product</button> : null}</div>
        </div>
        <div className="min-w-0 border-b border-slate-100 p-6 xl:border-b-0 xl:border-r xl:p-7">
          <div className="flex flex-wrap items-center gap-2"><h3 className="mr-1 text-2xl font-bold tracking-[-0.035em] text-brand-blue">{item.name}</h3><span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>{item.status}</span></div>
          <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2"><dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs"><dt className="font-semibold text-slate-400">Category</dt><dd className="truncate font-bold text-slate-700">{item.category}</dd><dt className="font-semibold text-slate-400">Subcategory</dt><dd className="truncate font-bold text-slate-700">{item.subcategory}</dd><dt className="font-semibold text-slate-400">Brand</dt><dd className="truncate font-bold text-slate-700">{item.brand}</dd><dt className="font-semibold text-slate-400">Status</dt><dd className={`font-bold ${item.status === 'Active' ? 'text-emerald-600' : 'text-slate-600'}`}>{item.status}</dd></dl><dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs"><dt className="font-semibold text-slate-400">Unit of measure</dt><dd className="font-bold text-slate-700">{item.unitOfMeasure}</dd><dt className="font-semibold text-slate-400">Unit weight</dt><dd className="font-bold text-slate-700">{item.unitWeight ? `${item.unitWeight} kg` : 'Not provided'}</dd><dt className="font-semibold text-slate-400">Product code</dt><dd className="truncate font-mono font-bold text-brand-blue">{item.productCode}</dd><dt className="font-semibold text-slate-400">Barcode</dt><dd className="truncate font-mono font-bold text-slate-700">{item.barcode}</dd></dl></div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/65 px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Description</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.description || 'No description provided.'}</p></div>
          {item.variants.length ? <div className="mt-3 border-t border-slate-100 pt-3"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Available variants</p><span className="text-[9px] font-bold text-violet-600">{item.variants.length} options</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{item.variants.map((variant) => <button className={`flex min-w-0 items-center gap-2 rounded-xl border p-1.5 pr-2.5 text-left transition ${selectedVariantId === variant.id ? 'border-brand-orange bg-orange-50 text-brand-orange shadow-sm ring-2 ring-brand-orange/[0.08]' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-blue/20 hover:bg-blue-50/35 hover:text-brand-blue'}`} type="button" onClick={() => setSelectedVariantId(variant.id)} key={variant.id}><ProductPhoto item={{ photo: variant.photo || item.photo, name: variant.value }} size="small" /><span className="min-w-0"><span className="block truncate text-[10px] font-extrabold">{variant.value}</span><span className="mt-0.5 block truncate text-[9px] font-semibold opacity-65">{variant.name}</span></span></button>)}</div></div> : null}
        </div>
        <div className="p-6 xl:p-7">
          <p className="text-3xl font-extrabold tracking-[-0.04em] text-brand-blue">{formatPeso(displayedSellingPrice)} <span className="text-xs font-bold tracking-normal text-slate-400">/ {item.unitOfMeasure.toLowerCase()}</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{selectedVariant ? `${selectedVariant.value} selling price` : 'Current selling price'}</p>
          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200"><div className="border-r border-slate-200 p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Raw cost</p><p className="mt-2 text-xs font-extrabold text-slate-700">{formatPeso(displayedRawCost)}</p><p className="mt-1 text-[9px] text-slate-400">Per {item.unitOfMeasure.toLowerCase()}</p></div><div className="p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Profit / margin</p><p className={`mt-2 text-xs font-extrabold ${displayedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPeso(displayedProfit)}</p><p className="mt-1 text-[9px] text-slate-400">{displayedMargin.toFixed(1)}% margin</p></div></div>
          <div className="mt-4 rounded-xl border border-brand-blue/10 bg-[linear-gradient(145deg,#f8faff,#f2f6fc)] p-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Current supplier</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{supplier?.name ?? 'Supplier unavailable'}</p><div className="mt-3 border-t border-slate-200/80 pt-3"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Supplier location</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{supplier?.address || 'No location provided'}</p></div></div>
        </div>
      </div>
    </section>

    <div className="border-b border-slate-200"><div className="flex gap-3 overflow-x-auto px-1 sm:gap-7" role="tablist" aria-label="Product detail sections"><button className={`relative whitespace-nowrap px-3 py-3 text-xs font-bold transition ${activeDetailTab === 'variants' ? 'text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} type="button" role="tab" aria-selected={activeDetailTab === 'variants'} onClick={() => setActiveDetailTab('variants')}>Variants <span className="ml-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] text-violet-700">{item.variants.length}</span>{activeDetailTab === 'variants' ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-orange" /> : null}</button><button className={`relative whitespace-nowrap px-3 py-3 text-xs font-bold transition ${activeDetailTab === 'specifications' ? 'text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} type="button" role="tab" aria-selected={activeDetailTab === 'specifications'} onClick={() => setActiveDetailTab('specifications')}>Specifications{activeDetailTab === 'specifications' ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-orange" /> : null}</button><button className={`relative whitespace-nowrap px-3 py-3 text-xs font-bold transition ${activeDetailTab === 'history' ? 'text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} type="button" role="tab" aria-selected={activeDetailTab === 'history'} onClick={() => setActiveDetailTab('history')}>Price history <span className="ml-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] text-brand-orange">{item.variants.reduce((total, variant) => total + variant.priceHistory.length, 0)}</span>{activeDetailTab === 'history' ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-orange" /> : null}</button></div></div>

    {activeDetailTab === 'variants' ? <VariantCatalog item={item} supplier={supplier} onSelect={(id) => { setSelectedVariantId(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} onAdd={onAddVariant} onEdit={onEditVariant} /> : activeDetailTab === 'specifications' ? <ProductSpecifications item={item} /> : <VariantPriceHistory item={item} />}
  </div>
}

export function ItemsPage({ currentUsername }: ItemsPageProps) {
  const [items, setItems] = useState<Item[]>(loadItems)
  const [detailItemId, setDetailItemId] = useState<string | null>(getItemIdFromPath)
  const [suppliers, setSuppliers] = useState<DirectorySupplier[]>(loadDirectorySuppliers)
  const [categories, setCategories] = useState<string[]>(loadItemCategories)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [statusFilter, setStatusFilter] = useState<ItemStatusFilter>('All statuses')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft>(() => createEmptyDraft())
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
  const [variantParentItemId, setVariantParentItemId] = useState<string | null>(null)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [variantDraft, setVariantDraft] = useState<ItemVariant>(() => createEmptyVariant())
  const [variantFormError, setVariantFormError] = useState('')
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [categoryManagerError, setCategoryManagerError] = useState('')
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<string | null>(null)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [formError, setFormError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [processingVariantPhotoId, setProcessingVariantPhotoId] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [toast, setToast] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items))
      setStorageError('')
    } catch {
      setStorageError('Items could not be saved. Try using a smaller product photo.')
    }
  }, [items])

  useEffect(() => {
    window.localStorage.setItem(categoryStorageKey, JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    const refreshSuppliers = (event: StorageEvent) => {
      if (event.key === supplierStorageKey) setSuppliers(loadDirectorySuppliers())
    }
    window.addEventListener('storage', refreshSuppliers)
    return () => window.removeEventListener('storage', refreshSuppliers)
  }, [])

  useEffect(() => {
    const syncItemRoute = () => setDetailItemId(getItemIdFromPath())
    window.addEventListener('popstate', syncItemRoute)
    return () => window.removeEventListener('popstate', syncItemRoute)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!isDialogOpen && !isCategoryManagerOpen && !isVariantDialogOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = originalOverflow }
  }, [isCategoryManagerOpen, isDialogOpen, isVariantDialogOpen])

  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers])
  const detailItem = detailItemId ? items.find((item) => item.id === detailItemId) : undefined
  const detailSupplier = detailItem ? supplierMap.get(detailItem.supplierId) : undefined
  const variantParentItem = variantParentItemId ? items.find((item) => item.id === variantParentItemId) : undefined
  const variantDialogIndex = editingVariantId ? Math.max(0, variantParentItem?.variants.findIndex((variant) => variant.id === editingVariantId) ?? 0) : variantParentItem?.variants.length ?? 0
  const selectedSupplier = supplierMap.get(draft.supplierId)
  const supplierOptions = useMemo(() => {
    const options = suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.name}${supplier.status === 'Inactive' ? ' (Inactive)' : ''}` }))
    if (draft.supplierId && !options.some((option) => option.value === draft.supplierId)) options.unshift({ value: draft.supplierId, label: 'Supplier unavailable' })
    return options.length ? options : [{ value: '', label: 'No suppliers available' }]
  }, [draft.supplierId, suppliers])
  const categoryOptions = [{ value: 'All categories' }, ...categories.map((value) => ({ value }))]
  const categorySelectOptions = useMemo(() => {
    const options = categories.map((value) => ({ value }))
    if (draft.category && !options.some((option) => option.value === draft.category)) options.unshift({ value: draft.category })
    return options
  }, [categories, draft.category])
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      const supplier = supplierMap.get(item.supplierId)
      const matchesSearch = !query || [item.name, item.category, item.subcategory, item.brand, item.productCode, item.barcode, item.description, ...item.variants.flatMap((variant) => [variant.name, variant.value]), supplier?.name ?? '', supplier?.address ?? ''].some((value) => value.toLowerCase().includes(query))
      const matchesCategory = categoryFilter === 'All categories' || item.category === categoryFilter
      const matchesStatus = statusFilter === 'All statuses' || item.status === statusFilter
      return matchesSearch && matchesCategory && matchesStatus
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }, [categoryFilter, items, search, statusFilter, supplierMap])

  const averageMargin = items.length ? items.reduce((sum, item) => sum + (item.sellingPrice > 0 ? ((item.sellingPrice - item.rawCost) / item.sellingPrice) * 100 : 0), 0) / items.length : 0
  const summaryCards = [
    { label: 'Total items', value: items.length, dot: 'bg-brand-blue', valueColor: 'text-brand-blue' },
    { label: 'Active', value: items.filter((item) => item.status === 'Active').length, dot: 'bg-emerald-500', valueColor: 'text-emerald-600' },
    { label: 'Categories', value: categories.length, dot: 'bg-violet-500', valueColor: 'text-violet-600' },
    { label: 'Avg. margin', value: `${averageMargin.toFixed(1)}%`, dot: 'bg-brand-orange', valueColor: 'text-brand-orange' },
  ]
  const draftRawCost = Number(draft.rawCost) || 0
  const draftSellingPrice = Number(draft.sellingPrice) || 0
  const draftProfit = draftSellingPrice - draftRawCost
  const draftMargin = draftSellingPrice > 0 ? (draftProfit / draftSellingPrice) * 100 : 0

  function openAddDialog() {
    setDraft(createEmptyDraft(suppliers.find((supplier) => supplier.status === 'Active')?.id ?? suppliers[0]?.id ?? '', categories[0] ?? ''))
    setEditingId(null)
    setPhotoError('')
    setFormError('')
    setIsConfirmingDelete(false)
    setIsDialogOpen(true)
  }

  function openEditDialog(item: Item) {
    setDraft({ ...item, unitWeight: item.unitWeight ? String(item.unitWeight) : '', rawCost: String(item.rawCost), sellingPrice: String(item.sellingPrice) })
    setEditingId(item.id)
    setPhotoError('')
    setFormError('')
    setIsConfirmingDelete(false)
    setIsDialogOpen(true)
  }

  function openItemDetails(item: Item) {
    window.history.pushState(null, '', `/items/${encodeURIComponent(item.id)}`)
    setDetailItemId(item.id)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function returnToItems() {
    window.history.pushState(null, '', '/items')
    setDetailItemId(null)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setIsVariantDialogOpen(false)
    setIsConfirmingDelete(false)
    setFormError('')
    setPhotoError('')
  }

  function addVariant(item: Item) {
    setVariantParentItemId(item.id)
    setEditingVariantId(null)
    setVariantDraft(createEmptyVariant(item.rawCost, item.sellingPrice))
    setVariantFormError('')
    setPhotoError('')
    setIsVariantDialogOpen(true)
  }

  function updateVariant(id: string, field: 'name' | 'value' | 'rawCost' | 'sellingPrice', value: string) {
    setVariantDraft((current) => current.id === id ? { ...current, [field]: field === 'rawCost' || field === 'sellingPrice' ? Number(value) : value } : current)
  }

  function editVariant(item: Item, variant: ItemVariant) {
    setVariantParentItemId(item.id)
    setEditingVariantId(variant.id)
    setVariantDraft({ ...variant, priceHistory: [...variant.priceHistory] })
    setVariantFormError('')
    setPhotoError('')
    setIsVariantDialogOpen(true)
  }

  function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!variantDraft.name.trim() || !variantDraft.value.trim() || !Number.isFinite(variantDraft.rawCost) || variantDraft.rawCost < 0 || !Number.isFinite(variantDraft.sellingPrice) || variantDraft.sellingPrice < 0) {
      setVariantFormError('Complete the variant name, value, raw cost, and selling price.')
      return
    }
    if (!variantParentItemId) return
    const parentItem = items.find((item) => item.id === variantParentItemId)
    if (!parentItem) {
      setVariantFormError('The parent product could not be found.')
      return
    }
    const previous = parentItem.variants.find((variant) => variant.id === editingVariantId)
    const priceChanged = !previous || previous.rawCost !== variantDraft.rawCost || previous.sellingPrice !== variantDraft.sellingPrice
    const priceHistory = priceChanged ? [...variantDraft.priceHistory, { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), rawCost: variantDraft.rawCost, sellingPrice: variantDraft.sellingPrice }] : variantDraft.priceHistory
    const values = { ...variantDraft, name: variantDraft.name.trim(), value: variantDraft.value.trim(), priceHistory }
    const now = new Date().toISOString()
    setItems((current) => current.map((item) => item.id === variantParentItemId ? { ...item, variants: editingVariantId ? item.variants.map((variant) => variant.id === editingVariantId ? values : variant) : [...item.variants, values], updatedAt: now } : item))
    appendSystemLog({ recordId: values.id, module: 'Items', action: editingVariantId ? 'Updated' : 'Created', entity: `${parentItem.name} - ${values.value}`, description: editingVariantId ? 'Product variant details and pricing were updated.' : 'A new product variant was added.', actor: currentUsername, tone: 'success', amount: values.sellingPrice, status: parentItem.status })
    setIsVariantDialogOpen(false)
    setVariantParentItemId(null)
    setVariantFormError('')
    setToast(editingVariantId ? 'Variant updated successfully' : 'Variant added successfully')
  }

  function deleteVariant() {
    if (!variantParentItemId || !editingVariantId) return
    const parentItem = items.find((item) => item.id === variantParentItemId)
    const variant = parentItem?.variants.find((entry) => entry.id === editingVariantId)
    if (!parentItem || !variant) return
    setItems((current) => current.map((item) => item.id === variantParentItemId ? { ...item, variants: item.variants.filter((entry) => entry.id !== editingVariantId), updatedAt: new Date().toISOString() } : item))
    appendSystemLog({ recordId: variant.id, module: 'Items', action: 'Deleted', entity: `${parentItem.name} - ${variant.value}`, description: 'Product variant removed from the catalog.', actor: currentUsername, tone: 'danger', amount: variant.sellingPrice, status: parentItem.status })
    setIsVariantDialogOpen(false)
    setVariantParentItemId(null)
    setToast('Variant removed')
  }

  async function handleVariantPhotoChange(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoError('')
    setProcessingVariantPhotoId(id)
    try {
      const photo = await resizeItemPhoto(file, 520, 0.78)
      setVariantDraft((current) => current.id === id ? { ...current, photo } : current)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The variant photo could not be uploaded.')
    } finally {
      setProcessingVariantPhotoId(null)
    }
  }

  function openCategoryManager() {
    setEditingCategory(null)
    setCategoryDraft('')
    setCategoryManagerError('')
    setCategoryPendingDelete(null)
    setIsCategoryManagerOpen(true)
  }

  function addCategory() {
    const category = newCategoryName.trim()
    if (!category) {
      setCategoryError('Enter a category name.')
      return
    }
    const existing = categories.find((value) => value.toLowerCase() === category.toLowerCase())
    const selectedCategory = existing ?? category
    if (!existing) {
      setCategories((current) => [...current, category].sort((left, right) => left.localeCompare(right)))
      appendSystemLog({ recordId: `category-${category}`, module: 'Items', action: 'Created', entity: category, description: 'Item category added to the catalog.', actor: currentUsername, tone: 'success' })
    }
    setDraft((current) => ({ ...current, category: selectedCategory }))
    setNewCategoryName('')
    setCategoryError('')
    setIsAddingCategory(false)
    setToast(existing ? 'Existing category selected' : 'Category added')
  }

  function handleCategoryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addCategory()
  }

  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const category = categoryDraft.trim()
    if (!category) {
      setCategoryManagerError('Enter a category name.')
      return
    }
    const duplicate = categories.find((value) => value.toLowerCase() === category.toLowerCase() && value !== editingCategory)
    if (duplicate) {
      setCategoryManagerError('That category already exists.')
      return
    }
    if (editingCategory) {
      setCategories((current) => current.map((value) => value === editingCategory ? category : value).sort((left, right) => left.localeCompare(right)))
      setItems((current) => current.map((item) => item.category === editingCategory ? { ...item, category, updatedAt: new Date().toISOString() } : item))
      setDraft((current) => current.category === editingCategory ? { ...current, category } : current)
      appendSystemLog({ recordId: `category-${editingCategory}`, module: 'Items', action: 'Updated', entity: category, description: `Item category renamed from ${editingCategory} to ${category}.`, actor: currentUsername, tone: 'info' })
      setToast('Category updated')
    } else {
      setCategories((current) => [...current, category].sort((left, right) => left.localeCompare(right)))
      setDraft((current) => ({ ...current, category }))
      appendSystemLog({ recordId: `category-${category}`, module: 'Items', action: 'Created', entity: category, description: 'Item category added to the catalog.', actor: currentUsername, tone: 'success' })
      setToast('Category added')
    }
    setEditingCategory(null)
    setCategoryDraft('')
    setCategoryManagerError('')
  }

  function beginEditingCategory(category: string) {
    setEditingCategory(category)
    setCategoryDraft(category)
    setCategoryManagerError('')
    setCategoryPendingDelete(null)
  }

  function deleteCategory(category: string) {
    const usageCount = items.filter((item) => item.category === category).length
    if (usageCount) {
      setCategoryManagerError(`Move ${usageCount} ${usageCount === 1 ? 'item' : 'items'} to another category before deleting ${category}.`)
      setCategoryPendingDelete(null)
      return
    }
    if (categories.length === 1) {
      setCategoryManagerError('At least one category must remain available.')
      setCategoryPendingDelete(null)
      return
    }
    const remaining = categories.filter((value) => value !== category)
    setCategories(remaining)
    setDraft((current) => current.category === category ? { ...current, category: remaining[0] ?? '' } : current)
    appendSystemLog({ recordId: `category-${category}`, module: 'Items', action: 'Deleted', entity: category, description: 'Unused item category removed from the catalog.', actor: currentUsername, tone: 'danger' })
    setCategoryPendingDelete(null)
    setToast('Category removed')
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoError('')
    setIsProcessingPhoto(true)
    try {
      const photo = await resizeItemPhoto(file)
      setDraft((current) => ({ ...current, photo }))
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The photo could not be uploaded.')
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const unitWeight = Number(draft.unitWeight)
    const rawCost = Number(draft.rawCost)
    const sellingPrice = Number(draft.sellingPrice)
    const requiredText = [draft.name, draft.category, draft.subcategory, draft.brand, draft.productCode, draft.barcode]
    if (requiredText.some((value) => !value.trim()) || !draft.supplierId || !draft.lastPriceUpdate || !Number.isFinite(unitWeight) || unitWeight < 0 || !Number.isFinite(rawCost) || rawCost < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setFormError('Complete all required item, pricing, and supplier fields.')
      return
    }
    const duplicateCode = items.some((item) => item.id !== editingId && item.productCode.toLowerCase() === draft.productCode.trim().toLowerCase())
    const duplicateBarcode = items.some((item) => item.id !== editingId && item.barcode.toLowerCase() === draft.barcode.trim().toLowerCase())
    if (duplicateCode || duplicateBarcode) {
      setFormError(duplicateCode ? 'That product code is already in use.' : 'That barcode is already in use.')
      return
    }
    if (draft.variants.some((variant) => !variant.name.trim() || !variant.value.trim() || !Number.isFinite(variant.rawCost) || variant.rawCost < 0 || !Number.isFinite(variant.sellingPrice) || variant.sellingPrice < 0)) {
      setFormError('Complete the name, value, raw cost, and selling price for every variant, or remove the unfinished variant.')
      return
    }
    const now = new Date().toISOString()
    const itemId = editingId ?? crypto.randomUUID()
    const existingItem = editingId ? items.find((item) => item.id === editingId) : undefined
    const values: Item = {
      id: itemId,
      photo: draft.photo,
      name: draft.name.trim(),
      category: draft.category.trim(),
      subcategory: draft.subcategory.trim(),
      brand: draft.brand.trim(),
      unitOfMeasure: draft.unitOfMeasure,
      unitWeight,
      productCode: draft.productCode.trim(),
      barcode: draft.barcode.trim(),
      variants: draft.variants.map((variant) => {
        const previous = existingItem?.variants.find((entry) => entry.id === variant.id)
        const priceChanged = !previous || previous.rawCost !== variant.rawCost || previous.sellingPrice !== variant.sellingPrice
        const priceHistory = priceChanged ? [...variant.priceHistory, { id: crypto.randomUUID(), date: draft.lastPriceUpdate, rawCost: variant.rawCost, sellingPrice: variant.sellingPrice }] : variant.priceHistory
        return { ...variant, name: variant.name.trim(), value: variant.value.trim(), priceHistory }
      }),
      description: draft.description.trim(),
      status: draft.status,
      lastPriceUpdate: draft.lastPriceUpdate,
      rawCost,
      sellingPrice,
      supplierId: draft.supplierId,
      createdAt: existingItem?.createdAt ?? now,
      updatedAt: now,
    }
    setItems((current) => editingId ? current.map((item) => item.id === editingId ? values : item) : [values, ...current])
    appendSystemLog({ recordId: itemId, module: 'Items', action: editingId ? 'Updated' : 'Created', entity: values.name, description: editingId ? 'Item details, sourcing, or pricing were updated.' : `Item added under ${values.category}.`, actor: currentUsername, tone: 'success', amount: sellingPrice, status: values.status })
    setToast(editingId ? 'Item updated successfully' : 'Item added successfully')
    closeDialog()
  }

  function deleteItem() {
    if (!editingId) return
    const item = items.find((entry) => entry.id === editingId)
    if (!item) return
    setItems((current) => current.filter((entry) => entry.id !== editingId))
    appendSystemLog({ recordId: item.id, module: 'Items', action: 'Deleted', entity: item.name, description: 'Item was removed from the product catalog.', actor: currentUsername, tone: 'danger', amount: item.sellingPrice, status: item.status })
    if (detailItemId === item.id) returnToItems()
    setToast('Item removed')
    closeDialog()
  }

  return (
    <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
      {detailItemId ? detailItem ? <ItemDetailsView item={detailItem} supplier={detailSupplier} onBack={returnToItems} onEdit={() => openEditDialog(detailItem)} onAddVariant={() => addVariant(detailItem)} onEditVariant={(variant) => editVariant(detailItem, variant)} /> : <section className="grid min-h-[28rem] place-items-center rounded-[1.5rem] border border-slate-200/80 bg-white p-8 text-center shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]"><div className="max-w-sm"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-slate-50 text-brand-blue"><Icon className="size-6" path="m21 8-9-5-9 5 9 5 9-5ZM3 12l9 5 9-5" /></span><h2 className="mt-5 text-xl font-bold text-brand-blue">Product not found</h2><p className="mt-2 text-sm leading-6 text-slate-500">This product may have been removed or the link is no longer available.</p><button className="mt-5 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={returnToItems}>Back to items</button></div></section> : <>
      <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center" aria-label="Item summary">
        <div>
          <div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Product catalog</p></div>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Items inventory</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Organize product specifications, supplier sourcing, and pricing in one reliable catalog.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {summaryCards.map((card) => <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-3 py-3.5 shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] ring-1 ring-inset ring-white/70 transition-transform duration-200 hover:-translate-y-0.5 sm:min-w-32 sm:px-4" key={card.label}><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${card.dot} ring-4 ring-white`} /><p className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{card.label}</p></div><p className={`mt-2 truncate text-2xl font-bold tracking-[-0.04em] ${card.valueColor}`}>{card.value}</p></article>)}
        </div>
      </SummarySurface>

      {storageError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{storageError}</div> : null}

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]" aria-labelledby="items-list-heading">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm"><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-blue/40 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.05]" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, code, brand, or supplier..." aria-label="Search items" /></div>
            <div className="flex flex-wrap items-center gap-2">
              <AnimatedDropdown className="min-w-40" size="filter" fullWidth={false} value={categoryFilter} options={categoryOptions} onChange={setCategoryFilter} ariaLabel="Filter items by category" />
              <button className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-brand-blue/20 hover:bg-blue-50 hover:text-brand-blue" type="button" onClick={openCategoryManager} aria-label="Manage item categories" title="Manage categories"><Icon className="size-4" path="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></button>
              <AnimatedDropdown className="min-w-36" size="filter" fullWidth={false} value={statusFilter} options={statusFilterOptions} onChange={setStatusFilter} ariaLabel="Filter items by status" />
              {search || categoryFilter !== 'All categories' || statusFilter !== 'All statuses' ? <button className="h-10 rounded-xl px-3 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-brand-orange" type="button" onClick={() => { setSearch(''); setCategoryFilter('All categories'); setStatusFilter('All statuses') }}>Clear</button> : null}
              <button className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition-all hover:-translate-y-0.5 sm:flex-none" type="button" onClick={openAddDialog}><Icon className="size-4 transition-transform group-hover:rotate-90" path="M12 5v14M5 12h14" />Add item</button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><div><p className="text-sm font-bold text-brand-blue" id="items-list-heading">Item catalog</p><p className="mt-0.5 text-[11px] text-slate-400">Pricing and sourcing at a glance</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}</span></div>
        </div>

        {visibleItems.length ? <div className="grid gap-4 bg-slate-50/45 p-4 sm:p-5 md:grid-cols-2 2xl:grid-cols-3">
          {visibleItems.map((item) => {
            const statusTone = statusOptions.find((option) => option.value === item.status)
            return <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(0,20,76,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-blue/20 hover:shadow-[0_18px_38px_-24px_rgba(0,20,76,0.42)]" key={item.id}>
              <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#f97316,#ffb15c)] opacity-90" />
              <div className="flex min-w-0 items-start gap-3.5">
                <ProductPhoto item={item} size="large" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex max-w-[70%] rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-brand-blue"><span className="truncate">{item.category}</span></span>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold ${statusTone?.toneClassName ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}><span className={`size-1.5 rounded-full ${statusTone?.dotClassName ?? 'bg-slate-400'}`} />{item.status}</span>
                  </div>
                  <button className="mt-2 block max-w-full truncate text-left text-sm font-extrabold text-brand-blue transition group-hover:text-brand-orange" type="button" onClick={() => openItemDetails(item)}>{item.name}</button>
                  <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{item.brand || 'No brand'}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 border-y border-slate-100 py-3">
                <div className="rounded-xl bg-slate-50/80 px-3 py-2"><dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Unit</dt><dd className="mt-1 truncate text-xs font-extrabold text-slate-700">{item.unitOfMeasure}</dd></div>
                <div className="rounded-xl bg-violet-50/70 px-3 py-2"><dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-violet-400">Variations</dt><dd className="mt-1 text-xs font-extrabold text-violet-700">{item.variants.length} {item.variants.length === 1 ? 'option' : 'options'}</dd></div>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-mono text-[10px] font-semibold text-slate-400">{item.productCode}</p>
                <button className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[11px] font-bold text-brand-blue shadow-sm transition hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={() => openItemDetails(item)}>Full details<Icon className="size-3.5 transition-transform group-hover:translate-x-0.5" path="m9 18 6-6-6-6" /></button>
              </div>
            </article>
          })}
        </div> : <div className="grid min-h-80 place-items-center p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid size-16 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-brand-blue shadow-[0_15px_35px_-26px_rgba(0,20,76,0.5)]"><Icon className="size-6" path="m21 8-9-5-9 5 9 5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></span><p className="mt-5 text-[9px] font-bold uppercase tracking-[0.15em] text-brand-orange">{items.length ? 'No matches' : 'Build your catalog'}</p><h3 className="mt-2 text-lg font-bold text-brand-blue">{items.length ? 'No items found' : 'Add your first item'}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{items.length ? 'Try another search or clear the active filters.' : suppliers.length ? 'Create a product record with specifications, supplier sourcing, and pricing.' : 'Add a supplier first, then return here to create your product catalog.'}</p>{items.length ? <button className="mt-5 h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-500" type="button" onClick={() => { setSearch(''); setCategoryFilter('All categories'); setStatusFilter('All statuses') }}>Clear filters</button> : suppliers.length ? <button className="mt-5 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={openAddDialog}>Add first item</button> : <a className="mt-5 inline-flex h-10 items-center rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" href="/suppliers">Open Supplier Directory</a>}</div></div>}
      </section>

      </>}

      {isDialogOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title"><button className="absolute inset-0" type="button" onClick={closeDialog} aria-label="Close item dialog" /><form className="relative my-6 w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.3)]" onSubmit={saveItem}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Product catalog</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="item-dialog-title">{editingId ? 'Edit item' : 'Add a new item'}</h2><p className="mt-1 text-xs text-slate-400">Product details, sourcing, and pricing</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={closeDialog} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></div>
        <div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">
          {formError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{formError}</div> : null}
          <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
            <aside><p className={labelClassName}>Item photo</p><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-center"><div className="mx-auto flex justify-center"><ProductPhoto item={{ photo: draft.photo, name: draft.name || 'Item' }} /></div><input className="sr-only" ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handlePhotoChange(event)} /><button className="mt-4 h-9 w-full rounded-xl border border-slate-200 bg-white text-[10px] font-bold text-brand-blue transition hover:border-brand-blue/20" type="button" onClick={() => photoInputRef.current?.click()} disabled={isProcessingPhoto}>{isProcessingPhoto ? 'Processing...' : draft.photo ? 'Replace photo' : 'Upload photo'}</button>{draft.photo ? <button className="mt-2 text-[10px] font-bold text-red-500" type="button" onClick={() => setDraft((current) => ({ ...current, photo: '' }))}>Remove photo</button> : null}{photoError ? <p className="mt-2 text-[10px] leading-4 text-red-600">{photoError}</p> : <p className="mt-3 text-[9px] leading-4 text-slate-400">PNG, JPG, or WebP up to 5 MB</p>}</div></aside>
            <div className="space-y-6">
              <section><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Icon className="size-3.5" path="m21 8-9-5-9 5 9 5 9-5ZM3 12l9 5 9-5" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Item identity</h3><p className="text-[10px] text-slate-400">Core product and classification details</p></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClassName} htmlFor="item-name">Item name</label><input className={fieldClassName} id="item-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Heavy-duty extension cord" autoFocus required /></div><div><label className={labelClassName} htmlFor="item-category">Category</label><div className="flex gap-2"><AnimatedDropdown id="item-category" value={draft.category} options={categorySelectOptions} onChange={(category) => setDraft((current) => ({ ...current, category }))} ariaLabel="Item category" /><button className={`grid size-11 shrink-0 place-items-center rounded-xl border transition ${isAddingCategory ? 'border-brand-blue/20 bg-brand-blue/[0.06] text-brand-blue' : 'border-slate-200 bg-white text-slate-400 hover:border-brand-blue/20 hover:bg-blue-50 hover:text-brand-blue'}`} type="button" onClick={() => { setIsAddingCategory((current) => !current); setCategoryError('') }} aria-label="Add a new category" title="Add category"><Icon className="size-4" path="M12 5v14M5 12h14" /></button></div>{isAddingCategory ? <div className="mt-2 rounded-xl border border-brand-blue/10 bg-blue-50/45 p-2.5 animate-[content-enter_160ms_ease-out]"><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-brand-blue">New category</p><div className="flex gap-2"><input className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-brand-blue outline-none focus:border-brand-blue/40" value={newCategoryName} onChange={(event) => { setNewCategoryName(event.target.value); setCategoryError('') }} onKeyDown={handleCategoryKeyDown} placeholder="Category name" autoFocus /><button className="h-9 rounded-lg bg-brand-blue px-3 text-[10px] font-bold text-white disabled:opacity-40" type="button" onClick={addCategory} disabled={!newCategoryName.trim()}>Add</button></div>{categoryError ? <p className="mt-1.5 text-[9px] font-semibold text-red-600">{categoryError}</p> : null}</div> : null}</div><div><label className={labelClassName} htmlFor="item-subcategory">Subcategory</label><input className={fieldClassName} id="item-subcategory" value={draft.subcategory} onChange={(event) => setDraft((current) => ({ ...current, subcategory: event.target.value }))} placeholder="Cables and cords" required /></div><div><label className={labelClassName} htmlFor="item-brand">Brand</label><input className={fieldClassName} id="item-brand" value={draft.brand} onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))} placeholder="Brand name" required /></div><div><label className={labelClassName} htmlFor="item-status">Status</label><AnimatedDropdown id="item-status" value={draft.status} options={statusOptions} onChange={(status) => setDraft((current) => ({ ...current, status }))} ariaLabel="Item status" /></div><div className="sm:col-span-2"><label className={labelClassName} htmlFor="item-description">Description <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-brand-blue outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="item-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Product specifications or useful notes..." /></div></div></section>
              <section className="border-t border-slate-100 pt-5">
                <div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon className="size-3.5" path="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Product specifications</h3><p className="text-[10px] text-slate-400">Product codes and unit details</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName} htmlFor="item-product-code">Product code</label><input className={fieldClassName} id="item-product-code" value={draft.productCode} onChange={(event) => setDraft((current) => ({ ...current, productCode: event.target.value }))} placeholder="PRD-0001" required /></div><div><label className={labelClassName} htmlFor="item-barcode">Barcode</label><input className={fieldClassName} id="item-barcode" value={draft.barcode} onChange={(event) => setDraft((current) => ({ ...current, barcode: event.target.value }))} placeholder="4800000000000" inputMode="numeric" required /></div><div><label className={labelClassName} htmlFor="item-unit">Unit of measure</label><AnimatedDropdown id="item-unit" value={draft.unitOfMeasure} options={unitOptions} onChange={(unitOfMeasure) => setDraft((current) => ({ ...current, unitOfMeasure }))} ariaLabel="Unit of measure" /></div><div><label className={labelClassName} htmlFor="item-weight">Unit weight (kg)</label><input className={fieldClassName} id="item-weight" type="number" min="0" step="0.001" value={draft.unitWeight} onChange={(event) => setDraft((current) => ({ ...current, unitWeight: event.target.value }))} placeholder="0.000" required /></div></div>
              </section>
              <section className="border-t border-slate-100 pt-5"><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon className="size-3.5" path="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Pricing and supplier</h3><p className="text-[10px] text-slate-400">Cost, selling price, and directory-linked sourcing</p></div></div><div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName} htmlFor="item-raw-cost">Raw cost</label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₱</span><input className={`${fieldClassName} pl-8`} id="item-raw-cost" type="number" min="0" step="0.01" value={draft.rawCost} onChange={(event) => setDraft((current) => ({ ...current, rawCost: event.target.value }))} placeholder="0.00" required /></div></div><div><label className={labelClassName} htmlFor="item-selling-price">Selling price</label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₱</span><input className={`${fieldClassName} pl-8`} id="item-selling-price" type="number" min="0" step="0.01" value={draft.sellingPrice} onChange={(event) => setDraft((current) => ({ ...current, sellingPrice: event.target.value }))} placeholder="0.00" required /></div></div><div><label className={labelClassName} htmlFor="item-price-date">Last price update</label><AnimatedDatePicker id="item-price-date" value={draft.lastPriceUpdate} onChange={(lastPriceUpdate) => setDraft((current) => ({ ...current, lastPriceUpdate }))} ariaLabel="Last price update" required /></div><div className={`rounded-xl border px-3.5 py-2.5 ${draftProfit >= 0 ? 'border-emerald-100 bg-emerald-50/70' : 'border-red-100 bg-red-50/70'}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Estimated profit</p><div className="mt-1 flex items-baseline justify-between gap-2"><p className={`text-sm font-extrabold ${draftProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPeso(draftProfit)}</p><span className="text-[10px] font-bold text-slate-400">{draftMargin.toFixed(1)}% margin</span></div></div><div><label className={labelClassName} htmlFor="item-supplier">Supplier</label><AnimatedDropdown id="item-supplier" value={draft.supplierId} options={supplierOptions} onChange={(supplierId) => setDraft((current) => ({ ...current, supplierId }))} ariaLabel="Select supplier" />{!suppliers.length ? <p className="mt-1.5 text-[10px] font-medium text-red-500">Add a supplier in the Supplier Directory first.</p> : null}</div><div><label className={labelClassName} htmlFor="item-supplier-location">Supplier location</label><div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-orange"><Icon className="size-4" path="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></span><input className={`${fieldClassName} bg-slate-50 pl-10 text-slate-500`} id="item-supplier-location" value={selectedSupplier?.address || 'No location provided in Supplier Directory'} readOnly /></div></div></div></section>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">{editingId ? isConfirmingDelete ? <div className="flex items-center gap-2"><span className="text-xs font-bold text-red-600">Remove this item?</span><button className="h-9 rounded-xl px-3 text-xs font-bold text-slate-500" type="button" onClick={() => setIsConfirmingDelete(false)}>Cancel</button><button className="h-9 rounded-xl bg-red-600 px-3 text-xs font-bold text-white" type="button" onClick={deleteItem}>Remove</button></div> : <button className="h-9 rounded-xl px-3 text-xs font-bold text-red-500 transition hover:bg-red-50" type="button" onClick={() => setIsConfirmingDelete(true)}>Remove item</button> : <span />}<div className="ml-auto flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={closeDialog}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit" disabled={!suppliers.length}>{editingId ? 'Save changes' : 'Create item'}</button></div></div>
      </form></div> : null}

      {isVariantDialogOpen ? <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm animate-[content-enter_160ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="variant-dialog-title"><button className="absolute inset-0" type="button" onClick={() => setIsVariantDialogOpen(false)} aria-label="Close variant form" /><form className="relative my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.36)]" onSubmit={saveVariant}><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Product option</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="variant-dialog-title">{editingVariantId ? 'Edit variant' : 'Add a new variant'}</h2><p className="mt-1 text-xs text-slate-400">Manage this option’s photo and individual pricing.</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsVariantDialogOpen(false)} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button></div><div className="px-6 py-5">{variantFormError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{variantFormError}</div> : null}{photoError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{photoError}</div> : null}<VariantEditor variant={variantDraft} index={variantDialogIndex} isProcessingPhoto={processingVariantPhotoId === variantDraft.id} onUpdate={updateVariant} onPhotoChange={(id, event) => void handleVariantPhotoChange(id, event)} onRemove={() => undefined} showRemove={false} /></div><div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">{editingVariantId ? <button className="h-10 rounded-xl px-3 text-xs font-bold text-red-500 transition hover:bg-red-50" type="button" onClick={deleteVariant}>Remove variant</button> : <span />}<div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={() => setIsVariantDialogOpen(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">{editingVariantId ? 'Save changes' : 'Add variant'}</button></div></div></form></div> : null}

      {isCategoryManagerOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="category-manager-title">
          <button className="absolute inset-0" type="button" onClick={() => setIsCategoryManagerOpen(false)} aria-label="Close category manager" />
          <section className="relative my-6 w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.34)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Item settings</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="category-manager-title">Manage categories</h2><p className="mt-1 text-xs text-slate-400">Add, rename, or remove catalog categories.</p></div>
              <button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsCategoryManagerOpen(false)} aria-label="Close"><Icon path="M18 6 6 18M6 6l12 12" /></button>
            </div>

            <div className="px-6 py-5">
              <form className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4" onSubmit={saveCategory}>
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-brand-blue">{editingCategory ? 'Rename category' : 'Add category'}</p><p className="mt-0.5 text-[10px] text-slate-400">{editingCategory ? `Updating ${editingCategory}` : 'Create a reusable category for the catalog.'}</p></div>{editingCategory ? <button className="text-[10px] font-bold text-slate-400 hover:text-brand-orange" type="button" onClick={() => { setEditingCategory(null); setCategoryDraft(''); setCategoryManagerError('') }}>Cancel edit</button> : null}</div>
                <div className="mt-3 flex gap-2"><label className="sr-only" htmlFor="category-manager-name">Category name</label><input className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="category-manager-name" value={categoryDraft} onChange={(event) => { setCategoryDraft(event.target.value); setCategoryManagerError('') }} placeholder="Category name" autoFocus /><button className="h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={!categoryDraft.trim()}>{editingCategory ? 'Save' : 'Add'}</button></div>
                {categoryManagerError ? <p className="mt-2 text-[10px] font-semibold leading-4 text-red-600">{categoryManagerError}</p> : null}
              </form>

              <div className="mt-5 flex items-center justify-between"><div><p className="text-xs font-extrabold text-brand-blue">Available categories</p><p className="mt-0.5 text-[10px] text-slate-400">Categories in use must be emptied before deletion.</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{categories.length}</span></div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {categories.map((category) => {
                  const usageCount = items.filter((item) => item.category === category).length
                  const isPendingDelete = categoryPendingDelete === category
                  return (
                    <div className={`rounded-xl border px-3.5 py-3 transition ${editingCategory === category ? 'border-brand-blue/20 bg-brand-blue/[0.035] ring-2 ring-brand-blue/[0.05]' : 'border-slate-200 bg-white hover:bg-slate-50/70'}`} key={category}>
                      {isPendingDelete ? (
                        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-red-700">Delete {category}?</p><p className="mt-0.5 text-[9px] text-red-500">This category is not currently used.</p></div><div className="flex gap-2"><button className="h-8 rounded-lg px-2.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setCategoryPendingDelete(null)}>Cancel</button><button className="h-8 rounded-lg bg-red-600 px-2.5 text-[10px] font-bold text-white" type="button" onClick={() => deleteCategory(category)}>Delete</button></div></div>
                      ) : (
                        <div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-blue"><Icon className="size-3.5" path="M4 5h16v14H4V5Zm4 4h8M8 13h5" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{category}</p><p className="mt-0.5 text-[9px] font-medium text-slate-400">{usageCount} {usageCount === 1 ? 'item' : 'items'}</p></div><button className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-blue-50 hover:text-brand-blue" type="button" onClick={() => beginEditingCategory(category)} aria-label={`Edit ${category}`} title="Rename"><Icon className="size-3.5" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" /></button><button className={`grid size-8 place-items-center rounded-lg transition ${usageCount ? 'cursor-not-allowed text-slate-200' : 'text-slate-300 hover:bg-red-50 hover:text-red-600'}`} type="button" onClick={() => usageCount ? deleteCategory(category) : setCategoryPendingDelete(category)} aria-label={`Delete ${category}`} title={usageCount ? 'Move linked items before deleting' : 'Delete'}><Icon className="size-3.5" path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></button></div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl bg-brand-blue px-5 text-xs font-bold text-white" type="button" onClick={() => setIsCategoryManagerOpen(false)}>Done</button></div>
          </section>
        </div>
      ) : null}
      <SuccessToast message={toast} />
    </div>
  )
}
