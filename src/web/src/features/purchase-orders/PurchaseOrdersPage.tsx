import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatedDatePicker } from '../../components/ui/AnimatedDatePicker'
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown'
import { SuccessToast } from '../../components/ui/SuccessToast'
import { SummarySurface } from '../../components/ui/SummarySurface'
import { TableControls, useTableView } from '../../components/ui/TableControls'
import { usePersistentState } from '../../components/ui/usePersistentState'
import { appendSystemLog } from '../../services/activityLog'
import { loadDocumentDefaults } from '../settings/settingsStorage'
import { PurchaseOrderClientPickerDialog } from './PurchaseOrderClientPickerDialog'
import { PurchaseOrderDocumentDialog } from './PurchaseOrderDocumentDialog'
import { QuickAddSupplierDialog, type QuickSupplierInput } from './QuickAddSupplierDialog'

type PurchaseOrderStatus = 'Delivered' | 'For Payment' | 'Waiting for Delivery' | 'Cancelled' | 'Sent' | 'Not yet sent'

type SupplierContact = { id: string; name: string; email: string; phone: string }
type Supplier = { id: string; name: string; status: string; address: string; companyEmail: string; companyPhone: string; contacts: SupplierContact[] }
type Client = { id: string; name: string; status: string; address: string; industry: string; contactPerson: string; email: string; phone: string }
type ApprovedQuotationOption = { id: string; quotationNumber: string; clientId: string; clientName: string; subject: string; projectLocation: string; status: string }
type CatalogVariant = { id: string; name: string; value: string; photo: string; productCode: string; unitOfMeasure: string; status: string; rawCost: number; sellingPrice: number }
type CatalogItem = { id: string; photo: string; name: string; category: string; brand: string; unitOfMeasure: string; productCode: string; supplierId: string; rawCost: number; variants: CatalogVariant[]; status: string }

type PurchaseOrderLine = {
  id: string
  itemId: string
  variantId: string
  photo: string
  itemName: string
  variantLabel: string
  productCode: string
  unitOfMeasure: string
  quantity: number
  unitCost: number
}

type PurchaseOrderCharge = {
  id: string
  label: string
  amount: number
}

type PurchaseOrder = {
  id: string
  date: string
  poNumber: string
  clientId: string
  clientName: string
  supplierId: string
  supplierName: string
  contactPerson: string
  subject: string
  quotationId: string
  quotationNumber: string
  modeOfPayment: string
  paymentTerm: string
  deliveryLocation: string
  modeOfDelivery: string
  notes: string
  terms: string
  items: PurchaseOrderLine[]
  subtotalAmount: number
  vatEnabled: boolean
  vatAmount: number
  otherCharges: PurchaseOrderCharge[]
  totalAmount: number
  status: PurchaseOrderStatus
  addedToExpenses: boolean
  createdAt: string
  updatedAt: string
}

type LineDraft = Omit<PurchaseOrderLine, 'quantity' | 'unitCost'> & { quantity: string; unitCost: string }
type ChargeDraft = Omit<PurchaseOrderCharge, 'amount'> & { amount: string }
type PurchaseOrderDraft = Omit<PurchaseOrder, 'id' | 'supplierName' | 'items' | 'subtotalAmount' | 'vatAmount' | 'otherCharges' | 'totalAmount' | 'addedToExpenses' | 'createdAt' | 'updatedAt'> & { items: LineDraft[]; otherCharges: ChargeDraft[] }
type PurchaseOrdersPageProps = { currentUsername: string }

const storageKey = 'adiel.purchase-orders'
const supplierStorageKey = 'adiel.suppliers'
const clientStorageKey = 'adiel.clients'
const itemStorageKey = 'adiel.items'
const expenseStorageKey = 'adiel.expenses'
const quotationStorageKey = 'adiel.quotations'
const addSupplierOptionValue = '__add_supplier__'
const purchaseOrderStatuses: PurchaseOrderStatus[] = ['Delivered', 'For Payment', 'Waiting for Delivery', 'Cancelled', 'Sent', 'Not yet sent']
const statusOptions: { value: PurchaseOrderStatus }[] = purchaseOrderStatuses.map((value) => ({ value }))
const statusFilterOptions: { value: 'All statuses' | PurchaseOrderStatus }[] = [{ value: 'All statuses' }, ...statusOptions]
const paymentOptions = ['Bank transfer', 'Cash', 'Cheque', 'GCash', 'Credit card'].map((value) => ({ value }))
const paymentTermOptions = ['Due on receipt', '7 days', '15 days', '30 days', '45 days', '60 days'].map((value) => ({ value }))
const deliveryModeOptions = ['Supplier delivery', 'Pickup', 'Courier', 'Freight'].map((value) => ({ value }))
const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]'
const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500'

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function ProductPhoto({ photo, name, className = 'size-11 rounded-xl' }: { photo: string; name: string; className?: string }) {
  return photo ? <span className={`${className} grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-white shadow-sm`}><img className="size-full object-contain p-1" src={photo} alt={name} /></span> : <span className={`${className} grid shrink-0 place-items-center bg-[linear-gradient(145deg,#eef3fb,#e2e9f5)] text-brand-blue`}><Icon className="size-4" path="M4 5h16v14H4V5Zm0 10 4-4 4 4 2-2 6 6M16 9h.01" /></span>
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function supplierInitials(name: string) {
  const initials = name.split(/\s+/).map((part) => part.replace(/[^a-z0-9]/gi, '')[0]).filter(Boolean).join('').toUpperCase()
  return initials.slice(0, 4) || 'SUP'
}

function loadSuppliers(): Supplier[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(supplierStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const supplier = value as Partial<Supplier>
      if (typeof supplier.id !== 'string' || typeof supplier.name !== 'string') return []
      const contacts = Array.isArray(supplier.contacts) ? supplier.contacts.filter((contact): contact is SupplierContact => typeof contact?.id === 'string' && typeof contact.name === 'string' && typeof contact.email === 'string' && typeof contact.phone === 'string') : []
      return [{ id: supplier.id, name: supplier.name, status: typeof supplier.status === 'string' ? supplier.status : 'Active', address: typeof supplier.address === 'string' ? supplier.address : '', companyEmail: typeof supplier.companyEmail === 'string' ? supplier.companyEmail : '', companyPhone: typeof supplier.companyPhone === 'string' ? supplier.companyPhone : '', contacts }]
    }).sort((left, right) => left.name.localeCompare(right.name))
  } catch { return [] }
}

function loadClients(): Client[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(clientStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const client = value as Partial<Client>
      if (typeof client.id !== 'string' || typeof client.name !== 'string') return []
      return [{ id: client.id, name: client.name, status: typeof client.status === 'string' ? client.status : 'Active', address: typeof client.address === 'string' ? client.address : '', industry: typeof client.industry === 'string' ? client.industry : '', contactPerson: typeof client.contactPerson === 'string' ? client.contactPerson : '', email: typeof client.email === 'string' ? client.email : '', phone: typeof client.phone === 'string' ? client.phone : '' }]
    }).sort((left, right) => left.name.localeCompare(right.name))
  } catch { return [] }
}

function loadCatalogItems(): CatalogItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(itemStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const item = value as Partial<CatalogItem>
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.supplierId !== 'string') return []
      const variants = Array.isArray(item.variants) ? item.variants.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const variant = entry as Partial<CatalogVariant>
        if (typeof variant.id !== 'string' || typeof variant.name !== 'string' || typeof variant.value !== 'string') return []
        return [{ id: variant.id, name: variant.name, value: variant.value, photo: typeof variant.photo === 'string' ? variant.photo : '', productCode: typeof variant.productCode === 'string' ? variant.productCode : typeof item.productCode === 'string' ? item.productCode : '', unitOfMeasure: typeof variant.unitOfMeasure === 'string' ? variant.unitOfMeasure : typeof item.unitOfMeasure === 'string' ? item.unitOfMeasure : 'Piece', status: typeof variant.status === 'string' ? variant.status : 'Active', rawCost: typeof variant.rawCost === 'number' ? variant.rawCost : 0, sellingPrice: typeof variant.sellingPrice === 'number' ? variant.sellingPrice : 0 }]
      }) : []
      return [{ id: item.id, photo: typeof item.photo === 'string' ? item.photo : '', name: item.name, category: typeof item.category === 'string' ? item.category : '', brand: typeof item.brand === 'string' ? item.brand : '', unitOfMeasure: typeof item.unitOfMeasure === 'string' ? item.unitOfMeasure : 'Piece', productCode: typeof item.productCode === 'string' ? item.productCode : '', supplierId: item.supplierId, rawCost: typeof item.rawCost === 'number' ? item.rawCost : 0, variants: variants.filter((variant) => variant.status === 'Active'), status: typeof item.status === 'string' ? item.status : 'Active' }]
    })
  } catch { return [] }
}

function loadApprovedQuotations(): ApprovedQuotationOption[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(quotationStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const quotation = value as Partial<ApprovedQuotationOption>
      if (quotation.status !== 'Approved' || typeof quotation.id !== 'string' || typeof quotation.quotationNumber !== 'string') return []
      return [{ id: quotation.id, quotationNumber: quotation.quotationNumber, clientId: typeof quotation.clientId === 'string' ? quotation.clientId : '', clientName: typeof quotation.clientName === 'string' ? quotation.clientName : '', subject: typeof quotation.subject === 'string' ? quotation.subject : '', projectLocation: typeof quotation.projectLocation === 'string' ? quotation.projectLocation : '', status: quotation.status }]
    }).sort((left, right) => right.quotationNumber.localeCompare(left.quotationNumber))
  } catch { return [] }
}

function loadPurchaseOrders(): PurchaseOrder[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const order = value as Partial<PurchaseOrder>
      if (typeof order.id !== 'string' || typeof order.poNumber !== 'string' || !Array.isArray(order.items)) return []
      const items = order.items.map((line) => ({ ...line, photo: typeof line.photo === 'string' ? line.photo : '' }))
      const subtotalAmount = typeof order.subtotalAmount === 'number' ? order.subtotalAmount : items.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0)
      const vatEnabled = order.vatEnabled === true
      const vatAmount = typeof order.vatAmount === 'number' ? order.vatAmount : vatEnabled ? subtotalAmount * 0.12 : 0
      const otherCharges = Array.isArray(order.otherCharges) ? order.otherCharges.filter((charge): charge is PurchaseOrderCharge => typeof charge?.id === 'string' && typeof charge.label === 'string' && typeof charge.amount === 'number') : []
      const totalAmount = typeof order.totalAmount === 'number' ? order.totalAmount : subtotalAmount + vatAmount + otherCharges.reduce((total, charge) => total + charge.amount, 0)
      return [{ ...(order as PurchaseOrder), clientId: typeof order.clientId === 'string' ? order.clientId : '', quotationId: typeof order.quotationId === 'string' ? order.quotationId : '', quotationNumber: typeof order.quotationNumber === 'string' ? order.quotationNumber : '', notes: typeof order.notes === 'string' ? order.notes : '', terms: typeof order.terms === 'string' && order.terms.trim() ? order.terms : loadDocumentDefaults().purchaseOrderTerms, items, subtotalAmount, vatEnabled, vatAmount, otherCharges, totalAmount }]
    })
  } catch { return [] }
}

function emptyDraft(): PurchaseOrderDraft {
  return { date: new Date().toISOString().slice(0, 10), poNumber: '', clientId: '', clientName: '', supplierId: '', contactPerson: '', subject: '', quotationId: '', quotationNumber: '', modeOfPayment: 'Bank transfer', paymentTerm: '30 days', deliveryLocation: '', modeOfDelivery: 'Supplier delivery', notes: '', terms: loadDocumentDefaults().purchaseOrderTerms, items: [], vatEnabled: false, otherCharges: [], status: 'Not yet sent' }
}

function statusTone(status: PurchaseOrderStatus) {
  if (status === 'Delivered') return 'bg-emerald-50 text-emerald-700'
  if (status === 'For Payment') return 'bg-amber-50 text-amber-700'
  if (status === 'Waiting for Delivery') return 'bg-sky-50 text-sky-700'
  if (status === 'Cancelled') return 'bg-red-50 text-red-600'
  if (status === 'Sent') return 'bg-violet-50 text-violet-700'
  return 'bg-slate-100 text-slate-600'
}

export function PurchaseOrdersPage({ currentUsername }: PurchaseOrdersPageProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(loadPurchaseOrders)
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers)
  const [clients, setClients] = useState<Client[]>(loadClients)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(loadCatalogItems)
  const [approvedQuotations, setApprovedQuotations] = useState<ApprovedQuotationOption[]>(loadApprovedQuotations)
  const [search, setSearch] = usePersistentState('purchase-orders.search', '')
  const [statusFilter, setStatusFilter] = usePersistentState<'All statuses' | PurchaseOrderStatus>('purchase-orders.status', 'All statuses')
  const openNewOnLoad = new URLSearchParams(window.location.search).get('new') === '1'
  const initialSupplier = suppliers.find((entry) => entry.status === 'Active') ?? suppliers[0]
  const initialClient = clients.find((entry) => entry.status === 'Active') ?? clients[0]
  const [draft, setDraft] = useState<PurchaseOrderDraft>(() => {
    const values = emptyDraft()
    if (!openNewOnLoad) return values
    if (initialClient) {
      values.clientId = initialClient.id
      values.clientName = initialClient.name
    }
    if (initialSupplier) {
      values.supplierId = initialSupplier.id
      values.contactPerson = initialSupplier.contacts[0]?.name ?? ''
      values.deliveryLocation = initialSupplier.address
      const year = values.date.slice(0, 4) || String(new Date().getFullYear())
      const prefix = `${supplierInitials(initialSupplier.name)}-PO-${year}-`
      const highest = orders.filter((order) => order.poNumber.startsWith(prefix)).reduce((maximum, order) => Math.max(maximum, Number(order.poNumber.slice(prefix.length)) || 0), 0)
      values.poNumber = `${prefix}${String(highest + 1).padStart(3, '0')}`
    }
    return values
  })
  const [isFormOpen, setIsFormOpen] = useState(openNewOnLoad)
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false)
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false)
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(openNewOnLoad && !initialClient)
  const [isProjectLinkOpen, setIsProjectLinkOpen] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [formError, setFormError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (openNewOnLoad) window.history.replaceState(null, '', window.location.pathname)
  }, [openNewOnLoad])

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(orders)); setStorageError('') }
    catch { setStorageError('Purchase orders could not be saved in browser storage.') }
  }, [orders])

  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === supplierStorageKey) setSuppliers(loadSuppliers())
      if (event.key === clientStorageKey) setClients(loadClients())
      if (event.key === itemStorageKey) setCatalogItems(loadCatalogItems())
      if (event.key === quotationStorageKey) setApprovedQuotations(loadApprovedQuotations())
    }
    const refreshOnNavigate = () => setApprovedQuotations(loadApprovedQuotations())
    window.addEventListener('storage', refresh)
    window.addEventListener('adiel:navigate', refreshOnNavigate)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('adiel:navigate', refreshOnNavigate) }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!isFormOpen && !selectedOrderId && !isDocumentDialogOpen && !isClientPickerOpen) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [isClientPickerOpen, isDocumentDialogOpen, isFormOpen, selectedOrderId])

  useEffect(() => {
    if (!isFormOpen) return
    const clientField = document.querySelector<HTMLInputElement>('#po-client')
    if (!clientField) return
    const openClientPicker = () => setIsClientPickerOpen(true)
    clientField.readOnly = true
    clientField.setAttribute('aria-haspopup', 'dialog')
    clientField.setAttribute('aria-expanded', String(isClientPickerOpen))
    clientField.title = 'Choose a client from the Client Directory'
    clientField.style.cursor = 'pointer'
    clientField.addEventListener('click', openClientPicker)
    clientField.addEventListener('focus', openClientPicker)
    return () => {
      clientField.removeEventListener('click', openClientPicker)
      clientField.removeEventListener('focus', openClientPicker)
    }
  }, [isClientPickerOpen, isFormOpen])

  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers])
  const selectedSupplier = supplierMap.get(draft.supplierId)
  const supplierItems = useMemo(() => catalogItems.filter((item) => item.supplierId === draft.supplierId && item.status !== 'Discontinued'), [catalogItems, draft.supplierId])
  const visibleSupplierItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase()
    return supplierItems.filter((item) => !query || [item.name, item.productCode, item.brand, item.category].some((value) => value.toLowerCase().includes(query)))
  }, [itemSearch, supplierItems])
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) : undefined
  const selectedOrderSupplier = selectedOrder ? supplierMap.get(selectedOrder.supplierId) : undefined
  const selectedOrderContact = selectedOrderSupplier?.contacts.find((contact) => contact.name === selectedOrder?.contactPerson) ?? selectedOrderSupplier?.contacts[0]
  const selectedOrderQuotationOptions = [{ value: '', label: 'General purchase / no quotation' }, ...approvedQuotations.filter((quotation) => quotation.clientId === selectedOrder?.clientId).map((quotation) => ({ value: quotation.id, label: `${quotation.quotationNumber}${quotation.subject ? ` · ${quotation.subject}` : ''}` }))]
  const draftSubtotal = draft.items.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0)
  const draftVatAmount = draft.vatEnabled ? draftSubtotal * 0.12 : 0
  const draftOtherChargesTotal = draft.otherCharges.reduce((total, charge) => total + (Number(charge.amount) || 0), 0)
  const draftTotal = draftSubtotal + draftVatAmount + draftOtherChargesTotal
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orders.filter((order) => (!query || [order.poNumber, order.clientName, order.supplierName, order.subject, ...order.items.map((item) => item.itemName)].some((value) => value.toLowerCase().includes(query))) && (statusFilter === 'All statuses' || order.status === statusFilter)).sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
  }, [orders, search, statusFilter])
  const orderSortOptions = [
    { value: 'newest', label: 'Newest first', getValue: (order: PurchaseOrder) => order.date, direction: 'desc' as const },
    { value: 'oldest', label: 'Oldest first', getValue: (order: PurchaseOrder) => order.date, direction: 'asc' as const },
    { value: 'highest', label: 'Highest amount', getValue: (order: PurchaseOrder) => order.totalAmount, direction: 'desc' as const },
    { value: 'supplier', label: 'Supplier A–Z', getValue: (order: PurchaseOrder) => order.supplierName, direction: 'asc' as const },
    { value: 'status', label: 'Status A–Z', getValue: (order: PurchaseOrder) => order.status, direction: 'asc' as const },
  ]
  const orderTable = useTableView({ rows: filteredOrders, storageKey: 'purchase-orders.table', sortOptions: orderSortOptions })
  const visibleOrders = orderTable.pageRows

  const supplierOptions = [{ value: '', label: suppliers.length ? 'Select a supplier' : 'Select or add a supplier' }, ...suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.name}${supplier.status === 'Inactive' ? ' (Inactive)' : ''}` })), { value: addSupplierOptionValue, label: '+ Add new supplier', dotClassName: 'bg-brand-orange' }]
  const contactOptions = selectedSupplier?.contacts.length ? selectedSupplier.contacts.map((contact) => ({ value: contact.name, label: `${contact.name}${contact.phone ? ` · ${contact.phone}` : ''}` })) : [{ value: '', label: 'No contacts available' }]

  function makePoNumber(supplier: Supplier, date: string) {
    const year = date.slice(0, 4) || String(new Date().getFullYear())
    const prefix = `${supplierInitials(supplier.name)}-PO-${year}-`
    const highest = orders.filter((order) => order.poNumber.startsWith(prefix)).reduce((max, order) => Math.max(max, Number(order.poNumber.slice(prefix.length)) || 0), 0)
    return `${prefix}${String(highest + 1).padStart(3, '0')}`
  }

  function openForm() {
    const supplier = suppliers.find((entry) => entry.status === 'Active') ?? suppliers[0]
    const client = clients.find((entry) => entry.status === 'Active') ?? clients[0]
    const values = emptyDraft()
    if (client) {
      values.clientId = client.id
      values.clientName = client.name
    }
    if (supplier) {
      values.supplierId = supplier.id
      values.contactPerson = supplier.contacts[0]?.name ?? ''
      values.deliveryLocation = supplier.address
      values.poNumber = makePoNumber(supplier, values.date)
    }
    setEditingOrderId(null)
    setIsItemPickerOpen(false)
    setItemSearch('')
    setDraft(values)
    setFormError('')
    setIsFormOpen(true)
    setIsClientPickerOpen(!client)
  }

  function openEditForm(order: PurchaseOrder) {
    setEditingOrderId(order.id)
    setDraft({
      date: order.date,
      poNumber: order.poNumber,
      clientId: order.clientId || clients.find((client) => client.name.toLowerCase() === order.clientName.toLowerCase())?.id || '',
      clientName: order.clientName,
      supplierId: order.supplierId,
      contactPerson: order.contactPerson,
      subject: order.subject,
      quotationId: order.quotationId,
      quotationNumber: order.quotationNumber,
      modeOfPayment: order.modeOfPayment,
      paymentTerm: order.paymentTerm,
      deliveryLocation: order.deliveryLocation,
      modeOfDelivery: order.modeOfDelivery,
      notes: order.notes,
      terms: order.terms,
      items: order.items.map((line) => ({ ...line, quantity: String(line.quantity), unitCost: String(line.unitCost) })),
      vatEnabled: order.vatEnabled,
      otherCharges: order.otherCharges.map((charge) => ({ ...charge, amount: String(charge.amount) })),
      status: order.status,
    })
    setSelectedOrderId(null)
    setIsConfirmingDelete(false)
    setIsItemPickerOpen(false)
    setItemSearch('')
    setFormError('')
    setIsClientPickerOpen(false)
    setIsFormOpen(true)
  }

  function selectSupplier(supplierId: string) {
    if (supplierId === addSupplierOptionValue) {
      setIsQuickSupplierOpen(true)
      return
    }
    const supplier = supplierMap.get(supplierId)
    setDraft((current) => ({ ...current, supplierId, contactPerson: supplier?.contacts[0]?.name ?? '', deliveryLocation: supplier?.address || current.deliveryLocation, poNumber: editingOrderId ? current.poNumber : supplier ? makePoNumber(supplier, current.date) : '', items: [] }))
    setIsItemPickerOpen(false)
    setItemSearch('')
  }

  function selectClient(clientId: string) {
    const client = clients.find((entry) => entry.id === clientId)
    if (!client) return
    setDraft((current) => ({ ...current, clientId: client.id, clientName: client.name, quotationId: current.clientId === client.id ? current.quotationId : '', quotationNumber: current.clientId === client.id ? current.quotationNumber : '' }))
    setIsClientPickerOpen(false)
    setFormError('')
  }

  function createQuickSupplier(values: QuickSupplierInput) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const contact = { id: crypto.randomUUID(), name: values.contactName, email: values.email, phone: values.phone }
    const directorySupplier = {
      id,
      logo: '',
      name: values.name,
      type: values.type,
      status: 'Active',
      tin: '',
      companyEmail: values.email,
      companyPhone: values.phone,
      address: values.address,
      contacts: [contact],
      categories: [],
      performanceNotes: [],
      catalogLink: '',
      createdAt: now,
      updatedAt: now,
    }
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(supplierStorageKey) ?? '[]')
      const savedSuppliers: unknown[] = Array.isArray(parsed) ? parsed.map((entry: unknown) => entry) : []
      window.localStorage.setItem(supplierStorageKey, JSON.stringify([...savedSuppliers, directorySupplier]))
    } catch {
      return 'The supplier could not be saved in browser storage.'
    }
    const supplier: Supplier = { id, name: values.name, status: 'Active', address: values.address, companyEmail: values.email, companyPhone: values.phone, contacts: [contact] }
    setSuppliers((current) => [...current, supplier].sort((left, right) => left.name.localeCompare(right.name)))
    setDraft((current) => ({ ...current, supplierId: id, contactPerson: contact.name, deliveryLocation: values.address || current.deliveryLocation, poNumber: editingOrderId ? current.poNumber : makePoNumber(supplier, current.date), items: [] }))
    setIsItemPickerOpen(false)
    setItemSearch('')
    setFormError('')
    setIsQuickSupplierOpen(false)
    setToast('Supplier added and selected')
    appendSystemLog({ recordId: id, module: 'Suppliers', action: 'Created', entity: values.name, description: `${values.type} added while creating a purchase order.`, actor: currentUsername, tone: 'success', status: 'Active' })
    return null
  }

  function changeDate(date: string) {
    setDraft((current) => ({ ...current, date, poNumber: !editingOrderId && selectedSupplier ? makePoNumber(selectedSupplier, date) : current.poNumber }))
  }

  function addLine() {
    if (!supplierItems.length) { setFormError('This supplier has no registered items. Add items under this supplier first.'); return }
    setItemSearch('')
    setIsItemPickerOpen(true)
    setFormError('')
  }

  function addItemLine(item: CatalogItem) {
    if (draft.items.some((line) => line.itemId === item.id)) return
    const variant = item.variants.find((entry) => entry.status === 'Active')
    setDraft((current) => ({ ...current, items: [...current.items, { id: crypto.randomUUID(), itemId: item.id, variantId: variant?.id ?? '', photo: variant?.photo || item.photo, itemName: item.name, variantLabel: variant ? `${variant.name}: ${variant.value}` : '', productCode: variant?.productCode || item.productCode, unitOfMeasure: variant?.unitOfMeasure || item.unitOfMeasure, quantity: '1', unitCost: String(variant?.rawCost ?? item.rawCost) }] }))
    setFormError('')
  }

  function selectLineVariant(lineId: string, variantId: string) {
    setDraft((current) => ({ ...current, items: current.items.map((line) => {
      if (line.id !== lineId) return line
      const item = supplierItems.find((entry) => entry.id === line.itemId)
      const variant = item?.variants.find((entry) => entry.id === variantId)
      return variant ? { ...line, variantId, photo: variant.photo || item?.photo || '', variantLabel: `${variant.name}: ${variant.value}`, productCode: variant.productCode || item?.productCode || '', unitOfMeasure: variant.unitOfMeasure || item?.unitOfMeasure || 'Piece', unitCost: String(variant.rawCost) } : { ...line, variantId: '', photo: item?.photo || '', variantLabel: '', productCode: item?.productCode || '', unitOfMeasure: item?.unitOfMeasure || 'Piece', unitCost: String(item?.rawCost ?? 0) }
    }) }))
  }

  function updateLine(lineId: string, field: 'quantity' | 'unitCost', value: string) {
    setDraft((current) => ({ ...current, items: current.items.map((line) => line.id === lineId ? { ...line, [field]: value } : line) }))
  }

  function addCharge() {
    setDraft((current) => ({ ...current, otherCharges: [...current.otherCharges, { id: crypto.randomUUID(), label: '', amount: '' }] }))
  }

  function updateCharge(chargeId: string, field: 'label' | 'amount', value: string) {
    setDraft((current) => ({ ...current, otherCharges: current.otherCharges.map((charge) => charge.id === chargeId ? { ...charge, [field]: value } : charge) }))
  }

  function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const supplier = supplierMap.get(draft.supplierId)
    const client = clients.find((entry) => entry.id === draft.clientId)
    const linkedQuotation = approvedQuotations.find((quotation) => quotation.id === draft.quotationId && quotation.clientId === draft.clientId)
    if (!supplier || !client || !draft.contactPerson.trim() || !draft.poNumber.trim() || !draft.date || !draft.deliveryLocation.trim() || !draft.items.length || draft.items.some((line) => !line.itemId || Number(line.quantity) <= 0 || Number(line.unitCost) < 0) || draft.otherCharges.some((charge) => !charge.label.trim() || Number(charge.amount) <= 0)) {
      setFormError(`Complete the supplier, client, contact, delivery, and item details${draft.otherCharges.length ? ', including a name and positive amount for every charge,' : ''} before ${editingOrderId ? 'saving' : 'creating'} the PO.`)
      return
    }
    const now = new Date().toISOString()
    const previous = editingOrderId ? orders.find((order) => order.id === editingOrderId) : undefined
    const id = previous?.id ?? crypto.randomUUID()
    const values: PurchaseOrder = { id, date: draft.date, poNumber: draft.poNumber.trim(), clientId: client.id, clientName: client.name, supplierId: supplier.id, supplierName: supplier.name, contactPerson: draft.contactPerson.trim(), subject: draft.subject.trim(), quotationId: linkedQuotation?.id ?? '', quotationNumber: linkedQuotation?.quotationNumber ?? '', modeOfPayment: draft.modeOfPayment, paymentTerm: draft.paymentTerm, deliveryLocation: draft.deliveryLocation.trim(), modeOfDelivery: draft.modeOfDelivery, notes: draft.notes.trim(), terms: draft.terms.trim() || loadDocumentDefaults().purchaseOrderTerms, items: draft.items.map((line) => ({ ...line, quantity: Number(line.quantity), unitCost: Number(line.unitCost) })), subtotalAmount: draftSubtotal, vatEnabled: draft.vatEnabled, vatAmount: draftVatAmount, otherCharges: draft.otherCharges.map((charge) => ({ ...charge, label: charge.label.trim(), amount: Number(charge.amount) || 0 })), totalAmount: draftTotal, status: previous?.status ?? 'Not yet sent', addedToExpenses: previous?.addedToExpenses ?? false, createdAt: previous?.createdAt ?? now, updatedAt: now }
    if (previous) {
      setOrders((current) => current.map((order) => order.id === previous.id ? values : order))
      if (previous.addedToExpenses) syncLinkedExpense(previous, values)
      appendSystemLog({ recordId: id, module: 'Purchase Orders', action: 'Updated', entity: values.poNumber, description: `Purchase order details updated for ${values.supplierName}.`, actor: currentUsername, tone: 'info', amount: values.totalAmount, status: values.status })
    } else {
      setOrders((current) => [values, ...current])
      appendSystemLog({ recordId: id, module: 'Purchase Orders', action: 'Created', entity: values.poNumber, description: `Purchase order created for ${values.supplierName}.`, actor: currentUsername, tone: 'success', amount: values.totalAmount, status: values.status })
    }
    setIsFormOpen(false)
    setEditingOrderId(null)
    setToast(previous ? 'Purchase order updated successfully' : 'Purchase order created successfully')
  }

  function updateStatus(order: PurchaseOrder, status: PurchaseOrderStatus) {
    setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, status, updatedAt: new Date().toISOString() } : entry))
    appendSystemLog({ recordId: order.id, module: 'Purchase Orders', action: 'Status changed', entity: order.poNumber, description: `PO status changed from ${order.status} to ${status}.`, actor: currentUsername, tone: status === 'Delivered' ? 'success' : status === 'Cancelled' ? 'danger' : 'info', amount: order.totalAmount, status })
    setToast('Purchase order status updated')
  }

  function saveOrderDocumentContent(notes: string, terms: string) {
    if (!selectedOrder) return
    setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, notes, terms, updatedAt: new Date().toISOString() } : order))
  }

  function addToExpenses(order: PurchaseOrder) {
    if (order.addedToExpenses) return
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(expenseStorageKey) ?? '[]')
      const expenses = Array.isArray(parsed) ? parsed : []
      expenses.unshift({ id: Date.now(), date: order.date, payee: order.supplierName, category: 'Materials', description: expenseDescription(order), amount: order.totalAmount, paymentMethod: order.modeOfPayment, purchaser: currentUsername, status: 'To pay', invoiceLink: '', notes: expenseNotes(order), quotationId: order.quotationId, quotationNumber: order.quotationNumber, projectName: order.subject || order.clientName })
      window.localStorage.setItem(expenseStorageKey, JSON.stringify(expenses))
      setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, addedToExpenses: true, updatedAt: new Date().toISOString() } : entry))
      appendSystemLog({ recordId: order.id, module: 'Purchase Orders', action: 'Added to Expenses', entity: order.poNumber, description: 'Purchase order total was added to Expenses.', actor: currentUsername, tone: 'success', amount: order.totalAmount, status: order.status })
      setToast('Purchase order added to Expenses')
    } catch { setToast('Could not add this PO to Expenses') }
  }

  function expenseDescription(order: PurchaseOrder) {
    return `Purchase Order ${order.poNumber}${order.subject ? ` — ${order.subject}` : ''}`
  }

  function expenseNotes(order: PurchaseOrder) {
    const charges = order.otherCharges.length ? `; Other charges: ${order.otherCharges.map((charge) => `${charge.label} ${formatPeso(charge.amount)}`).join(', ')}` : ''
    return `PO ID: ${order.id}; Client: ${order.clientName}; ${order.paymentTerm}; VAT: ${order.vatEnabled ? formatPeso(order.vatAmount) : 'Not applied'}${charges}`
  }

  function isLinkedExpense(value: unknown, order: PurchaseOrder) {
    if (typeof value !== 'object' || value === null) return false
    const expense = value as Record<string, unknown>
    return (typeof expense.notes === 'string' && expense.notes.includes(`PO ID: ${order.id}`)) || (typeof expense.description === 'string' && expense.description.startsWith(`Purchase Order ${order.poNumber}`) && expense.payee === order.supplierName)
  }

  function syncLinkedExpense(previous: PurchaseOrder, order: PurchaseOrder) {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(expenseStorageKey) ?? '[]')
      if (!Array.isArray(parsed)) return
      const expenses = (parsed as unknown[]).map((value) => isLinkedExpense(value, previous) && typeof value === 'object' && value !== null ? { ...value, date: order.date, payee: order.supplierName, description: expenseDescription(order), amount: order.totalAmount, paymentMethod: order.modeOfPayment, notes: expenseNotes(order), quotationId: order.quotationId, quotationNumber: order.quotationNumber, projectName: order.subject || order.clientName } : value)
      window.localStorage.setItem(expenseStorageKey, JSON.stringify(expenses))
    } catch { setToast('PO updated, but its linked expense could not be synchronized') }
  }

  function removeFromExpenses(order: PurchaseOrder) {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(expenseStorageKey) ?? '[]')
      const expenses = Array.isArray(parsed) ? (parsed as unknown[]).filter((value) => !isLinkedExpense(value, order)) : []
      window.localStorage.setItem(expenseStorageKey, JSON.stringify(expenses))
      setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, addedToExpenses: false, updatedAt: new Date().toISOString() } : entry))
      appendSystemLog({ recordId: order.id, module: 'Purchase Orders', action: 'Removed from Expenses', entity: order.poNumber, description: 'Linked purchase order expense was removed from Expenses.', actor: currentUsername, tone: 'warning', amount: order.totalAmount, status: order.status })
      setToast('Purchase order removed from Expenses')
    } catch { setToast('Could not remove this PO from Expenses') }
  }

  function linkOrderToQuotation(order: PurchaseOrder, quotationId: string) {
    const quotation = approvedQuotations.find((entry) => entry.id === quotationId && entry.clientId === order.clientId)
    const updated = { ...order, quotationId: quotation?.id ?? '', quotationNumber: quotation?.quotationNumber ?? '', updatedAt: new Date().toISOString() }
    setOrders((current) => current.map((entry) => entry.id === order.id ? updated : entry))
    if (order.addedToExpenses) syncLinkedExpense(order, updated)
    appendSystemLog({ recordId: order.id, module: 'Purchase Orders', action: 'Updated', entity: order.poNumber, description: quotation ? `Linked to ${quotation.quotationNumber}.` : 'Removed quotation project link.', actor: currentUsername, tone: 'info', amount: order.totalAmount, status: order.status })
    setIsProjectLinkOpen(false)
    setToast(quotation ? `Linked to ${quotation.quotationNumber}` : 'Project link removed')
  }

  function deleteOrder(order: PurchaseOrder) {
    if (order.addedToExpenses) {
      setIsConfirmingDelete(false)
      setToast('Remove this PO from Expenses before deleting it')
      return
    }
    setOrders((current) => current.filter((entry) => entry.id !== order.id))
    appendSystemLog({ recordId: order.id, module: 'Purchase Orders', action: 'Deleted', entity: order.poNumber, description: `Purchase order for ${order.supplierName} was deleted.`, actor: currentUsername, tone: 'danger', amount: order.totalAmount, status: order.status })
    setSelectedOrderId(null)
    setIsConfirmingDelete(false)
    setToast('Purchase order deleted')
  }

  const summaryCards = [
    { label: 'Total orders', value: orders.length, color: 'text-brand-blue', dot: 'bg-brand-blue' },
    { label: 'In progress', value: orders.filter((order) => ['Sent', 'Waiting for Delivery', 'For Payment'].includes(order.status)).length, color: 'text-sky-600', dot: 'bg-sky-500' },
    { label: 'Delivered', value: orders.filter((order) => order.status === 'Delivered').length, color: 'text-emerald-600', dot: 'bg-emerald-500' },
    { label: 'Committed value', value: formatPeso(orders.filter((order) => order.status !== 'Cancelled').reduce((total, order) => total + order.totalAmount, 0)), color: 'text-brand-orange', dot: 'bg-brand-orange' },
  ]

  return <div className="purchase-order-page space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
    <SummarySurface className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center" aria-label="Purchase order summary"><div><div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Supplier orders</p></div><h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Purchase orders</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Create supplier orders, check delivery and payment status, and add completed costs to Expenses.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">{summaryCards.map((card, index) => <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-3 py-3.5 shadow-[0_9px_24px_-22px_rgba(0,20,76,0.48)] ring-1 ring-inset ring-white/70 transition-all duration-300 hover:-translate-y-1 hover:border-brand-blue/15 hover:shadow-[0_18px_36px_-24px_rgba(0,20,76,0.48)] animate-[po-card-enter_380ms_cubic-bezier(0.22,1,0.36,1)_both] sm:min-w-32 sm:px-4" style={{ animationDelay: `${index * 55}ms` }} key={card.label}><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${card.dot}`} /><p className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{card.label}</p></div><p className={`mt-2 truncate text-xl font-bold tracking-[-0.04em] ${card.color}`}>{card.value}</p></article>)}</div></SummarySurface>
    {storageError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{storageError}</div> : null}

    <section className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-brand-blue/10 bg-[linear-gradient(110deg,rgba(0,20,76,0.045),rgba(255,255,255,0.98),rgba(244,128,32,0.055))] p-4 shadow-[0_12px_32px_-28px_rgba(0,20,76,0.55)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3.5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-blue text-white shadow-[0_10px_22px_-12px_rgba(0,20,76,0.8)]"><Icon className="size-5" path="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /></span><div className="min-w-0"><p className="text-sm font-extrabold text-brand-blue">Shared PDF settings</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Company details and document defaults are managed once and reused by quotation, PO, and SOA PDFs.</p></div></div>
      <button className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-blue/10 bg-white px-4 text-xs font-bold text-brand-blue shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50 hover:shadow-md" type="button" onClick={() => { window.history.pushState(null, '', '/settings'); window.dispatchEvent(new Event('adiel:navigate')) }}><Icon className="size-4" path="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19 12h2M3 12h2M12 3v2M12 19v2" />Open Settings</button>
    </section>

    <TableControls tableId="purchase-orders-table" storageKey="purchase-orders.table" columns={[{ index: 1, label: 'Number', required: true }, { index: 2, label: 'PO date' }, { index: 3, label: 'PO number', required: true }, { index: 4, label: 'Client' }, { index: 5, label: 'Supplier' }, { index: 6, label: 'Items' }, { index: 7, label: 'Total amount' }, { index: 8, label: 'Status' }, { index: 9, label: 'Expenses' }, { index: 10, label: 'Details', required: true }]} sortKey={orderTable.sortKey} sortOptions={orderSortOptions} onSortChange={orderTable.setSortKey} page={orderTable.page} pageCount={orderTable.pageCount} pageSize={orderTable.pageSize} onPageChange={orderTable.setPage} onPageSizeChange={orderTable.setPageSize} total={orderTable.total} />

    <section className="relative overflow-hidden rounded-[1.5rem] animate-[view-swap_420ms_cubic-bezier(0.22,1,0.36,1)] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]"><div className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-sm"><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition-all duration-200 hover:border-slate-300 focus:border-brand-blue/40 focus:bg-white" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PO number, client, supplier, or item..." /></div><div className="flex flex-wrap items-center gap-2"><AnimatedDropdown className="min-w-44" size="filter" fullWidth={false} value={statusFilter} options={statusFilterOptions} onChange={setStatusFilter} ariaLabel="Filter purchase orders by status" />{search || statusFilter !== 'All statuses' ? <button className="h-10 rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-slate-100" type="button" onClick={() => { setSearch(''); setStatusFilter('All statuses') }}>Clear</button> : null}<button className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition-all hover:-translate-y-0.5 sm:flex-none" type="button" onClick={openForm}><Icon className="size-4 transition-transform group-hover:rotate-90" path="M12 5v14M5 12h14" />New purchase order</button></div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><div><h3 className="text-sm font-bold text-brand-blue">All purchase orders</h3><p className="mt-0.5 text-[11px] text-slate-400">Delivery and payment status</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{filteredOrders.length} orders</span></div></div>
      {visibleOrders.length ? <div className="overflow-hidden"><table className="w-full table-fixed text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="w-[4%] px-2 py-3.5 text-center">#</th><th className="w-[10%] px-2 py-3.5">PO Date</th><th className="w-[13%] px-2 py-3.5">PO Number</th><th className="w-[12%] px-2 py-3.5">Client Name</th><th className="w-[14%] px-2 py-3.5">Supplier</th><th className="w-[7%] px-2 py-3.5 text-center">Items</th><th className="w-[12%] px-2 py-3.5 text-right">Total Amount</th><th className="w-[13%] px-2 py-3.5">Status</th><th className="w-[8%] px-2 py-3.5 text-center">Expenses</th><th className="w-[7%] px-2 py-3.5 text-right">Details</th></tr></thead><tbody>{visibleOrders.map((order, index) => <tr className="border-b border-slate-100 transition duration-200 hover:bg-slate-50/70 animate-[po-row-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${Math.min(index * 35, 175)}ms` }} key={order.id}><td className="px-2 py-4 text-center text-sm font-extrabold text-brand-blue">{index + 1}</td><td className="px-2 py-4 text-[13px] font-semibold text-slate-600">{formatDate(order.date)}</td><td className="px-2 py-4 font-mono text-[13px] font-extrabold text-brand-blue">{order.poNumber}</td><td className="px-2 py-4 text-[13px] font-bold text-slate-600"><p className="truncate">{order.clientName}</p></td><td className="px-2 py-4"><p className="truncate text-[13px] font-bold text-slate-600">{order.supplierName}</p><p className="mt-1 truncate text-[11px] text-slate-400">{order.contactPerson}</p></td><td className="px-2 py-4 text-center"><span className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[13px] font-extrabold text-violet-700">{order.items.length}</span></td><td className="px-2 py-4 text-right text-[13px] font-extrabold tabular-nums text-brand-blue">{formatPeso(order.totalAmount)}</td><td className="px-2 py-4"><span className={`inline-flex rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${statusTone(order.status)}`}>{order.status}</span></td><td className="px-2 py-4 text-center"><span className={`inline-flex rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${order.addedToExpenses ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{order.addedToExpenses ? 'Done' : 'Not yet'}</span></td><td className="px-2 py-4 text-right"><button className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-brand-blue transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50 hover:shadow-sm active:translate-y-0" type="button" onClick={() => setSelectedOrderId(order.id)}>View<Icon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" path="m9 18 6-6-6-6" /></button></td></tr>)}</tbody></table></div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-brand-blue"><Icon className="size-6" path="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6" /></span><h3 className="mt-4 text-lg font-bold text-brand-blue">{orders.length ? 'No purchase orders found' : 'Create your first purchase order'}</h3><p className="mt-2 text-xs text-slate-400">{orders.length ? 'Try clearing the current search or status filter.' : 'Choose a supplier and add the items you need to order.'}</p><button className="mt-5 h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white" type="button" onClick={openForm}>New purchase order</button></div></div>}
    </section>

    {isFormOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="po-form-title"><button className="absolute inset-0" type="button" onClick={() => setIsFormOpen(false)} aria-label="Close purchase order form" /><form className="relative my-6 w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.34)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)]" onSubmit={saveOrder}><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Purchase order</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="po-form-title">{editingOrderId ? 'Edit purchase order' : 'New purchase order'}</h2><p className="mt-1 text-xs text-slate-400">{editingOrderId ? 'Update supplier, delivery, and item details' : 'Supplier, delivery, and item details'}</p></div><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsFormOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></button></div><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5">{formError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{formError}</div> : null}<div className="grid gap-6 lg:grid-cols-2"><section><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Icon path="M3 21h18M5 21V7l7-4 7 4v14" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Order details</h3><p className="text-[10px] text-slate-400">Supplier and order number</p></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClassName}>Supplier name</label><AnimatedDropdown value={draft.supplierId} options={supplierOptions.length ? supplierOptions : [{ value: '', label: 'No suppliers available' }]} onChange={selectSupplier} ariaLabel="Supplier name" /></div><div><label className={labelClassName}>Contact person</label><AnimatedDropdown value={draft.contactPerson} options={contactOptions} onChange={(contactPerson) => setDraft((current) => ({ ...current, contactPerson }))} ariaLabel="Contact person" /></div><div><label className={labelClassName} htmlFor="po-client">Client name</label><input className={fieldClassName} id="po-client" value={draft.clientName} onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))} placeholder="Client or project owner" required /></div><div><label className={labelClassName} htmlFor="po-number">PO number</label><input className={`${fieldClassName} bg-slate-50 font-mono font-bold`} id="po-number" value={draft.poNumber} readOnly /></div><div><label className={labelClassName}>PO date</label><AnimatedDatePicker value={draft.date} onChange={changeDate} ariaLabel="Purchase order date" required /></div><div className="sm:col-span-2"><label className={labelClassName} htmlFor="po-subject">Subject <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><input className={fieldClassName} id="po-subject" value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="Purpose of this purchase order" /></div></div></section><section><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-orange-50 text-brand-orange"><Icon path="M4 4h16v16H4V4Zm4 4h8M8 12h8" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Payment & delivery</h3><p className="text-[10px] text-slate-400">Payment and delivery details</p></div></div><div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClassName}>Mode of payment</label><AnimatedDropdown value={draft.modeOfPayment} options={paymentOptions} onChange={(modeOfPayment) => setDraft((current) => ({ ...current, modeOfPayment }))} ariaLabel="Mode of payment" /></div><div><label className={labelClassName}>Payment term</label><AnimatedDropdown value={draft.paymentTerm} options={paymentTermOptions} onChange={(paymentTerm) => setDraft((current) => ({ ...current, paymentTerm }))} ariaLabel="Payment term" /></div><div><label className={labelClassName}>Mode of delivery</label><AnimatedDropdown value={draft.modeOfDelivery} options={deliveryModeOptions} onChange={(modeOfDelivery) => setDraft((current) => ({ ...current, modeOfDelivery }))} ariaLabel="Mode of delivery" /></div><div><label className={labelClassName} htmlFor="po-delivery-location">Delivery location</label><input className={fieldClassName} id="po-delivery-location" value={draft.deliveryLocation} onChange={(event) => setDraft((current) => ({ ...current, deliveryLocation: event.target.value }))} placeholder="Complete delivery address" required /></div></div></section></div><section className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-extrabold text-brand-blue">Order items</h3><p className="mt-1 text-[10px] text-slate-400">Only items registered under the selected supplier are available.</p></div><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 text-[11px] font-bold text-violet-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-100 hover:shadow-sm active:translate-y-0 active:scale-[0.98] disabled:opacity-40" type="button" onClick={addLine} disabled={!draft.supplierId || !supplierItems.length}><Icon className="size-3.5" path="M4 5h16v14H4V5Zm0 10 4-4 4 4 2-2 6 6M16 9h.01" />Browse items</button></div>{draft.items.length ? <div className="mt-4 space-y-3">{draft.items.map((line, index) => { const item = supplierItems.find((entry) => entry.id === line.itemId); const variantOptions = [{ value: '', label: 'Base item' }, ...(item?.variants.map((variant) => ({ value: variant.id, label: `${variant.name}: ${variant.value}` })) ?? [])]; const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitCost) || 0); return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/55 p-4 transition-all duration-200 hover:border-brand-blue/15 hover:bg-white hover:shadow-[0_14px_30px_-26px_rgba(0,20,76,0.48)] animate-[po-row-enter_300ms_cubic-bezier(0.22,1,0.36,1)_both] lg:grid-cols-[2rem_1.5fr_1fr_0.55fr_0.75fr_0.75fr_auto] lg:items-end" style={{ animationDelay: `${Math.min(index * 40, 160)}ms` }} key={line.id}><span className="grid size-8 place-items-center rounded-lg bg-white text-[10px] font-extrabold text-violet-600 shadow-sm">{index + 1}</span><div><label className={labelClassName}>Item</label><div className="flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2"><ProductPhoto photo={line.photo || item?.photo || ''} name={line.itemName} className="size-8 rounded-lg" /><div className="min-w-0"><p className="truncate text-[11px] font-extrabold text-brand-blue">{line.itemName}</p><p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">{line.productCode || 'No product code'}</p></div></div></div><div><label className={labelClassName}>Variant</label><AnimatedDropdown value={line.variantId} options={variantOptions} onChange={(variantId) => selectLineVariant(line.id, variantId)} ariaLabel={`Variant ${index + 1}`} /></div><div><label className={labelClassName}>Qty</label><input className={fieldClassName} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} /></div><div><label className={labelClassName}>Unit cost</label><input className={fieldClassName} type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(line.id, 'unitCost', event.target.value)} /></div><div><p className={labelClassName}>Subtotal</p><p className="flex h-11 items-center text-xs font-extrabold text-brand-blue">{formatPeso(lineTotal)}</p></div><button className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600" type="button" onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== line.id) }))}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div>})}</div> : <button className="mt-4 grid min-h-28 w-full place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 text-center" type="button" onClick={addLine} disabled={!supplierItems.length}><span><span className="mx-auto grid size-9 place-items-center rounded-xl bg-white text-violet-600 shadow-sm"><Icon path="M12 5v14M5 12h14" /></span><span className="mt-2 block text-xs font-bold text-slate-500">No items added</span><span className="mt-1 block text-[10px] text-slate-400">Select a supplier, then choose items.</span></span></button>}</section><section className="mt-6 border-t border-slate-100 pt-5"><div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon path="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></span><div><h3 className="text-xs font-extrabold text-brand-blue">Taxes & additional charges</h3><p className="text-[10px] text-slate-400">See how the final amount is calculated.</p></div></div><div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"><div className="space-y-3"><div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/55 p-4"><div><p className="text-sm font-bold text-brand-blue">VAT (12%)</p><p className="mt-1 text-[11px] text-slate-400">Calculated from the items subtotal</p></div><div className="flex items-center gap-3"><span className="text-sm font-extrabold tabular-nums text-slate-600">{formatPeso(draftVatAmount)}</span><button className={`relative h-7 w-12 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/15 ${draft.vatEnabled ? 'bg-brand-blue' : 'bg-slate-300'}`} type="button" onClick={() => setDraft((current) => ({ ...current, vatEnabled: !current.vatEnabled }))} role="switch" aria-checked={draft.vatEnabled} aria-label="Apply 12 percent VAT"><span className={`absolute left-0 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${draft.vatEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-brand-blue">Other charges</p><p className="mt-1 text-[11px] text-slate-400">Delivery, handling, permits, or custom fees</p></div><button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-blue/10 bg-blue-50 px-3 text-[11px] font-bold text-brand-blue transition hover:-translate-y-0.5 hover:bg-blue-100" type="button" onClick={addCharge}><Icon className="size-3.5" path="M12 5v14M5 12h14" />Add charge</button></div>{draft.otherCharges.length ? <div className="mt-3 space-y-2">{draft.otherCharges.map((charge, index) => <div className="grid gap-2 rounded-xl bg-slate-50/70 p-2.5 animate-[content-enter_160ms_ease-out] sm:grid-cols-[1fr_10rem_auto]" key={charge.id}><div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500" htmlFor={`po-charge-name-${charge.id}`}>Charge name</label><input className={fieldClassName} id={`po-charge-name-${charge.id}`} value={charge.label} onChange={(event) => updateCharge(charge.id, 'label', event.target.value)} placeholder="e.g. Delivery fee" required /></div><div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500" htmlFor={`po-charge-amount-${charge.id}`}>Amount</label><input className={fieldClassName} id={`po-charge-amount-${charge.id}`} type="number" min="0.01" step="0.01" value={charge.amount} onChange={(event) => updateCharge(charge.id, 'amount', event.target.value)} placeholder="0.00" required /></div><button className="grid size-11 place-items-center self-end rounded-xl text-slate-300 transition hover:bg-red-50 hover:text-red-600" type="button" onClick={() => setDraft((current) => ({ ...current, otherCharges: current.otherCharges.filter((entry) => entry.id !== charge.id) }))} aria-label={`Remove ${charge.label || `charge ${index + 1}`}`}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></button></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">No additional charges</p>}</div></div><aside className="self-start rounded-2xl bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white shadow-[0_18px_38px_-24px_rgba(0,20,76,0.75)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-24px_rgba(0,20,76,0.82)] animate-[po-total-enter_420ms_cubic-bezier(0.22,1,0.36,1)_both]"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Order total</p><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4 text-white/70"><span>Items subtotal</span><span className="font-bold tabular-nums text-white">{formatPeso(draftSubtotal)}</span></div><div className={`flex justify-between gap-4 transition-all duration-300 ${draft.vatEnabled ? 'text-white/70' : 'text-white/35'}`}><span>VAT (12%)</span><span className="font-bold tabular-nums text-white">{formatPeso(draftVatAmount)}</span></div>{draft.otherCharges.map((charge, index) => <div className="flex justify-between gap-4 text-white/70 animate-[view-swap_220ms_cubic-bezier(0.22,1,0.36,1)]" key={charge.id}><span className="truncate">{charge.label.trim() || `Charge ${index + 1}`}</span><span className="shrink-0 font-bold tabular-nums text-white">{formatPeso(Number(charge.amount) || 0)}</span></div>)}</div><div className="mt-4 border-t border-white/15 pt-4"><div className="flex items-end justify-between gap-4"><span className="text-xs font-bold uppercase tracking-[0.1em] text-white/60">Grand total</span><span className="text-2xl font-extrabold tabular-nums">{formatPeso(draftTotal)}</span></div></div></aside></div></section></div><div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Grand total</p><p className="mt-1 text-lg font-extrabold text-brand-blue">{formatPeso(draftTotal)}</p></div><div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0" type="submit" disabled={!suppliers.length}>{editingOrderId ? 'Save changes' : 'Create purchase order'}</button></div></div></form></div> : null}

    {selectedOrder && !isDocumentDialogOpen ? <div className="fixed bottom-6 right-6 z-[70] flex flex-wrap justify-end gap-2"><button className="inline-flex h-12 items-center gap-2 rounded-2xl border border-violet-100 bg-white px-5 text-xs font-bold text-violet-700 shadow-[0_18px_40px_-18px_rgba(0,20,76,0.55)] transition hover:-translate-y-1 hover:bg-violet-50" type="button" onClick={() => setIsProjectLinkOpen(true)}><Icon className="size-4" path="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1" />{selectedOrder.quotationNumber || 'Link project'}</button><button className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_18px_40px_-15px_rgba(0,20,76,0.8)] transition hover:-translate-y-1" type="button" onClick={() => setIsDocumentDialogOpen(true)}><Icon className="size-4" path="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8Z" />Export PDF</button></div> : null}

    {selectedOrder ? <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="po-detail-title"><button className="absolute inset-0" type="button" onClick={() => { setSelectedOrderId(null); setIsConfirmingDelete(false) }} /><section className="relative my-6 w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.34)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)]"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Purchase order</p><h2 className="mt-1.5 font-mono text-xl font-bold text-brand-blue" id="po-detail-title">{selectedOrder.poNumber}</h2><p className="mt-1 text-sm text-slate-400">Created {formatDate(selectedOrder.date)} for {selectedOrder.clientName}</p></div><div className="flex items-center gap-2"><AnimatedDropdown className="min-w-44" size="filter" fullWidth={false} value={selectedOrder.status} options={statusOptions} onChange={(status) => updateStatus(selectedOrder, status)} ariaLabel="Purchase order status" /><button className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-brand-blue transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50 hover:shadow-sm active:translate-y-0" type="button" onClick={() => openEditForm(selectedOrder)}><Icon className="size-3.5" path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />Edit PO</button><button className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-100" type="button" onClick={() => { setSelectedOrderId(null); setIsConfirmingDelete(false) }}><Icon path="M18 6 6 18M6 6l12 12" /></button></div></div><div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 py-5"><div className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue/15 hover:bg-white hover:shadow-sm animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: '0ms' }}><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Supplier</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedOrder.supplierName}</p><p className="mt-1 text-sm text-slate-500">{selectedOrder.contactPerson}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue/15 hover:bg-white hover:shadow-sm animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: '60ms' }}><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Payment</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedOrder.modeOfPayment}</p><p className="mt-1 text-sm text-slate-500">{selectedOrder.paymentTerm}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue/15 hover:bg-white hover:shadow-sm animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: '120ms' }}><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Delivery</p><p className="mt-2 text-sm font-extrabold text-brand-blue">{selectedOrder.modeOfDelivery}</p><p className="mt-1 text-sm leading-5 text-slate-500">{selectedOrder.deliveryLocation}</p></div></div>{selectedOrder.subject ? <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/45 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-blue">Subject</p><p className="mt-1 text-sm font-semibold text-slate-600">{selectedOrder.subject}</p></div> : null}<div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[720px] table-fixed text-left"><thead><tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="w-[8%] px-4 py-3 text-center">#</th><th className="w-[36%] px-4 py-3">Item</th><th className="w-[12%] px-4 py-3">Unit</th><th className="w-[12%] px-4 py-3 text-right">Qty</th><th className="w-[16%] px-4 py-3 text-right">Unit Cost</th><th className="w-[16%] px-4 py-3 text-right">Subtotal</th></tr></thead><tbody>{selectedOrder.items.map((line, index) => <tr className="border-t border-slate-100 transition-colors duration-200 hover:bg-blue-50/30 animate-[po-row-enter_300ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${Math.min(index * 40, 160)}ms` }} key={line.id}><td className="px-4 py-3 text-center text-sm font-bold text-brand-blue">{index + 1}</td><td className="px-4 py-3"><div className="flex min-w-0 items-center gap-3"><ProductPhoto photo={line.photo} name={line.itemName} className="size-11 rounded-xl" /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-700">{line.itemName}</p><p className="mt-1 truncate text-[11px] text-slate-400">{line.productCode}{line.variantLabel ? ` · ${line.variantLabel}` : ''}</p></div></div></td><td className="px-4 py-3 text-sm text-slate-600">{line.unitOfMeasure}</td><td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600">{line.quantity}</td><td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600">{formatPeso(line.unitCost)}</td><td className="px-4 py-3 text-right text-sm font-extrabold tabular-nums text-brand-blue">{formatPeso(line.quantity * line.unitCost)}</td></tr>)}</tbody></table></div><div className="ml-auto mt-4 w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50/60 p-4 animate-[view-swap_300ms_cubic-bezier(0.22,1,0.36,1)]"><div className="flex items-center justify-between gap-4 text-sm"><span className="font-semibold text-slate-500">Items subtotal</span><span className="font-extrabold tabular-nums text-brand-blue">{formatPeso(selectedOrder.subtotalAmount)}</span></div>{selectedOrder.vatEnabled ? <div className="mt-2.5 flex items-center justify-between gap-4 text-sm"><span className="font-semibold text-slate-500">VAT (12%)</span><span className="font-extrabold tabular-nums text-brand-blue">{formatPeso(selectedOrder.vatAmount)}</span></div> : null}{selectedOrder.otherCharges.map((charge) => <div className="mt-2.5 flex items-center justify-between gap-4 text-sm" key={charge.id}><span className="truncate font-semibold text-slate-500">{charge.label}</span><span className="shrink-0 font-extrabold tabular-nums text-brand-blue">{formatPeso(charge.amount)}</span></div>)}</div></div><div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Grand total</p><p className="mt-1 text-xl font-extrabold text-brand-blue">{formatPeso(selectedOrder.totalAmount)}</p></div><div className="flex flex-wrap items-center justify-end gap-2">{isConfirmingDelete ? <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-1.5 pl-3"><span className="text-[11px] font-bold text-red-700">Delete this PO?</span><button className="h-8 rounded-lg px-2.5 text-[11px] font-bold text-slate-500 hover:bg-white" type="button" onClick={() => setIsConfirmingDelete(false)}>Cancel</button><button className="h-8 rounded-lg bg-red-600 px-3 text-[11px] font-bold text-white" type="button" onClick={() => deleteOrder(selectedOrder)}>Delete</button></div> : <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-red-600 transition hover:bg-red-50" type="button" onClick={() => setIsConfirmingDelete(true)}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" />Delete PO</button>}<button className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${selectedOrder.addedToExpenses ? 'border border-amber-200 bg-white text-amber-700 hover:bg-amber-50' : 'bg-brand-blue text-white'}`} type="button" onClick={() => selectedOrder.addedToExpenses ? removeFromExpenses(selectedOrder) : addToExpenses(selectedOrder)}><Icon path={selectedOrder.addedToExpenses ? 'M5 12h14' : 'M12 5v14M5 12h14'} />{selectedOrder.addedToExpenses ? 'Remove from Expenses' : 'Add to Expenses'}</button></div></div></section></div> : null}

    {selectedOrder && isProjectLinkOpen ? <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="po-project-link-title"><button className="absolute inset-0" type="button" onClick={() => setIsProjectLinkOpen(false)} aria-label="Close project link dialog" /><section className="relative w-full max-w-lg rounded-[1.5rem] border border-white/20 bg-white p-6 shadow-[0_30px_90px_rgba(0,20,76,0.35)]"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-orange">Project expense</p><h2 className="mt-1.5 text-xl font-extrabold text-brand-blue" id="po-project-link-title">Link purchase to a project</h2><p className="mt-1 text-xs leading-5 text-slate-400">Choose an approved quotation for {selectedOrder.clientName}. If this PO is already in Expenses, its link is updated automatically.</p></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsProjectLinkOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></button></div><div className="mt-5"><label className={labelClassName}>Approved quotation</label><AnimatedDropdown value={selectedOrder.quotationId} options={selectedOrderQuotationOptions} onChange={(quotationId) => linkOrderToQuotation(selectedOrder, quotationId)} ariaLabel="Approved quotation project link" /><p className="mt-2 rounded-xl bg-violet-50 px-3 py-2.5 text-[10px] font-semibold leading-5 text-violet-700">Linking this PO lets Sales include its cost when calculating actual profit.</p></div><div className="mt-5 flex justify-end"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setIsProjectLinkOpen(false)}>Cancel</button></div></section></div> : null}

    {selectedOrder && isDocumentDialogOpen ? <PurchaseOrderDocumentDialog order={selectedOrder} supplier={{ name: selectedOrderSupplier?.name ?? selectedOrder.supplierName, address: selectedOrderSupplier?.address ?? '', contactPerson: selectedOrder.contactPerson, phone: selectedOrderContact?.phone || selectedOrderSupplier?.companyPhone || '', email: selectedOrderContact?.email || selectedOrderSupplier?.companyEmail || '' }} onSaveOrderContent={saveOrderDocumentContent} onClose={() => setIsDocumentDialogOpen(false)} /> : null}
    {isFormOpen && isItemPickerOpen ? <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="po-item-picker-title"><button className="absolute inset-0" type="button" onClick={() => setIsItemPickerOpen(false)} aria-label="Close item picker" /><section className="relative my-6 flex max-h-[calc(100svh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)] animate-[supplier-dialog-enter_260ms_cubic-bezier(0.22,1,0.36,1)]"><header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Supplier items</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="po-item-picker-title">Choose items</h2><p className="mt-1 text-xs text-slate-400">{selectedSupplier?.name} · {supplierItems.length} available products</p></div><div className="flex items-center gap-2"><span className="rounded-xl bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">{draft.items.length} selected</span><button className="grid size-9 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsItemPickerOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></button></div></header><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><div className="relative"><Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" path="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-400 focus:border-brand-blue/40 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.05]" type="search" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search product name, code, brand, or category..." autoFocus /></div></div><div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{visibleSupplierItems.length ? <div className="grid gap-3 sm:grid-cols-2">{visibleSupplierItems.map((item, index) => { const isAdded = draft.items.some((line) => line.itemId === item.id); return <article className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_25px_-24px_rgba(0,20,76,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-blue/20 hover:shadow-[0_16px_32px_-24px_rgba(0,20,76,0.48)] animate-[po-card-enter_340ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ animationDelay: `${Math.min(index * 35, 175)}ms` }} key={item.id}><ProductPhoto photo={item.photo} name={item.name} className="size-16 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-brand-blue">{item.name}</p><p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{item.productCode || 'No product code'} · {item.unitOfMeasure}</p><div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-bold text-brand-blue">{item.category || 'Uncategorized'}</span>{item.variants.length ? <span className="rounded-md bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">{item.variants.length} variants</span> : null}<span className="text-[10px] font-extrabold text-slate-600">{formatPeso(item.rawCost)}</span></div></div><button className={`h-9 shrink-0 rounded-xl px-3 text-[10px] font-bold transition ${isAdded ? 'cursor-default bg-emerald-50 text-emerald-700' : 'bg-brand-blue text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.96]'}`} type="button" onClick={() => addItemLine(item)} disabled={isAdded}>{isAdded ? 'Added' : 'Add'}</button></article> })}</div> : <div className="grid min-h-64 place-items-center text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-300"><Icon className="size-6" path="M4 5h16v14H4V5Zm0 10 4-4 4 4 2-2 6 6M16 9h.01" /></span><h3 className="mt-4 text-sm font-bold text-brand-blue">No matching items</h3><p className="mt-1 text-xs text-slate-400">Try another product name, code, brand, or category.</p></div></div>}</div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6"><p className="text-[11px] font-semibold text-slate-400">Items already added are clearly marked.</p><button className="h-10 rounded-xl bg-brand-blue px-5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]" type="button" onClick={() => setIsItemPickerOpen(false)}>Done</button></footer></section></div> : null}
    {isFormOpen && isClientPickerOpen ? <PurchaseOrderClientPickerDialog clients={clients} selectedClientId={draft.clientId} onSelect={selectClient} onClose={() => setIsClientPickerOpen(false)} /> : null}
    {isQuickSupplierOpen ? <QuickAddSupplierDialog existingNames={suppliers.map((supplier) => supplier.name)} onCreate={createQuickSupplier} onClose={() => setIsQuickSupplierOpen(false)} /> : null}
    <SuccessToast message={toast} />
  </div>
}
