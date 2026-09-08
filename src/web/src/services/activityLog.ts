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

export const systemLogsUpdatedEvent = 'adiel:system-logs-updated'

export function loadSystemLogs(): SystemLogEntry[] {
  return []
}

export function appendSystemLog(entry: NewSystemLogEntry) {
  const nextEntry: SystemLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
  }
  window.dispatchEvent(new CustomEvent(systemLogsUpdatedEvent, { detail: nextEntry }))
}
