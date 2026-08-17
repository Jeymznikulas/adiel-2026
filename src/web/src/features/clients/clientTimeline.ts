export type ClientTimelineKind = 'Quotation' | 'Sale' | 'SOA' | 'Payment' | 'Task'

export type ClientTimelineEntry = {
  id: string
  kind: ClientTimelineKind
  source: string
  date: string
  reference: string
  title: string
  description: string
  amount: number | null
  balance: number | null
  status: string
  href: string
}

export type ClientTimelineSummary = {
  salesValue: number
  collected: number
  outstanding: number
  recordCount: number
  openStatements: number
  paymentCount: number
}

type LinkedClient = { id: string; name: string }
type StoredRecord = Record<string, unknown>

function readRecords(key: string): StoredRecord[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is StoredRecord => typeof value === 'object' && value !== null && isActiveRecord(value)) : []
  } catch {
    return []
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function dateOnly(value: unknown) {
  return text(value).slice(0, 10)
}

function isLinked(record: StoredRecord, client: LinkedClient) {
  const clientId = text(record.clientId)
  if (clientId) return clientId === client.id
  const clientName = text(record.clientName).trim().toLowerCase()
  return Boolean(clientName) && clientName === client.name.trim().toLowerCase()
}

function quotationEntries(client: LinkedClient): ClientTimelineEntry[] {
  return readRecords('adiel.quotations').flatMap((quotation) => {
    if (!isLinked(quotation, client)) return []
    const id = text(quotation.id)
    const status = text(quotation.status) || 'For Approval'
    const isSale = status === 'Approved'
    const subject = text(quotation.subject) || 'No subject provided'
    const projectLocation = text(quotation.projectLocation)
    return [{
      id: `quotation-${id}`,
      kind: isSale ? 'Sale' : 'Quotation',
      source: isSale ? 'Sales' : 'Quotations',
      date: dateOnly(quotation.dateCreated) || dateOnly(quotation.createdAt),
      reference: text(quotation.quotationNumber) || 'Quotation',
      title: isSale ? `Approved sale · ${subject}` : subject,
      description: projectLocation || (isSale ? 'Approved quotation recorded as a sale' : 'Quotation record'),
      amount: number(quotation.totalAmount),
      balance: null,
      status,
      href: id ? `/quotations/${encodeURIComponent(id)}` : '/quotations',
    } satisfies ClientTimelineEntry]
  })
}

function statementEntries(client: LinkedClient): ClientTimelineEntry[] {
  return readRecords('adiel.statements-of-account').flatMap((statement) => {
    if (!isLinked(statement, client)) return []
    const id = text(statement.id)
    const soaNumber = text(statement.soaNumber) || 'Statement of Account'
    const status = text(statement.status) || 'Draft'
    const statementHref = id ? `/statement-of-account/${encodeURIComponent(id)}` : '/statement-of-account'
    const statementEntry: ClientTimelineEntry = {
      id: `soa-${id}`,
      kind: 'SOA',
      source: 'Statements of Account',
      date: dateOnly(statement.statementDate) || dateOnly(statement.createdAt),
      reference: soaNumber,
      title: 'Statement of Account issued',
      description: `Coverage ${dateOnly(statement.coverageFrom) || 'not set'} to ${dateOnly(statement.coverageTo) || 'not set'}`,
      amount: number(statement.openingBalance) + number(statement.totalCharges),
      balance: number(statement.balance),
      status,
      href: statementHref,
    }
    const payments = Array.isArray(statement.payments) ? statement.payments : []
    const paymentEntries = payments.flatMap((value): ClientTimelineEntry[] => {
      if (typeof value !== 'object' || value === null) return []
      const payment = value as StoredRecord
      const paymentId = text(payment.id)
      const method = text(payment.method) || 'Payment'
      const reference = text(payment.referenceNumber)
      return [{
        id: `payment-${id}-${paymentId}`,
        kind: 'Payment',
        source: 'Payments',
        date: dateOnly(payment.date) || dateOnly(payment.createdAt),
        reference: reference || soaNumber,
        title: `Payment received for ${soaNumber}`,
        description: reference ? `${method} · Reference ${reference}` : method,
        amount: number(payment.amount),
        balance: null,
        status: 'Received',
        href: statementHref,
      }]
    })
    return [statementEntry, ...paymentEntries]
  })
}

function taskEntries(client: LinkedClient): ClientTimelineEntry[] {
  return readRecords('adiel.tasks').flatMap((task) => {
    if (!isLinked(task, client)) return []
    const id = typeof task.id === 'string' || typeof task.id === 'number' ? String(task.id) : ''
    const dueDate = dateOnly(task.dueDate)
    return [{
      id: `task-${id}`,
      kind: 'Task',
      source: 'Tasks',
      date: dateOnly(task.createdAt) || dueDate,
      reference: id ? `TASK-${id}` : 'Task',
      title: text(task.title) || 'Client task',
      description: dueDate ? `Due ${dueDate}${text(task.assignedTo) ? ` · Assigned to ${text(task.assignedTo)}` : ''}` : text(task.description),
      amount: null,
      balance: null,
      status: text(task.status) || 'To do',
      href: '/tasks',
    } satisfies ClientTimelineEntry]
  })
}

export function loadClientTimeline(client: LinkedClient) {
  return [...quotationEntries(client), ...statementEntries(client), ...taskEntries(client)]
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
}

export function summarizeClientTimeline(entries: ClientTimelineEntry[]): ClientTimelineSummary {
  const activeStatements = entries.filter((entry) => entry.kind === 'SOA' && entry.status !== 'Cancelled')
  return {
    salesValue: entries.filter((entry) => entry.kind === 'Sale').reduce((total, entry) => total + (entry.amount ?? 0), 0),
    collected: entries.filter((entry) => entry.kind === 'Payment').reduce((total, entry) => total + (entry.amount ?? 0), 0),
    outstanding: activeStatements.reduce((total, entry) => total + (entry.balance ?? 0), 0),
    recordCount: entries.length,
    openStatements: activeStatements.filter((entry) => (entry.balance ?? 0) > 0).length,
    paymentCount: entries.filter((entry) => entry.kind === 'Payment').length,
  }
}
import { isActiveRecord } from '../../services/recordLifecycle'
