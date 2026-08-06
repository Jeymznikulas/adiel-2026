export type SystemLogModule = 'Tasks' | 'Items' | 'Expenses' | 'Suppliers' | 'Clients' | 'Purchase Orders'
export type SystemLogAction = 'Created' | 'Updated' | 'Deleted' | 'Status changed' | 'Subtask added' | 'Subtask updated' | 'Subtask removed' | 'Added to Expenses' | 'Removed from Expenses'
export type SystemLogTone = 'success' | 'info' | 'warning' | 'danger'

export type SystemLogEntry = {
  id: string
  recordId: string
  timestamp: string
  module: SystemLogModule
  action: SystemLogAction
  entity: string
  description: string
  actor: string
  tone: SystemLogTone
  amount?: number
  status?: string
}

type NewSystemLogEntry = Omit<SystemLogEntry, 'id' | 'timestamp'> & {
  timestamp?: string
}

const storageKey = 'adiel.system-logs'
export const systemLogsUpdatedEvent = 'adiel:system-logs-updated'
const maximumEntries = 1000

function isSystemLogEntry(value: unknown): value is SystemLogEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<SystemLogEntry>
  return typeof entry.id === 'string'
    && typeof entry.recordId === 'string'
    && typeof entry.timestamp === 'string'
    && typeof entry.module === 'string'
    && typeof entry.action === 'string'
    && typeof entry.entity === 'string'
    && typeof entry.description === 'string'
    && typeof entry.actor === 'string'
}

function readStoredLogs(): SystemLogEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isSystemLogEntry) : []
  } catch {
    return []
  }
}

function historicalEntries(): SystemLogEntry[] {
  const entries: SystemLogEntry[] = []

  try {
    const tasks: unknown = JSON.parse(window.localStorage.getItem('adiel.tasks') ?? '[]')
    if (Array.isArray(tasks)) {
      tasks.forEach((value) => {
        if (typeof value !== 'object' || value === null) return
        const task = value as Record<string, unknown>
        if (typeof task.id !== 'number' || typeof task.title !== 'string') return
        const date = typeof task.createdAt === 'string' ? task.createdAt : new Date().toISOString().slice(0, 10)
        entries.push({
          id: `historical-task-${task.id}`,
          recordId: String(task.id),
          timestamp: `${date}T09:00:00`,
          module: 'Tasks',
          action: 'Created',
          entity: task.title,
          description: `Task created and assigned to ${typeof task.assignedTo === 'string' ? task.assignedTo : 'the team'}.`,
          actor: typeof task.assignedBy === 'string' ? task.assignedBy : 'System import',
          tone: 'info',
          status: typeof task.status === 'string' ? task.status : undefined,
        })
      })
    }
  } catch {
    // Ignore malformed historical task data.
  }

  try {
    const expenses: unknown = JSON.parse(window.localStorage.getItem('adiel.expenses') ?? '[]')
    if (Array.isArray(expenses)) {
      expenses.forEach((value) => {
        if (typeof value !== 'object' || value === null) return
        const expense = value as Record<string, unknown>
        if (typeof expense.id !== 'number' || typeof expense.payee !== 'string') return
        const date = typeof expense.date === 'string' ? expense.date : new Date().toISOString().slice(0, 10)
        entries.push({
          id: `historical-expense-${expense.id}`,
          recordId: String(expense.id),
          timestamp: `${date}T10:00:00`,
          module: 'Expenses',
          action: 'Created',
          entity: expense.payee,
          description: typeof expense.description === 'string' ? expense.description : 'Expense transaction recorded.',
          actor: typeof expense.purchaser === 'string' ? expense.purchaser : 'System import',
          tone: expense.status === 'Overdue' ? 'warning' : 'success',
          amount: typeof expense.amount === 'number' ? expense.amount : undefined,
          status: typeof expense.status === 'string' ? expense.status : undefined,
        })
      })
    }
  } catch {
    // Ignore malformed historical expense data.
  }

  try {
    const items: unknown = JSON.parse(window.localStorage.getItem('adiel.items') ?? '[]')
    if (Array.isArray(items)) {
      items.forEach((value) => {
        if (typeof value !== 'object' || value === null) return
        const item = value as Record<string, unknown>
        if (typeof item.id !== 'string' || typeof item.name !== 'string') return
        const timestamp = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString()
        entries.push({
          id: `historical-item-${item.id}`,
          recordId: item.id,
          timestamp,
          module: 'Items',
          action: 'Created',
          entity: item.name,
          description: `${typeof item.category === 'string' ? item.category : 'Item'} added to the product catalog.`,
          actor: 'System import',
          tone: 'info',
          amount: typeof item.sellingPrice === 'number' ? item.sellingPrice : undefined,
          status: typeof item.status === 'string' ? item.status : undefined,
        })
      })
    }
  } catch {
    // Ignore malformed historical item data.
  }

  try {
    const suppliers: unknown = JSON.parse(window.localStorage.getItem('adiel.suppliers') ?? '[]')
    if (Array.isArray(suppliers)) {
      suppliers.forEach((value) => {
        if (typeof value !== 'object' || value === null) return
        const supplier = value as Record<string, unknown>
        if (typeof supplier.id !== 'string' || typeof supplier.name !== 'string') return
        const timestamp = typeof supplier.createdAt === 'string' ? supplier.createdAt : new Date().toISOString()
        entries.push({
          id: `historical-supplier-${supplier.id}`,
          recordId: supplier.id,
          timestamp,
          module: 'Suppliers',
          action: 'Created',
          entity: supplier.name,
          description: `${typeof supplier.type === 'string' ? supplier.type : 'Supplier'} added to the directory.`,
          actor: 'System import',
          tone: 'info',
          status: typeof supplier.status === 'string' ? supplier.status : undefined,
        })
      })
    }
  } catch {
    // Ignore malformed historical supplier data.
  }

  return entries
}

export function loadSystemLogs(): SystemLogEntry[] {
  const stored = readStoredLogs()
  const explicitlyCreated = new Set(stored.filter((entry) => entry.action === 'Created').map((entry) => `${entry.module}:${entry.recordId}`))
  const history = historicalEntries().filter((entry) => !explicitlyCreated.has(`${entry.module}:${entry.recordId}`))
  return [...stored, ...history].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export function appendSystemLog(entry: NewSystemLogEntry) {
  const nextEntry: SystemLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
  }
  const logs = [nextEntry, ...readStoredLogs()].slice(0, maximumEntries)
  window.localStorage.setItem(storageKey, JSON.stringify(logs))
  window.dispatchEvent(new CustomEvent(systemLogsUpdatedEvent, { detail: nextEntry }))
}
