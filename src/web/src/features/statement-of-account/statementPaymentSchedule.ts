import type { PaymentFrequency, PaymentScheduleEntry } from './statementOfAccountTypes'

export type ScheduleProgress = PaymentScheduleEntry & {
  amountPaid: number
  balance: number
  status: 'Paid' | 'Partially paid' | 'Due today' | 'Grace period' | 'Overdue' | 'Upcoming'
  graceEndDate: string
  daysLate: number
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayDifference(from: string, to: string) {
  return Math.max(0, Math.floor((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000))
}

export function addFrequency(dateValue: string, frequency: PaymentFrequency, index: number) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (frequency === 'Weekly') date.setDate(date.getDate() + index * 7)
  else if (frequency === 'Every 2 weeks') date.setDate(date.getDate() + index * 14)
  else if (frequency === 'Quarterly') date.setMonth(date.getMonth() + index * 3)
  else date.setMonth(date.getMonth() + index)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generatePaymentSchedule(totalAmount: number, count: number, firstDueDate: string, frequency: PaymentFrequency): PaymentScheduleEntry[] {
  const safeCount = Math.min(12, Math.max(2, Math.round(count) || 2))
  const totalCents = Math.round(Math.max(0, totalAmount) * 100)
  const baseCents = Math.floor(totalCents / safeCount)
  return Array.from({ length: safeCount }, (_, index) => ({
    id: crypto.randomUUID(),
    label: `Installment ${index + 1} of ${safeCount}`,
    dueDate: addFrequency(firstDueDate, frequency, index),
    amount: (index === safeCount - 1 ? totalCents - baseCents * (safeCount - 1) : baseCents) / 100,
  }))
}

export function getScheduleProgress(schedule: PaymentScheduleEntry[], totalPayments: number, today = new Date().toISOString().slice(0, 10), graceDays = 0): ScheduleProgress[] {
  let unappliedPayment = Math.max(0, totalPayments)
  return [...schedule].sort((left, right) => left.dueDate.localeCompare(right.dueDate)).map((entry) => {
    const amountPaid = Math.min(entry.amount, unappliedPayment)
    unappliedPayment = Math.max(0, unappliedPayment - amountPaid)
    const balance = Math.max(0, entry.amount - amountPaid)
    const entryGraceDays = entry.lateChargePolicy?.graceDays ?? graceDays
    const graceEndDate = addDays(entry.dueDate, Math.max(0, Math.round(entryGraceDays)))
    const status = balance <= 0.009 ? 'Paid' : entry.dueDate === today ? 'Due today' : entry.dueDate < today && today <= graceEndDate ? 'Grace period' : graceEndDate < today ? 'Overdue' : amountPaid > 0 ? 'Partially paid' : 'Upcoming'
    return { ...entry, amountPaid, balance, status, graceEndDate, daysLate: entry.dueDate < today ? dayDifference(entry.dueDate, today) : 0 }
  })
}

export function getNextScheduleEntry(schedule: PaymentScheduleEntry[], totalPayments: number) {
  return getScheduleProgress(schedule, totalPayments).find((entry) => entry.balance > 0.009)
}
