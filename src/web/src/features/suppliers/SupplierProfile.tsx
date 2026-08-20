import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartLoadingState } from '../../components/charts/ChartSupport'

const ActivityValueChart = lazy(() => import('../../components/charts/ActivityValueChart'))

export type SupplierProfileData = {
  id: string
  logo: string
  name: string
  type: string
  status: string
  tin: string
  companyEmail: string
  companyPhone: string
  address: string
  contacts: { id: string; name: string; email: string; phone: string }[]
  categories: string[]
  performanceNotes: { id: string; text: string }[]
  catalogLink: string
  createdAt: string
  updatedAt: string
}

export type SupplierRegisteredItem = {
  id: string
  photo: string
  name: string
  category: string
  subcategory: string
  brand: string
  unitOfMeasure: string
  productCode: string
  rawCost: number
  sellingPrice: number
  status: string
  variants: {
    id: string
    status: string
    rawCost: number
    sellingPrice: number
  }[]
}

export type SupplierPurchaseOrder = {
  id: string
  date: string
  poNumber: string
  clientName: string
  supplierId: string
  supplierName: string
  contactPerson: string
  totalAmount: number
  status: string
  addedToExpenses: boolean
  items: unknown[]
  createdAt: string
  updatedAt: string
}

type SupplierProfileProps = {
  supplier: SupplierProfileData
  orders: SupplierPurchaseOrder[]
  items: SupplierRegisteredItem[]
  onBack: () => void
  onEdit: () => void
  onOpenPurchaseOrders: () => void
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SP'
  )
}

function Logo({ supplier }: { supplier: SupplierProfileData }) {
  return supplier.logo ? (
    <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:size-28">
      <img className="size-full object-contain" src={supplier.logo} alt={supplier.name} />
    </span>
  ) : (
    <span className="grid size-24 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,#0a347b,#00113f)] text-xl font-extrabold tracking-wide text-white shadow-[0_12px_28px_-16px_rgba(0,20,76,0.8)] sm:size-28">{initials(supplier.name)}</span>
  )
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)
}

function formatDate(value: string) {
  if (!value) return 'Not provided'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime())
    ? 'Not provided'
    : new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
}

function statusTone(status: string) {
  if (status === 'Delivered') return 'bg-emerald-50 text-emerald-700'
  if (status === 'For Payment') return 'bg-amber-50 text-amber-700'
  if (status === 'Waiting for Delivery') return 'bg-sky-50 text-sky-700'
  if (status === 'Cancelled') return 'bg-red-50 text-red-600'
  if (status === 'Sent') return 'bg-violet-50 text-violet-700'
  return 'bg-slate-100 text-slate-600'
}

function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function ItemPhoto({ item }: { item: SupplierRegisteredItem }) {
  return item.photo ? (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <img className="size-full object-contain" src={item.photo} alt={item.name} />
    </span>
  ) : (
    <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,#eff6ff,#e8eef9)] text-sm font-extrabold text-brand-blue ring-1 ring-inset ring-brand-blue/5">{initials(item.name)}</span>
  )
}

function RegisteredItemsSection({ items }: { items: SupplierRegisteredItem[] }) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...items].filter((item) => !query || [item.name, item.category, item.subcategory, item.brand, item.productCode, item.unitOfMeasure, item.status].some((value) => value.toLowerCase().includes(query))).sort((left, right) => (left.status === right.status ? left.name.localeCompare(right.name) : left.status === 'Active' ? -1 : 1))
  }, [items, search])
  const displayedItems = showAll || search ? visibleItems : visibleItems.slice(0, 6)
  const totalSkus = items.reduce((total, item) => total + 1 + item.variants.length, 0)
  const activeSkus = items.reduce((total, item) => total + (item.status === 'Active' ? 1 : 0) + item.variants.filter((variant) => variant.status === 'Active').length, 0)
  const categoryCount = new Set(items.map((item) => item.category).filter(Boolean)).size

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_42px_-32px_rgba(0,20,76,0.38)]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <Icon className="size-3.5" path="m21 8-9-5-9 5 9 5 9-5ZM3 12l9 5 9-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-brand-blue">Registered items</h3>
                <p className="mt-0.5 text-xs text-slate-400">Products sourced from this supplier</p>
              </div>
            </div>
          </div>
          {items.length > 4 ? (
            <div className="relative w-full lg:w-72">
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
              <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs font-semibold text-brand-blue outline-none transition placeholder:text-slate-400 focus:border-brand-blue/30 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.04]" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier items..." aria-label="Search registered supplier items" />
            </div>
          ) : (
            <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
              {items.length} {items.length === 1 ? 'product' : 'products'}
            </span>
          )}
        </div>
        {items.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/65 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Products</p>
              <p className="mt-1 text-lg font-extrabold text-brand-blue">{items.length}</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/55 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-violet-400">Sellable SKUs</p>
              <p className="mt-1 text-lg font-extrabold text-violet-700">{totalSkus}</p>
              <p className="text-[9px] font-semibold text-violet-400">{activeSkus} active</p>
            </div>
            <div className="rounded-xl border border-orange-100 bg-orange-50/55 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-orange-400">Categories</p>
              <p className="mt-1 text-lg font-extrabold text-brand-orange">{categoryCount}</p>
            </div>
          </div>
        ) : null}
      </div>
      {displayedItems.length ? (
        <div className="grid gap-3 bg-slate-50/35 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          {displayedItems.map((item, index) => {
            const profit = item.sellingPrice - item.rawCost
            const margin = item.sellingPrice > 0 ? (profit / item.sellingPrice) * 100 : 0
            return (
              <a className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_-25px_rgba(0,20,76,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-blue/20 hover:shadow-[0_20px_38px_-25px_rgba(0,20,76,0.44)] animate-[po-card-enter_320ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${Math.min(index * 35, 175)}ms` }} href={`/items/${encodeURIComponent(item.id)}`} key={item.id}>
                <span className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,#f97316,#ffb15c)] opacity-90" />
                <div className="flex min-w-0 items-start gap-3">
                  <ItemPhoto item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="max-w-[65%] truncate rounded-lg bg-blue-50 px-2 py-1 text-[9px] font-bold text-brand-blue">{item.category || 'Uncategorized'}</span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${item.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : item.status === 'Discontinued' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`size-1.5 rounded-full ${item.status === 'Active' ? 'bg-emerald-500' : item.status === 'Discontinued' ? 'bg-red-400' : 'bg-slate-400'}`} />
                        {item.status}
                      </span>
                    </div>
                    <h4 className="mt-2 truncate text-sm font-extrabold text-brand-blue transition group-hover:text-brand-orange">{item.name}</h4>
                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
                      {item.brand || 'No brand'} · {item.unitOfMeasure}
                    </p>
                    <p className="mt-1.5 truncate font-mono text-[9px] font-semibold text-slate-400">{item.productCode || 'No product code'}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">Raw cost</p>
                    <p className="mt-1 truncate text-[11px] font-bold text-slate-600">{formatPeso(item.rawCost)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">Selling</p>
                    <p className="mt-1 truncate text-[11px] font-extrabold text-brand-blue">{formatPeso(item.sellingPrice)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">Margin</p>
                    <p className={`mt-1 text-[11px] font-extrabold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700">
                    {item.variants.length} {item.variants.length === 1 ? 'variant' : 'variants'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-blue">
                    View item <Icon className="size-3 transition-transform group-hover:translate-x-0.5" path="m9 18 6-6-6-6" />
                  </span>
                </div>
              </a>
            )
          })}
        </div>
      ) : items.length ? (
        <div className="grid min-h-44 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-300">
              <Icon path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
            </span>
            <p className="mt-3 text-sm font-bold text-brand-blue">No matching items</p>
            <button className="mt-2 text-xs font-bold text-brand-orange" type="button" onClick={() => setSearch('')}>
              Clear search
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-52 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-300">
              <Icon className="size-5" path="m21 8-9-5-9 5 9 5 9-5M3 12l9 5 9-5" />
            </span>
            <h4 className="mt-4 text-sm font-bold text-brand-blue">No registered items</h4>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Items assigned to this supplier in the product catalog will appear here automatically.</p>
          </div>
        </div>
      )}
      {!search && visibleItems.length > 6 ? (
        <div className="flex justify-center border-t border-slate-100 bg-white px-5 py-4">
          <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? 'Show less' : `Show all ${visibleItems.length} items`}
            <Icon className={`size-3 transition-transform ${showAll ? '-rotate-90' : 'rotate-90'}`} path="m9 18 6-6-6-6" />
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function SupplierProfile({ supplier, orders, items, onBack, onEdit, onOpenPurchaseOrders }: SupplierProfileProps) {
  const sortedOrders = [...orders].sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
  const validOrders = orders.filter((order) => order.status !== 'Cancelled')
  const totalValue = validOrders.reduce((total, order) => total + order.totalAmount, 0)
  const deliveredValue = validOrders.filter((order) => order.status === 'Delivered').reduce((total, order) => total + order.totalAmount, 0)
  const openOrders = validOrders.filter((order) => order.status !== 'Delivered')
  const catalogUrl = safeUrl(supplier.catalogLink)
  const now = new Date()
  const activity = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthOrders = validOrders.filter((order) => order.date.startsWith(key))
    return {
      key,
      label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date),
      count: monthOrders.length,
      amount: monthOrders.reduce((total, order) => total + order.totalAmount, 0),
    }
  })

  return (
    <div className="space-y-4 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-px w-6 bg-brand-orange" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Supplier intelligence</p>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Supplier profile</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/20" type="button" onClick={onBack}>
            <Icon path="m15 18-6-6 6-6" />
            Back to suppliers
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_9px_22px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="button" onClick={onEdit}>
            <Icon className="size-3.5" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" />
            Edit supplier
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_16px_48px_-34px_rgba(0,20,76,0.4)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.05fr_1.35fr] lg:p-6">
          <div className="flex min-w-0 gap-4">
            <Logo supplier={supplier} />
            <div className="min-w-0 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-xl font-extrabold tracking-[-0.03em] text-brand-blue sm:text-2xl">{supplier.name}</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold ${supplier.status === 'Active' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                  <span className={`size-1.5 rounded-full ${supplier.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {supplier.status}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{supplier.type}</p>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Supplier since</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(supplier.createdAt)}</p>
              <p className="mt-3 text-xs font-semibold text-slate-400">Updated {formatDate(supplier.updatedAt)}</p>
            </div>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/65 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Company email</p>
              {supplier.companyEmail ? (
                <a className="mt-1 block truncate text-sm font-bold text-brand-blue hover:text-brand-orange" href={`mailto:${supplier.companyEmail}`}>
                  {supplier.companyEmail}
                </a>
              ) : (
                <p className="mt-1 text-sm text-slate-300">Not provided</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/65 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Company number</p>
              {supplier.companyPhone ? (
                <a className="mt-1 block text-sm font-bold text-brand-blue hover:text-brand-orange" href={`tel:${supplier.companyPhone}`}>
                  {supplier.companyPhone}
                </a>
              ) : (
                <p className="mt-1 text-sm text-slate-300">Not provided</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/65 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">TIN</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{supplier.tin || 'Not provided'}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/65 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Catalog</p>
              {catalogUrl ? (
                <a className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-orange" href={catalogUrl} target="_blank" rel="noreferrer">
                  Open catalog <Icon className="size-3" path="M14 3h7v7M10 14 21 3" />
                </a>
              ) : (
                <p className="mt-1 text-sm text-slate-300">Not provided</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/65 p-3 sm:col-span-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Address / location</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">{supplier.address || 'Not provided'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Supplier purchase order summary">
        {[
          {
            label: 'Purchase orders',
            value: orders.length,
            tone: 'text-brand-blue',
            dot: 'bg-brand-blue',
          },
          {
            label: 'Order value',
            value: formatPeso(totalValue),
            tone: 'text-violet-600',
            dot: 'bg-violet-500',
          },
          {
            label: 'Delivered value',
            value: formatPeso(deliveredValue),
            tone: 'text-emerald-600',
            dot: 'bg-emerald-500',
          },
          {
            label: 'Open orders',
            value: openOrders.length,
            tone: 'text-amber-600',
            dot: 'bg-amber-500',
          },
        ].map((card, index) => (
          <article className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_10px_28px_-24px_rgba(0,20,76,0.42)] transition hover:-translate-y-0.5 animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${index * 45}ms` }} key={card.label}>
            <div className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${card.dot}`} />
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">{card.label}</p>
            </div>
            <p className={`mt-2 truncate text-xl font-extrabold tracking-[-0.035em] ${card.tone}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_-30px_rgba(0,20,76,0.35)]">
          <h3 className="text-base font-extrabold text-brand-blue">Purchase activity</h3>
          <p className="mt-1 text-xs text-slate-400">Order value during the last six months</p>
          <Suspense fallback={<ChartLoadingState className="mt-5 h-44" />}>
            <ActivityValueChart data={activity} ariaLabel="Supplier purchase-order value during the last six months" emptyTitle="No recent purchase activity" emptyDetail="Purchase orders from the last six months will appear here." itemLabel="purchase order" />
          </Suspense>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_-30px_rgba(0,20,76,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-brand-blue">Supplier details</h3>
              <p className="mt-1 text-xs text-slate-400">Contacts, capabilities, and internal notes</p>
            </div>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-brand-blue">{supplier.contacts.length} contacts</span>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Contact persons</p>
              <div className="mt-2 space-y-2">
                {supplier.contacts.length ? (
                  supplier.contacts.map((contact) => (
                    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50/70 p-3" key={contact.id}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[9px] font-extrabold text-brand-blue shadow-sm">{initials(contact.name)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-700">{contact.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-400">
                          <a className="truncate hover:text-brand-blue" href={`mailto:${contact.email}`}>
                            {contact.email}
                          </a>
                          <a className="hover:text-brand-blue" href={`tel:${contact.phone}`}>
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No contacts added.</p>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Supply categories</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {supplier.categories.length ? (
                    supplier.categories.map((category) => (
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-brand-blue" key={category}>
                        {category}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No categories added.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Performance notes</p>
                <div className="mt-2 space-y-2">
                  {supplier.performanceNotes.length ? (
                    supplier.performanceNotes.map((note) => (
                      <div className="flex gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-[11px] leading-5 text-amber-900" key={note.id}>
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                        {note.text}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No performance notes added.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <RegisteredItemsSection items={items} />

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_42px_-32px_rgba(0,20,76,0.38)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold text-brand-blue">Purchase order history</h3>
            <p className="mt-1 text-xs text-slate-400">Transactions recorded for this supplier</p>
          </div>
          <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_9px_22px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="button" onClick={onOpenPurchaseOrders}>
            Open purchase orders
            <Icon className="size-3.5" path="m9 18 6-6-6-6" />
          </button>
        </div>
        {sortedOrders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  <th className="w-[13%] px-4 py-3">PO date</th>
                  <th className="w-[18%] px-4 py-3">PO number</th>
                  <th className="w-[20%] px-4 py-3">Client</th>
                  <th className="w-[10%] px-4 py-3 text-center">Items</th>
                  <th className="w-[16%] px-4 py-3 text-right">Total</th>
                  <th className="w-[15%] px-4 py-3">Status</th>
                  <th className="w-[8%] px-4 py-3 text-center">Expense</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <tr className="border-b border-slate-100 transition hover:bg-slate-50/70" key={order.id}>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{formatDate(order.date)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-extrabold text-brand-blue">{order.poNumber}</td>
                    <td className="px-4 py-3">
                      <p className="truncate text-xs font-bold text-slate-600">{order.clientName}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">{order.contactPerson}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-violet-700">{order.items.length}</td>
                    <td className="px-4 py-3 text-right text-xs font-extrabold tabular-nums text-brand-blue">{formatPeso(order.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${statusTone(order.status)}`}>{order.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-lg px-2 py-1 text-[9px] font-bold ${order.addedToExpenses ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{order.addedToExpenses ? 'Added' : 'No'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-300">
                <Icon className="size-5" path="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6" />
              </span>
              <h4 className="mt-4 text-sm font-bold text-brand-blue">No purchase orders yet</h4>
              <p className="mt-1 text-xs text-slate-400">Orders created for this supplier will appear here.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
