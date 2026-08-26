export type SystemLogModule = 'Tasks' | 'Items' | 'Expenses' | 'Suppliers' | 'Clients' | 'Quotations' | 'Purchase Orders' | 'Statements of Account'
export type SystemLogAction = 'Created' | 'Updated' | 'Deleted' | 'Archived' | 'Restored' | 'Soft deleted' | 'Voided' | 'Status changed' | 'Payment recorded' | 'Subtask added' | 'Subtask updated' | 'Subtask removed' | 'Added to Expenses' | 'Removed from Expenses'
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
    const expenses: unknown = JSON.parse(window.localStorage.getItem('__expenses_migrated_to_api__') ?? '[]')
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
