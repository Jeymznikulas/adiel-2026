export type RecordLifecycle = {
  archivedAt?: string
  archivedBy?: string
  deletedAt?: string
  deletedBy?: string
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
}

export type LifecycleRecord = RecordLifecycle & { id: string | number }

export function isActiveRecord(record: unknown) {
  if (!record || typeof record !== 'object') return false
  const lifecycle = record as RecordLifecycle
  return !lifecycle.archivedAt && !lifecycle.deletedAt
}

export function isArchivedRecord(record: unknown) {
  if (!record || typeof record !== 'object') return false
  const lifecycle = record as RecordLifecycle
  return Boolean(lifecycle.archivedAt) && !lifecycle.deletedAt
}

export function isSoftDeletedRecord(record: unknown) {
  if (!record || typeof record !== 'object') return false
  return Boolean((record as RecordLifecycle).deletedAt)
}

export function withArchived<T extends object>(record: T, actor: string): T & RecordLifecycle {
  return { ...record, archivedAt: new Date().toISOString(), archivedBy: actor, deletedAt: undefined, deletedBy: undefined }
}

export function withRestored<T extends object>(record: T): T & RecordLifecycle {
  return { ...record, archivedAt: undefined, archivedBy: undefined, deletedAt: undefined, deletedBy: undefined }
}

export function withSoftDeleted<T extends object>(record: T, actor: string): T & RecordLifecycle {
  return { ...record, deletedAt: new Date().toISOString(), deletedBy: actor }
}

export function withVoided<T extends object>(record: T, actor: string, reason: string): T & RecordLifecycle {
  return { ...record, voidedAt: new Date().toISOString(), voidedBy: actor, voidReason: reason.trim() }
}

export const lifecycleChangedEvent = 'adiel:lifecycle-changed'

export function notifyLifecycleChanged() {
  window.dispatchEvent(new Event(lifecycleChangedEvent))
}
