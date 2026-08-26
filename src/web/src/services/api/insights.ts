import { apiRequest } from './client'

export type PeriodTotals = { today: number; week: number; month: number }
export type DashboardTask = { id: string; title: string; priority: string; dueDate: string | null; assignedTo: string }
export type DashboardClient = { id: string | null; name: string; photo: string; sales: number; orders: number }
export type DashboardAction = { id: string; title: string; detail: string; urgency: 'Overdue' | 'Today' | 'Pending' | 'Upcoming'; tone: 'danger' | 'today' | 'pending' | 'upcoming'; actionLabel: string; path: string; priority: number; sortDate: string }
export type ActivityEntry = { id: string; recordId: string | null; timestamp: string; module: 'Tasks' | 'Items' | 'Expenses' | 'Suppliers' | 'Clients' | 'Quotations' | 'Purchase Orders' | 'Statements of Account'; action: string; entity: string; description: string; actor: string; tone: 'success' | 'info' | 'warning' | 'danger'; amount: number | null; status: string | null }
export type Dashboard = {
  ranges: { today: { start: string; end: string }; week: { start: string; end: string }; month: { start: string; end: string } }
  sales: PeriodTotals; expenses: PeriodTotals; grossProfit: number; margin: number; actualRevenue: number; projectExpenses: number; operatingExpenses: number; projectProfit: number; companyNetProfit: number; collectionsReceived: number; paidExpenses: number; cashPosition: number; salesChange: number; expenseChange: number
  totalClients: number; activeClients: number; newClients: number; repeatClients: number; topClients: DashboardClient[]; urgentTaskCount: number; urgentTasks: DashboardTask[]; outstandingBalance: number; overdueBalance: number; overdueStatementCount: number; dueSoonStatementCount: number; waitingDeliveryCount: number; forPaymentCount: number; forPaymentTotal: number; notSentCount: number
  trend: Array<{ key: string; label: string; sales: number; expenses: number; profit: number }>; actions: DashboardAction[]; recentActivity: ActivityEntry[]
}
export type SalesRow = { id: string; quotationDate: string; quotationNumber: string; clientName: string; subject: string; projectLocation: string; leadTime: string; subtotalAmount: number; totalAmount: number; estimatedCost: number; estimatedProfit: number; itemCount: number; actualExpenses: number; billingStatus: 'Unbilled' | 'Draft SOA' | 'Billed'; collectionStatus: 'Unbilled' | 'Awaiting issue' | 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue'; statement: { id: string; number: string; balance: number; totalPayments: number } | null }
export type SalesTracker = { items: SalesRow[]; total: number; page: number; pageSize: number; summary: { estimatedRevenue: number; estimatedCost: number; actualExpenses: number; estimatedProfit: number; actualProfit: number; profitVariance: number; profitMargin: number; approvedSales: number; billedSales: number; collections: number; receivables: number }; chart: Array<{ label: string; sales: number; profit: number; actualProfit: number }> }
export type SearchResult = { id: string; type: 'Client' | 'Item' | 'Supplier' | 'Quotation' | 'Purchase order' | 'Task'; title: string; detail: string; path: string }
export type ArchiveRow = { module: ActivityEntry['module']; id: string; title: string; detail: string; archivedAt: string; version: number }
export type ArchivePage = { items: ArchiveRow[]; total: number; page: number; pageSize: number }
export type ActivityPage = { items: ActivityEntry[]; total: number; page: number; pageSize: number; summary: { total: number; today: number; expenseValue: number; actors: number } }

const parameters = (values: Record<string, string | number | undefined | null>) => { const result = new URLSearchParams(); Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') result.set(key, String(value)) }); return result.toString() }
export const getDashboard = (trendMonths: 6 | 12) => apiRequest<Dashboard>('/dashboard?' + parameters({ trendMonths }))
export const getSalesTracker = (query: { from: string; to: string; search?: string; billing?: string; collection?: string; sort?: string; page?: number; pageSize?: number }) => apiRequest<SalesTracker>('/sales-tracker?' + parameters({ ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 30 }))
export const searchBusiness = (query: string, limit = 12) => apiRequest<{ items: SearchResult[] }>('/search?' + parameters({ query, limit }))
export const listArchive = (query: { search?: string; module?: string; page?: number; pageSize?: number } = {}) => apiRequest<ArchivePage>('/archive?' + parameters({ ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 30 }))
export const listActivity = (query: { search?: string; module?: string; action?: string; date?: string; sort?: string; page?: number; pageSize?: number } = {}) => apiRequest<ActivityPage>('/activity?' + parameters({ ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 30 }))
