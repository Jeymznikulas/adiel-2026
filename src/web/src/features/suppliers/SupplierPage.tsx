import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { DocumentFormScaffold, type DocumentFormAction } from '../../components/ui/DocumentFormScaffold'
import { FormErrorSummary } from '../../components/ui/FormErrorSummary'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { PrivateImage } from '../../components/ui/PrivateImage'
import { RecordListSkeleton } from '../../components/ui/RecordListSkeleton'
import { SquareImageCropper } from '../../components/ui/SquareImageCropper'
import { TableControls, useTableView } from '../../components/ui/TableControls'
import { usePersistentState } from '../../components/ui/usePersistentState'
import { listBusinessOptions } from '../../services/api/settings'
import { listItems } from '../../services/api/items'
import { listPurchaseOrders } from '../../services/api/purchaseOrders'
import { archiveSupplier, createSupplier, listSuppliers, updateSupplier, type Supplier as ApiSupplier, type SupplierContact as ApiSupplierContact, type SupplierPerformanceNote as ApiSupplierPerformanceNote, type SupplierType } from '../../services/api/suppliers'
import { removeImage, uploadImage } from '../../services/api/images'
import { SupplierProfile, type SupplierPurchaseOrder, type SupplierRegisteredItem } from './SupplierProfile'

type SupplierFilter = 'All suppliers' | SupplierType

type ContactPerson = Omit<ApiSupplierContact, 'isPrimary' | 'sortOrder'>

type PerformanceNote = ApiSupplierPerformanceNote

type Supplier = Omit<ApiSupplier, 'catalogUrl'> & { catalogLink: string }

type SupplierDraft = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'version' | 'contacts' | 'performanceNotes' | 'catalogUrl'> & { contacts: ContactPerson[]; performanceNotes: PerformanceNote[]; catalogLink: string }

type SupplierPageProps = {
  currentUsername: string
}

const supplierTypes: SupplierType[] = ['Contractor', 'Distributor', 'Manufacturer', 'Service provider', 'Other']
const supplierTypeOptions = supplierTypes.map((value) => ({ value }))
const supplierStatusOptions = [
  { value: 'Active' as const, dotClassName: 'bg-emerald-500', toneClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  { value: 'Inactive' as const, dotClassName: 'bg-slate-400', toneClassName: 'border-slate-200 bg-slate-100 text-slate-600' },
]
const supplierFilterOptions: { value: SupplierFilter; label: string }[] = [
  { value: 'All suppliers', label: 'All types' },
  ...supplierTypes.map((value) => ({ value, label: value })),
]
const defaultCategorySuggestions = ['Electrical', 'Metals', 'Hardware', 'Construction', 'Safety', 'Plumbing', 'Tools', 'Office supplies']
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500'

function createContact(): ContactPerson {
  return { id: crypto.randomUUID(), name: '', email: '', phone: '' }
}

function createPerformanceNote(text = ''): PerformanceNote {
  return { id: crypto.randomUUID(), text }
}

function createEmptyDraft(): SupplierDraft {
  return {
    logo: '',
    name: '',
    type: 'Distributor',
    status: 'Active',
    tin: '',
    companyEmail: '',
    companyPhone: '',
    address: '',
    contacts: [createContact()],
    categories: [],
    performanceNotes: [createPerformanceNote()],
    catalogLink: '',
  }
}

function supplierInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'SP'
}

function getSafeUrl(value: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function formatUpdatedDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function supplierTypeTone(type: SupplierType) {
  if (type === 'Contractor') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (type === 'Distributor') return 'border-sky-100 bg-sky-50 text-sky-700'
  if (type === 'Manufacturer') return 'border-violet-100 bg-violet-50 text-violet-700'
  if (type === 'Service provider') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function LogoMark({ supplier, size = 'large' }: { supplier: Pick<Supplier, 'logo' | 'name'> & { id?: string }; size?: 'large' | 'small' }) {
  const sizeClassName = size === 'large' ? 'size-14 rounded-2xl text-sm' : 'size-10 rounded-xl text-xs'
  const entityId = supplier.id ?? supplier.logo.split('/')[2]
  return supplier.logo ? (
    <span className={`${sizeClassName} grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-white p-1.5 shadow-sm`}>
      <PrivateImage className="size-full object-contain" target="suppliers" entityId={entityId} objectPath={supplier.logo} alt="" />
    </span>
  ) : (
    <span className={`${sizeClassName} grid shrink-0 place-items-center bg-[linear-gradient(145deg,#0a347b,#00113f)] font-extrabold tracking-wide text-white shadow-[0_9px_22px_-12px_rgba(0,20,76,0.8)]`} aria-hidden="true">
      {supplierInitials(supplier.name)}
    </span>
  )
}

export function SupplierPage({ currentUsername: _currentUsername }: SupplierPageProps) {
  const [categorySuggestions, setCategorySuggestions] = useState(defaultCategorySuggestions)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<SupplierPurchaseOrder[]>([])
  const [registeredItems, setRegisteredItems] = useState<(SupplierRegisteredItem & { supplierId: string })[]>([])
  const [search, setSearch] = usePersistentState('suppliers.search', '')
  const [typeFilter, setTypeFilter] = usePersistentState<SupplierFilter>('suppliers.type', 'All suppliers')
  const [draft, setDraft] = useState<SupplierDraft>(createEmptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(() => window.location.pathname.match(/^\/suppliers\/([^/]+)$/)?.[1] ?? null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [categoryInput, setCategoryInput] = useState('')
  const [logoError, setLogoError] = useState('')
  const [formError, setFormError] = useState('')
  const [pendingLogo, setPendingLogo] = useState<File | null>(null)
  const [logoToCrop, setLogoToCrop] = useState<File | null>(null)
  const isProcessingLogo = logoToCrop !== null
  const [storageError, setStorageError] = useState('')
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true)
  const [hasLoadedSuppliers, setHasLoadedSuppliers] = useState(false)
  const [toast, setToast] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isActive = true
    void listBusinessOptions('supplier_category').then((result) => { if (isActive) setCategorySuggestions(result.filter((option) => option.isActive).map((option) => option.name)) })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    let isActive = true
    void listSuppliers().then((result) => {
      if (!isActive) return
      setSuppliers(result.items.map(toSupplier))
      setHasLoadedSuppliers(true)
      setStorageError('')
    }).catch((failure: unknown) => {
      if (isActive) setStorageError(failure instanceof Error ? failure.message : 'Suppliers could not be loaded.')
    }).finally(() => { if (isActive) setIsLoadingSuppliers(false) })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    let isActive = true
    void Promise.all([listPurchaseOrders({ pageSize: 100 }), listItems({ pageSize: 100, sort: 'name' })]).then(([orders, items]) => {
      if (!isActive) return
      setPurchaseOrders(orders.items.map((order) => ({ id: order.id, date: order.orderDate, poNumber: order.poNumber, clientName: order.clientName, supplierId: order.supplierId ?? '', supplierName: order.supplierName, contactPerson: order.contactPerson, totalAmount: order.totalAmount, status: order.status, addedToExpenses: false, items: order.lines, createdAt: order.createdAt, updatedAt: order.updatedAt })))
      setRegisteredItems(items.items.map((item) => ({ id: item.id, supplierId: item.supplierId ?? '', photo: item.photo, name: item.name, category: item.category, subcategory: item.subcategory, brand: item.brand, unitOfMeasure: item.unitOfMeasure, productCode: item.productCode, rawCost: item.rawCost, sellingPrice: item.sellingPrice, status: item.status, includesBase: true, variants: item.variants.map((variant) => ({ id: variant.id, supplierId: variant.supplierId ?? item.supplierId ?? '', status: variant.status, rawCost: variant.rawCost, sellingPrice: variant.sellingPrice })) })))
    }).catch(() => { if (isActive) setStorageError('Supplier purchase orders and items could not be loaded from the API.') })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    function syncPath() { setSelectedSupplierId(window.location.pathname.match(/^\/suppliers\/([^/]+)$/)?.[1] ?? null) }
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  const activeSuppliers = useMemo(() => suppliers.filter((supplier) => supplier.archivedAt === null), [suppliers])
  const matchingSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activeSuppliers
      .filter((supplier) => typeFilter === 'All suppliers' || supplier.type === typeFilter)
      .filter((supplier) => {
        if (!query) return true
        return [
          supplier.name,
          supplier.type,
          supplier.status,
          supplier.tin,
          supplier.companyEmail,
          supplier.companyPhone,
          supplier.address,
          ...supplier.categories,
          ...supplier.performanceNotes.map((note) => note.text),
          ...supplier.contacts.flatMap((contact) => [contact.name, contact.email, contact.phone]),
        ].some((value) => value.toLowerCase().includes(query))
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [activeSuppliers, search, typeFilter])
  const supplierSortOptions = [
    { value: 'name', label: 'Name A-Z', getValue: (supplier: Supplier) => supplier.name, direction: 'asc' as const },
    { value: 'type', label: 'Type A-Z', getValue: (supplier: Supplier) => supplier.type, direction: 'asc' as const },
    { value: 'status', label: 'Active first', getValue: (supplier: Supplier) => supplier.status === 'Active' ? 1 : 0, direction: 'desc' as const },
    { value: 'contacts', label: 'Most contacts', getValue: (supplier: Supplier) => supplier.contacts.length, direction: 'desc' as const },
  ]
  const supplierTable = useTableView({ rows: matchingSuppliers, storageKey: 'suppliers.directory', sortOptions: supplierSortOptions, pageSizeOptions: [12, 24, 48] })
  const visibleSuppliers = supplierTable.pageRows

  const categoryCount = new Set(activeSuppliers.flatMap((supplier) => supplier.categories.map((category) => category.toLowerCase()))).size
  const activeSupplierCount = activeSuppliers.filter((supplier) => supplier.status === 'Active').length
  const isEditing = editingId !== null
  const selectedSupplier = selectedSupplierId === null ? null : suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null
  const selectedSupplierOrders = useMemo(() => selectedSupplier ? purchaseOrders.filter((order) => order.supplierId === selectedSupplier.id) : [], [purchaseOrders, selectedSupplier])
  const selectedSupplierItems = useMemo(() => selectedSupplier ? registeredItems.flatMap((item) => {
    const variants = item.variants.filter((variant) => variant.supplierId === selectedSupplier.id)
    const includesBase = item.supplierId === selectedSupplier.id
    if (!includesBase && !variants.length) return []
    const representative = includesBase ? item : variants[0]!
    return [{ ...item, includesBase, variants, rawCost: representative.rawCost, sellingPrice: representative.sellingPrice }]
  }) : [], [registeredItems, selectedSupplier])

  function openAddDialog() {
    setDraft(createEmptyDraft())
    setFormError('')
    setPendingLogo(null)
    setLogoToCrop(null)
    setEditingId(null)
    setCategoryInput('')
    setLogoError('')
    setIsConfirmingDelete(false)
    setIsDialogOpen(true)
  }

  function openEditDialog(supplier: Supplier) {
    setPendingLogo(null)
    setFormError('')
    setLogoToCrop(null)
    setDraft({
      logo: supplier.logo,
      name: supplier.name,
      type: supplier.type,
      status: supplier.status,
      tin: supplier.tin,
      companyEmail: supplier.companyEmail,
      companyPhone: supplier.companyPhone,
      address: supplier.address,
      contacts: supplier.contacts.map((contact) => ({ ...contact })),
      categories: [...supplier.categories],
      performanceNotes: supplier.performanceNotes.length ? supplier.performanceNotes.map((note) => ({ ...note })) : [createPerformanceNote()],
      catalogLink: supplier.catalogLink,
    })
    setEditingId(supplier.id)
    setCategoryInput('')
    setLogoError('')
    setIsConfirmingDelete(false)
    setIsDialogOpen(true)
  }

  function openSupplierDetails(supplier: Supplier) {
    window.history.pushState({ adielSupplierProfile: true }, '', `/suppliers/${supplier.id}`)
    setSelectedSupplierId(supplier.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeSupplierProfile() {
    const state: unknown = window.history.state
    const openedFromDirectory = typeof state === 'object' && state !== null && 'adielSupplierProfile' in state && state.adielSupplierProfile === true
    setSelectedSupplierId(null)
    if (openedFromDirectory) window.history.back()
    else {
      window.history.replaceState(null, '', '/suppliers')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  function openPurchaseOrders() {
    window.history.pushState(null, '', '/purchase-orders')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setFormError('')
    setIsConfirmingDelete(false)
    setLogoError('')
    setLogoToCrop(null)
  }

  function updateContact(id: string, field: 'name' | 'email' | 'phone', value: string) {
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact) => contact.id === id ? { ...contact, [field]: value } : contact),
    }))
  }

  function addContact() {
    setDraft((current) => ({ ...current, contacts: [...current.contacts, createContact()] }))
  }

  function removeContact(id: string) {
    setDraft((current) => ({ ...current, contacts: current.contacts.filter((contact) => contact.id !== id) }))
  }

  function addPerformanceNote() {
    setDraft((current) => ({ ...current, performanceNotes: [...current.performanceNotes, createPerformanceNote()] }))
  }

  function updatePerformanceNote(id: string, text: string) {
    setDraft((current) => ({
      ...current,
      performanceNotes: current.performanceNotes.map((note) => note.id === id ? { ...note, text } : note),
    }))
  }

  function removePerformanceNote(id: string) {
    setDraft((current) => ({ ...current, performanceNotes: current.performanceNotes.filter((note) => note.id !== id) }))
  }

  function addCategory(value = categoryInput) {
    const category = value.trim().replace(/^,+|,+$/g, '')
    if (!category) return
    setDraft((current) => current.categories.some((item) => item.toLowerCase() === category.toLowerCase())
      ? current
      : { ...current, categories: [...current.categories, category] })
    setCategoryInput('')
  }

  function handleCategoryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    addCategory()
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLogoError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setLogoError('Upload a PNG, JPG, or WebP image up to 5 MB.'); return }
    setLogoToCrop(file)
  }

  function applyCroppedLogo(file: File) {
    setLogoToCrop(null)
    setPendingLogo(file)
    setDraft((current) => ({ ...current, logo: URL.createObjectURL(file) }))
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedDraft = {
      ...draft,
      name: draft.name.trim(),
      tin: draft.tin.trim(),
      companyEmail: draft.companyEmail.trim(),
      companyPhone: draft.companyPhone.trim(),
      address: draft.address.trim(),
      contacts: draft.contacts.map((contact) => ({
        ...contact,
        name: contact.name.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
      })),
      performanceNotes: draft.performanceNotes
        .map((note) => ({ ...note, text: note.text.trim() }))
        .filter((note) => Boolean(note.text)),
      catalogLink: draft.catalogLink.trim(),
    }

    try {
      const previous = editingId ? suppliers.find((supplier) => supplier.id === editingId) : undefined
      const payload = {
        ...normalizedDraft,
        logo: previous?.logo ?? '',
        catalogUrl: normalizedDraft.catalogLink,
      }
      let saved = editingId
        ? await updateSupplier(editingId, { ...payload, version: suppliers.find((supplier) => supplier.id === editingId)?.version })
        : await createSupplier(payload)
      if (pendingLogo) { const image = await uploadImage('suppliers', saved.id, saved.version, pendingLogo); saved = { ...saved, logo: image.objectPath, version: image.version } }
      else if (previous?.logo && !draft.logo) { const removed = await removeImage('suppliers', saved.id, saved.version); saved = { ...saved, logo: '', version: removed.version } }
      const nextSupplier = toSupplier(saved)
      setSuppliers((current) => editingId ? current.map((supplier) => supplier.id === editingId ? nextSupplier : supplier) : [...current, nextSupplier])
      setStorageError('')
      setFormError('')
      setToast(editingId ? 'Supplier details updated' : 'Supplier added to the directory')
      closeDialog()
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Supplier details could not be saved.')
    }
  }

  async function deleteSupplier() {
    if (!editingId) return
    const supplier = suppliers.find((item) => item.id === editingId)
    if (!supplier) return
    try {
      const archived = toSupplier(await archiveSupplier(supplier.id, supplier.version))
      setSuppliers((current) => current.map((entry) => entry.id === archived.id ? archived : entry))
      setStorageError('')
      setToast('Supplier archived')
      closeDialog()
    } catch (failure) {
      setStorageError(failure instanceof Error ? failure.message : 'Supplier could not be archived.')
    }
  }

  const supplierFormActions: DocumentFormAction[] = isEditing
    ? isConfirmingDelete
      ? [
          { label: 'Keep supplier', onClick: () => setIsConfirmingDelete(false), disabled: isProcessingLogo },
          { label: 'Confirm archive', tone: 'danger', onClick: () => void deleteSupplier(), disabled: isProcessingLogo },
        ]
      : [
          { label: 'Archive supplier', tone: 'danger', onClick: () => setIsConfirmingDelete(true), disabled: isProcessingLogo },
          { label: 'Save changes', tone: 'primary', disabled: isProcessingLogo },
        ]
    : [{ label: 'Add supplier', tone: 'primary', disabled: isProcessingLogo }]

  const stats = [
    { label: 'Total suppliers', value: activeSuppliers.length, dot: 'bg-brand-blue', valueColor: 'text-brand-blue' },
    { label: 'Active', value: activeSupplierCount, dot: 'bg-emerald-500', valueColor: 'text-emerald-600' },
    { label: 'Categories', value: categoryCount, dot: 'bg-violet-500', valueColor: 'text-violet-600' },
  ]

  const supplierProfile = selectedSupplier ? <><SupplierProfile supplier={selectedSupplier} orders={selectedSupplierOrders} items={selectedSupplierItems} onBack={closeSupplierProfile} onEdit={() => openEditDialog(selectedSupplier)} onOpenPurchaseOrders={openPurchaseOrders} /><SuccessToast message={toast} /></> : null
  if (supplierProfile && !isDialogOpen) return supplierProfile

  return (
    <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
      <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center" aria-label="Supplier summary">
        <div>
          <div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Supplier records</p></div>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Suppliers</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Keep supplier contacts, products, delivery details, and notes in one place.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-3 sm:gap-3">
          {stats.map((stat) => (
            <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-3 py-3.5 shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] ring-1 ring-inset ring-white/70 transition-transform duration-200 hover:-translate-y-0.5 sm:min-w-40 sm:px-4 xl:min-w-44" key={stat.label}>
              <div className="flex items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${stat.dot} ring-4 ring-white`} /><p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{stat.label}</p></div>
              <p className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${stat.valueColor}`}>{stat.value}</p>
            </article>
          ))}
        </div>
      </SummarySurface>

      <TableControls tableId="supplier-directory" storageKey="suppliers.directory" columns={[]} sortKey={supplierTable.sortKey} sortOptions={supplierSortOptions} onSortChange={supplierTable.setSortKey} page={supplierTable.page} pageCount={supplierTable.pageCount} pageSize={supplierTable.pageSize} pageSizeOptions={[12, 24, 48]} onPageChange={supplierTable.setPage} onPageSizeChange={supplierTable.setPageSize} total={supplierTable.total} />

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]" aria-labelledby="supplier-list-heading">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="min-w-52">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand-orange">Vendor network</p>
              <h3 className="mt-1 text-base font-bold tracking-[-0.02em] text-brand-blue" id="supplier-list-heading">All suppliers</h3>
            </div>
            <div className="ml-auto flex w-full flex-col gap-2 sm:flex-row xl:max-w-3xl">
              <label className="relative flex-1">
                <span className="sr-only">Search suppliers</span>
                <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
                <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-xs font-medium text-brand-blue outline-none transition placeholder:text-slate-400 focus:border-brand-blue/30 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.04]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, contact, location, or category" />
                {search ? <button className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setSearch('')} aria-label="Clear search"><Icon className="size-3" path="M18 6 6 18M6 6l12 12" /></button> : null}
              </label>
              <div className="sm:w-44"><AnimatedDropdown size="filter" value={typeFilter} options={supplierFilterOptions} onChange={setTypeFilter} ariaLabel="Filter suppliers by type" /></div>
              <button className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition-all hover:-translate-y-0.5" type="button" onClick={openAddDialog}>
                <Icon className="size-4 transition-transform group-hover:rotate-90" path="M12 5v14M5 12h14" />
                Add supplier
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-slate-400">
            <span>Showing <strong className="text-brand-blue">{visibleSuppliers.length}</strong> of {suppliers.length} suppliers</span>
            {(search || typeFilter !== 'All suppliers') ? <button className="font-bold text-brand-blue transition hover:text-brand-orange" type="button" onClick={() => { setSearch(''); setTypeFilter('All suppliers') }}>Clear filters</button> : null}
          </div>
          {storageError ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600" role="alert">{storageError}</p> : null}
        </div>

        {isLoadingSuppliers ? <RecordListSkeleton variant="cards" rows={6} /> : !hasLoadedSuppliers ? null : visibleSuppliers.length ? (
          <div className="supplier-readable-cards grid gap-4 p-4 lg:grid-cols-2 sm:p-5">
            {visibleSuppliers.map((supplier, index) => {
              const catalogUrl = getSafeUrl(supplier.catalogLink)
              return (
                <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_-26px_rgba(0,20,76,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_42px_-28px_rgba(0,20,76,0.4)] animate-[supplier-card-enter_360ms_cubic-bezier(0.22,1,0.36,1)_both] sm:p-5" style={{ animationDelay: `${Math.min(index * 45, 225)}ms` }} key={supplier.id}>
                  <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[linear-gradient(90deg,#fd4d00,#ff9567)] transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
                  <div className="flex min-w-0 items-start gap-3.5">
                    <LogoMark supplier={supplier} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <button className="group/name flex max-w-full items-center gap-1.5 text-left" type="button" onClick={() => openSupplierDetails(supplier)} aria-label={`View ${supplier.name} details`}>
                        <h4 className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-brand-blue transition group-hover/name:text-brand-orange">{supplier.name}</h4>
                        <Icon className="size-3 shrink-0 text-slate-300 opacity-0 transition group-hover/name:opacity-100" path="m9 18 6-6-6-6" />
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-lg border px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${supplierTypeTone(supplier.type)}`}>{supplier.type}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${supplier.status === 'Active' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}><span className={`size-1.5 rounded-full ${supplier.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{supplier.status}</span>
                        {supplier.tin ? <span className="truncate text-[10px] font-semibold text-slate-400" title={`TIN ${supplier.tin}`}>TIN {supplier.tin}</span> : null}
                      </div>
                    </div>
                    <button className="grid size-8 shrink-0 place-items-center rounded-xl border border-transparent text-slate-300 transition-all hover:border-slate-200 hover:bg-slate-50 hover:text-brand-blue" type="button" onClick={() => openEditDialog(supplier)} aria-label={`Edit ${supplier.name}`} title="Edit supplier"><Icon className="size-3.5" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" /></button>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-xl border border-slate-100 bg-slate-50/65 p-3 sm:grid-cols-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-brand-blue shadow-sm"><Icon className="size-3" path="M4 4h16v16H4V4Zm0 2 8 7 8-7" /></span>
                      <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[0.11em] text-slate-400">Company email</p>{supplier.companyEmail ? <a className="mt-0.5 block truncate text-[10px] font-semibold text-slate-600 transition hover:text-brand-blue" href={`mailto:${supplier.companyEmail}`} title={supplier.companyEmail}>{supplier.companyEmail}</a> : <p className="mt-0.5 text-[10px] font-medium text-slate-300">Not provided</p>}</div>
                    </div>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-brand-blue shadow-sm"><Icon className="size-3" path="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1Z" /></span>
                      <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[0.11em] text-slate-400">Company number</p>{supplier.companyPhone ? <a className="mt-0.5 block truncate text-[10px] font-semibold text-slate-600 transition hover:text-brand-blue" href={`tel:${supplier.companyPhone}`} title={supplier.companyPhone}>{supplier.companyPhone}</a> : <p className="mt-0.5 text-[10px] font-medium text-slate-300">Not provided</p>}</div>
                    </div>
                    <div className="flex min-w-0 items-center gap-2.5 sm:col-span-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-brand-orange shadow-sm"><Icon className="size-3" path="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></span>
                      <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[0.11em] text-slate-400">Address / location</p><p className={`mt-0.5 truncate text-[10px] font-semibold ${supplier.address ? 'text-slate-600' : 'text-slate-300'}`} title={supplier.address || undefined}>{supplier.address || 'Not provided'}</p></div>
                    </div>
                  </div>

                  <div className="mt-3 border-y border-slate-100 py-4">
                    <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">Contact persons</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {supplier.contacts.slice(0, 2).map((contact) => (
                        <div className="min-w-0" key={contact.id}>
                          <div className="flex items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[9px] font-extrabold text-slate-500">{supplierInitials(contact.name)}</span><p className="truncate text-xs font-bold text-slate-700" title={contact.name}>{contact.name}</p></div>
                          <div className="mt-2 space-y-1 pl-9">
                            <a className="block truncate text-[10px] font-medium text-slate-400 transition hover:text-brand-blue" href={`mailto:${contact.email}`} title={contact.email}>{contact.email}</a>
                            <a className="block truncate text-[10px] font-medium text-slate-400 transition hover:text-brand-blue" href={`tel:${contact.phone}`} title={contact.phone}>{contact.phone}</a>
                          </div>
                        </div>
                      ))}
                      {supplier.contacts.length > 2 ? <p className="self-center text-[10px] font-bold text-slate-400">+{supplier.contacts.length - 2} more contact{supplier.contacts.length > 3 ? 's' : ''}</p> : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {supplier.categories.slice(0, 5).map((category) => <span className="rounded-lg bg-blue-50/80 px-2.5 py-1.5 text-[9px] font-bold text-brand-blue" key={category}>{category}</span>)}
                    {supplier.categories.length > 5 ? <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[9px] font-bold text-slate-500">+{supplier.categories.length - 5}</span> : null}
                    {!supplier.categories.length ? <span className="text-[10px] font-medium text-slate-300">No categories added</span> : null}
                  </div>

                  {supplier.performanceNotes.length ? (
                    <div className="mt-4 rounded-xl border border-amber-100/80 bg-amber-50/60 px-3 py-2.5">
                      <div className="flex gap-2">
                        <Icon className="mt-0.5 size-3.5 shrink-0 text-amber-600" path="M12 9v4M12 17h.01M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-amber-700/70">Performance notes</p>
                          <ul className="mt-1.5 space-y-1">
                            {supplier.performanceNotes.slice(0, 2).map((note) => <li className="flex min-w-0 gap-1.5 text-[10px] font-medium leading-4 text-amber-800" key={note.id}><span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" /><span className="line-clamp-1" title={note.text}>{note.text}</span></li>)}
                          </ul>
                          {supplier.performanceNotes.length > 2 ? <p className="mt-1.5 text-[9px] font-bold text-amber-700">+{supplier.performanceNotes.length - 2} more note{supplier.performanceNotes.length > 3 ? 's' : ''}</p> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <p className="text-[9px] font-semibold text-slate-300">Updated {formatUpdatedDate(supplier.updatedAt)}</p>
                    <div className="flex items-center gap-2"><button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={() => openSupplierDetails(supplier)}><Icon className="size-3" path="m9 18 6-6-6-6" />View details</button>{catalogUrl ? <a className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-blue px-3 text-[10px] font-bold text-white shadow-[0_7px_16px_-10px_rgba(0,20,76,0.75)] transition hover:-translate-y-0.5 hover:bg-[#092968]" href={catalogUrl} target="_blank" rel="noreferrer"><Icon className="size-3" path="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />Catalog</a> : null}</div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-brand-blue shadow-[0_15px_35px_-26px_rgba(0,20,76,0.5)]"><Icon className="size-6" path={suppliers.length ? 'm21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z' : 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h6'} /></span>
              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.15em] text-brand-orange">{suppliers.length ? 'No matches' : 'Start your network'}</p>
              <h3 className="mt-2 text-lg font-bold tracking-[-0.02em] text-brand-blue">{suppliers.length ? 'No suppliers found' : 'Add your first supplier'}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{suppliers.length ? 'Try a different search or clear the filter.' : 'Save supplier contacts, products, catalogs, and notes here.'}</p>
              {suppliers.length ? <button className="mt-5 h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-500 transition hover:border-slate-300 hover:text-brand-blue" type="button" onClick={() => { setSearch(''); setTypeFilter('All suppliers') }}>Clear filters</button> : <button className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-[0_8px_20px_-12px_rgba(0,20,76,0.8)] transition hover:-translate-y-0.5" type="button" onClick={openAddDialog}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add first supplier</button>}
            </div>
          </div>
        )}
      </section>

      {selectedSupplier && !isDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm animate-[supplier-backdrop-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="supplier-details-heading">
          <button className="absolute inset-0" type="button" onClick={() => setSelectedSupplierId(null)} aria-label="Close supplier details" />
          <section className="supplier-readable-details relative my-6 w-full max-w-4xl overflow-hidden rounded-[1.6rem] border border-white/20 bg-white shadow-[0_35px_100px_rgba(0,20,76,0.34)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)]">
            <div className="relative overflow-hidden border-b border-slate-100 px-6 py-5 sm:px-7 sm:py-6">
              <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(0,20,76,0.08),transparent_68%)]" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-4"><LogoMark supplier={selectedSupplier} /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Supplier profile</p><h2 className="mt-1.5 truncate text-xl font-extrabold tracking-[-0.03em] text-brand-blue sm:text-2xl" id="supplier-details-heading">{selectedSupplier.name}</h2><div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-lg border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${supplierTypeTone(selectedSupplier.type)}`}>{selectedSupplier.type}</span><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${selectedSupplier.status === 'Active' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}><span className={`size-1.5 rounded-full ${selectedSupplier.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{selectedSupplier.status}</span></div></div></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setSelectedSupplierId(null)} aria-label="Close details"><Icon className="size-4" path="M18 6 6 18M6 6l12 12" /></button></div>
            </div>

            <div className="max-h-[calc(100svh-15rem)] overflow-y-auto px-6 py-6 sm:px-7">
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <section><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Company information</p><div className="mt-3 space-y-2.5"><div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">TIN</p><p className="mt-1 text-sm font-bold text-slate-700">{selectedSupplier.tin || 'Not provided'}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Company email</p>{selectedSupplier.companyEmail ? <a className="mt-1 block break-all text-sm font-bold text-brand-blue transition hover:text-brand-orange" href={`mailto:${selectedSupplier.companyEmail}`}>{selectedSupplier.companyEmail}</a> : <p className="mt-1 text-sm font-medium text-slate-300">Not provided</p>}</div><div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Company number</p>{selectedSupplier.companyPhone ? <a className="mt-1 block text-sm font-bold text-brand-blue transition hover:text-brand-orange" href={`tel:${selectedSupplier.companyPhone}`}>{selectedSupplier.companyPhone}</a> : <p className="mt-1 text-sm font-medium text-slate-300">Not provided</p>}</div><div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Address / location</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{selectedSupplier.address || 'Not provided'}</p></div></div></section>
                <section className="space-y-6"><div><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Contact persons</p><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{selectedSupplier.contacts.length}</span></div><div className="mt-3 space-y-2">{selectedSupplier.contacts.length ? selectedSupplier.contacts.map((contact) => <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3" key={contact.id}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-blue text-[10px] font-bold text-white">{supplierInitials(contact.name)}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{contact.name || 'Unnamed contact'}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">{contact.email ? <a className="truncate hover:text-brand-blue" href={`mailto:${contact.email}`}>{contact.email}</a> : null}{contact.phone ? <a className="hover:text-brand-blue" href={`tel:${contact.phone}`}>{contact.phone}</a> : null}</div></div></div>) : <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-400">No contact persons added.</p>}</div></div><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Supply categories</p><div className="mt-3 flex flex-wrap gap-1.5">{selectedSupplier.categories.length ? selectedSupplier.categories.map((category) => <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-brand-blue" key={category}>{category}</span>) : <p className="text-xs text-slate-400">No categories added.</p>}</div></div><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Performance notes</p>{selectedSupplier.performanceNotes.length ? <ul className="mt-3 space-y-2">{selectedSupplier.performanceNotes.map((note) => <li className="flex gap-2.5 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-3 text-xs leading-5 text-amber-900" key={note.id}><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />{note.text}</li>)}</ul> : <p className="mt-3 text-xs text-slate-400">No performance notes added.</p>}</div></section>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div className="text-[10px] font-medium text-slate-400"><p>Created {formatUpdatedDate(selectedSupplier.createdAt)}</p><p className="mt-1">Last updated {formatUpdatedDate(selectedSupplier.updatedAt)}</p></div><div className="flex gap-2"><a className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-brand-blue transition hover:border-brand-blue/20 hover:bg-blue-50" href={getSafeUrl(selectedSupplier.catalogLink) ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!getSafeUrl(selectedSupplier.catalogLink)} onClick={(event) => { if (!getSafeUrl(selectedSupplier.catalogLink)) event.preventDefault() }}><Icon className="size-3.5" path="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />{getSafeUrl(selectedSupplier.catalogLink) ? 'Open catalog' : 'No catalog'}</a><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="button" onClick={() => { setSelectedSupplierId(null); openEditDialog(selectedSupplier) }}><Icon className="size-3.5" path="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" />Edit supplier</button></div></div>
          </section>
        </div>
      ) : null}

      {isDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm animate-[supplier-backdrop-enter_180ms_ease-out] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="supplier-form-heading">
          <button className="absolute inset-0" type="button" onClick={closeDialog} aria-label="Close supplier form" />
          <form className="relative my-auto flex max-h-[calc(100svh-1.5rem)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-[1.6rem] border border-white/20 bg-white shadow-[0_35px_100px_rgba(0,20,76,0.34)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)] sm:max-h-[calc(100svh-2.5rem)]" onSubmit={saveSupplier}>
            <div className="relative flex shrink-0 items-start justify-between gap-4 overflow-hidden border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
              <div className="pointer-events-none absolute right-0 top-0 h-full w-64 bg-[radial-gradient(circle_at_100%_0%,rgba(0,20,76,0.06),transparent_65%)]" aria-hidden="true" />
              <div className="relative">
                <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-brand-orange">{isEditing ? 'Supplier details' : 'New supplier'}</p>
                <h2 className="mt-1.5 text-xl font-extrabold tracking-[-0.03em] text-brand-blue" id="supplier-form-heading">{isEditing ? 'Edit supplier' : 'Add a supplier'}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">Add the contact, product, and delivery details your team needs.</p>
              </div>
              <button className="relative grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={closeDialog} aria-label="Close dialog"><Icon path="M18 6 6 18M6 6l12 12" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <FormErrorSummary message={formError} className="mb-5" />
              <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
                <aside>
                  <p className={labelClassName}>Supplier logo <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></p>
                  <button className="group relative flex aspect-square w-full max-w-56 flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center transition-all hover:border-brand-blue/30 hover:bg-blue-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue" type="button" onClick={() => logoInputRef.current?.click()}>
                    {draft.logo ? <><PrivateImage className="max-h-28 max-w-[80%] object-contain transition-transform duration-300 group-hover:scale-105" target="suppliers" objectPath={draft.logo} alt="Supplier logo preview" /><span className="mt-4 text-[10px] font-bold text-brand-blue">Replace logo</span></> : <><span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-blue shadow-[0_8px_22px_-16px_rgba(0,20,76,0.55)]"><Icon className="size-5" path="M4 16v4h16v-4M12 3v13M7 8l5-5 5 5" /></span><span className="mt-4 text-xs font-bold text-brand-blue">Upload company logo</span><span className="mt-1 text-[9px] leading-4 text-slate-400">PNG, JPG, or WebP<br />up to 5 MB</span></>}
                    {isProcessingLogo ? <span className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-sm"><span className="size-6 animate-spin rounded-full border-2 border-brand-blue/15 border-t-brand-blue" /></span> : null}
                  </button>
                  <input className="hidden" ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleLogoChange(event)} />
                  <button className="mt-4 h-9 w-full max-w-56 rounded-xl border border-slate-200 bg-white text-[10px] font-bold text-brand-blue transition hover:border-brand-blue/20" type="button" onClick={() => logoInputRef.current?.click()} disabled={isProcessingLogo}>{isProcessingLogo ? 'Preparing...' : draft.logo ? 'Replace logo' : 'Upload logo'}</button>
                  {draft.logo ? <button className="mt-2 w-full max-w-56 rounded-lg py-2 text-[10px] font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600" type="button" onClick={() => setDraft((current) => ({ ...current, logo: '' }))}>Remove logo</button> : null}
                  {logoError ? <p className="mt-2 max-w-56 text-[10px] font-semibold leading-4 text-red-600" role="alert">{logoError}</p> : null}
                </aside>

                <div className="min-w-0 space-y-6">
                  <section>
                    <div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Icon className="size-3.5" path="M3 21h18M5 21V7l7-4 7 4v14M9 11h6M9 15h6" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Business profile</h3><p className="text-[10px] text-slate-400">Core company and tax information</p></div></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2"><label className={labelClassName} htmlFor="supplier-name">Supplier name</label><input className={fieldClassName} id="supplier-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Northstar Industrial Supply" autoFocus required /></div>
                      <div><label className={labelClassName} htmlFor="supplier-type">Supplier type</label><AnimatedDropdown id="supplier-type" value={draft.type} options={supplierTypeOptions} onChange={(type) => setDraft((current) => ({ ...current, type }))} ariaLabel="Supplier type" /></div>
                      <div><label className={labelClassName} htmlFor="supplier-status">Supplier status</label><AnimatedDropdown id="supplier-status" value={draft.status} options={supplierStatusOptions} onChange={(status) => setDraft((current) => ({ ...current, status }))} ariaLabel="Supplier status" /></div>
                      <div><label className={labelClassName} htmlFor="supplier-tin">TIN #</label><input className={fieldClassName} id="supplier-tin" value={draft.tin} onChange={(event) => setDraft((current) => ({ ...current, tin: event.target.value }))} placeholder="000-000-000-000" inputMode="numeric" required /></div>
                      <div><label className={labelClassName} htmlFor="supplier-company-phone">Company contact number</label><input className={fieldClassName} id="supplier-company-phone" type="tel" value={draft.companyPhone} onChange={(event) => setDraft((current) => ({ ...current, companyPhone: event.target.value }))} placeholder="+63 2 8000 0000" required /></div>
                      <div className="sm:col-span-2"><label className={labelClassName} htmlFor="supplier-company-email">Company email</label><input className={fieldClassName} id="supplier-company-email" type="email" value={draft.companyEmail} onChange={(event) => setDraft((current) => ({ ...current, companyEmail: event.target.value }))} placeholder="sales@company.com" required /></div>
                      <div className="sm:col-span-2"><label className={labelClassName} htmlFor="supplier-address">Address / location <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"><Icon className="size-4" path="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></span><input className={`${fieldClassName} pl-10`} id="supplier-address" value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} placeholder="Street, city, province, postal code" autoComplete="street-address" /></div></div>
                      <div className="sm:col-span-2">
                        <label className={labelClassName} htmlFor="supplier-category">Supply categories</label>
                        <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 pl-2.5 transition focus-within:border-brand-blue/40 focus-within:ring-4 focus-within:ring-brand-blue/[0.05]">
                          {draft.categories.map((category) => <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 text-[10px] font-bold text-brand-blue animate-[supplier-chip-enter_160ms_ease-out]" key={category}>{category}<button className="text-brand-blue/35 transition hover:text-red-500" type="button" onClick={() => setDraft((current) => ({ ...current, categories: current.categories.filter((item) => item !== category) }))} aria-label={`Remove ${category}`}><Icon className="size-2.5" path="M18 6 6 18M6 6l12 12" /></button></span>)}
                          <input className="h-7 min-w-32 flex-1 border-0 bg-transparent px-1 text-xs font-medium text-brand-blue outline-none placeholder:text-slate-300" id="supplier-category" value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)} onKeyDown={handleCategoryKeyDown} onBlur={() => addCategory()} placeholder={draft.categories.length ? 'Add another...' : 'Type a category and press Enter'} />
                          {categoryInput.trim() ? <button className="h-7 rounded-lg bg-brand-blue px-2.5 text-[9px] font-bold text-white" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addCategory()}>Add</button> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">{categorySuggestions.filter((category) => !draft.categories.some((item) => item.toLowerCase() === category.toLowerCase())).slice(0, 5).map((category) => <button className="rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-400 transition hover:border-brand-blue/20 hover:bg-blue-50 hover:text-brand-blue" type="button" key={category} onClick={() => addCategory(category)}>+ {category}</button>)}</div>
                      </div>
                    </div>
                  </section>

                  <section className="border-t border-slate-100 pt-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-orange-50 text-brand-orange"><Icon className="size-3.5" path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Contact persons</h3><p className="text-[10px] text-slate-400">Add the people your team coordinates with</p></div></div>
                      <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[9px] font-bold text-brand-blue transition hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={addContact}><Icon className="size-3" path="M12 5v14M5 12h14" />Add person</button>
                    </div>
                    <div className="space-y-3">
                      {draft.contacts.map((contact, index) => (
                        <div className="relative grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/55 p-3 animate-[supplier-card-enter_220ms_ease-out] sm:grid-cols-3" key={contact.id}>
                          <div><label className={labelClassName} htmlFor={`contact-name-${contact.id}`}>Name {index + 1}</label><input className={fieldClassName} id={`contact-name-${contact.id}`} value={contact.name} onChange={(event) => updateContact(contact.id, 'name', event.target.value)} placeholder="Contact person" required /></div>
                          <div><label className={labelClassName} htmlFor={`contact-email-${contact.id}`}>Email</label><input className={fieldClassName} id={`contact-email-${contact.id}`} type="email" value={contact.email} onChange={(event) => updateContact(contact.id, 'email', event.target.value)} placeholder="name@company.com" required /></div>
                          <div><label className={labelClassName} htmlFor={`contact-phone-${contact.id}`}>Contact number</label><input className={`${fieldClassName} pr-10`} id={`contact-phone-${contact.id}`} type="tel" value={contact.phone} onChange={(event) => updateContact(contact.id, 'phone', event.target.value)} placeholder="+63 917 000 0000" required /></div>
                          {draft.contacts.length > 1 ? <button className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600 sm:right-5 sm:top-[3.1rem]" type="button" onClick={() => removeContact(contact.id)} aria-label={`Remove contact ${index + 1}`}><Icon className="size-3" path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></button> : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="border-t border-slate-100 pt-5">
                    <div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon className="size-3.5" path="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Files and notes</h3><p className="text-[10px] text-slate-400">Supplier catalog, website, and notes for your team</p></div></div>
                    <div className="space-y-4">
                      <div><label className={labelClassName} htmlFor="supplier-catalog">Catalog link <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><div className="relative"><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" path="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" /><input className={`${fieldClassName} pl-10`} id="supplier-catalog" type="url" value={draft.catalogLink} onChange={(event) => setDraft((current) => ({ ...current, catalogLink: event.target.value }))} placeholder="https://supplier.com/catalog" /></div></div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Supplier performance notes <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></p>
                          <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[9px] font-bold text-brand-blue transition hover:border-brand-blue/20 hover:bg-blue-50" type="button" onClick={addPerformanceNote}><Icon className="size-3" path="M12 5v14M5 12h14" />Add note</button>
                        </div>
                        {draft.performanceNotes.length ? (
                          <div className="space-y-2.5">
                            {draft.performanceNotes.map((note, index) => (
                              <div className="relative rounded-xl border border-slate-200 bg-slate-50/55 p-3 pr-11 animate-[supplier-card-enter_220ms_ease-out]" key={note.id}>
                                <label className={labelClassName} htmlFor={`supplier-note-${note.id}`}>Note {index + 1}</label>
                                <textarea className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium leading-6 text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id={`supplier-note-${note.id}`} value={note.text} onChange={(event) => updatePerformanceNote(note.id, event.target.value)} placeholder="e.g. Delivery usually takes 2–3 days longer than quoted." />
                                <button className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600" type="button" onClick={() => removePerformanceNote(note.id)} aria-label={`Remove performance note ${index + 1}`}><Icon className="size-3" path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <button className="flex h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-400 transition hover:border-brand-blue/20 hover:bg-blue-50/30 hover:text-brand-blue" type="button" onClick={addPerformanceNote}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add a performance note</button>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:px-6">
              {isConfirmingDelete ? (
                <div className="flex flex-col gap-3 animate-[supplier-chip-enter_160ms_ease-out] sm:flex-row sm:items-center">
                  <p className="mr-auto text-xs font-semibold text-red-700">Remove this supplier permanently?</p>
                  <button className="h-9 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-white" type="button" onClick={() => setIsConfirmingDelete(false)}>Keep supplier</button>
                  <button className="h-9 rounded-xl bg-red-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-red-700" type="button" onClick={deleteSupplier}>Archive</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isEditing ? <button className="mr-auto h-9 rounded-xl px-3 text-[10px] font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600" type="button" onClick={() => setIsConfirmingDelete(true)}>Archive supplier</button> : <span className="mr-auto hidden text-[9px] font-semibold text-slate-300 sm:block">Fields marked by the browser are required</span>}
                  <button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={closeDialog}>Cancel</button>
                  <button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.75)] transition hover:-translate-y-0.5 disabled:opacity-50" type="submit" disabled={isProcessingLogo}>{isEditing ? 'Save changes' : 'Add supplier'}</button>
                </div>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {isDialogOpen ? <DocumentFormScaffold dialogTitleId="supplier-form-heading" breakdown={[{ label: 'Contacts', value: String(draft.contacts.length) }, { label: 'Categories', value: String(draft.categories.length) }]} totalLabel={isEditing ? 'Editing' : 'Creating'} totalValue={draft.name.trim() || 'New supplier'} helperText={isConfirmingDelete ? 'Archiving removes this supplier from the active directory.' : 'Supplier details, contacts, categories, and notes are saved together.'} backLabel={selectedSupplierId ? 'Back to supplier' : 'Back to suppliers'} onCancel={closeDialog} actions={supplierFormActions} containedScroll /> : null}

      {logoToCrop ? <SquareImageCropper file={logoToCrop} label="Supplier logo" onCancel={() => setLogoToCrop(null)} onConfirm={applyCroppedLogo} /> : null}
      <SuccessToast message={toast} />
    </div>
  )
}

function toSupplier(value: ApiSupplier): Supplier {
  return { ...value, catalogLink: value.catalogUrl }
}
