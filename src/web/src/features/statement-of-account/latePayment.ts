import { getScheduleProgress, type ScheduleProgress } from './statementPaymentSchedule'
import type { LateChargePolicy, StatementLateCharge, StatementOfAccount, StatementStatus } from './statementOfAccountTypes'

export type LateChargeProgress = StatementLateCharge & {
  paidAmount: number
  balance: number
}

export type CollectionRow = {
  id: string
  statement: StatementOfAccount
  schedule: ScheduleProgress
  lateCharge: LateChargeProgress | null
  suggestedLateCharge: number
  totalDue: number
}

export function normalizeLateChargePolicy(policy?: Partial<LateChargePolicy> | null): LateChargePolicy {
  return {
    enabled: typeof policy?.enabled === 'boolean' ? policy.enabled : false,
    graceDays: typeof policy?.graceDays === 'number' && Number.isFinite(policy.graceDays) ? Math.max(0, Math.min(90, Math.round(policy.graceDays))) : 3,
    type: policy?.type === 'Fixed amount' ? 'Fixed amount' : 'Percentage',
    value: typeof policy?.value === 'number' && Number.isFinite(policy.value) ? Math.max(0, policy.value) : 0,
  }
}

export function principalPayments(statement: StatementOfAccount) {
  return statement.payments.reduce((total, payment) => total + (typeof payment.principalAmount === 'number' ? payment.principalAmount : payment.amount), 0)
}

export function lateChargePayments(statement: StatementOfAccount) {
  return statement.payments.reduce((total, payment) => total + (typeof payment.lateChargeAmount === 'number' ? payment.lateChargeAmount : 0), 0)
}

export function lateChargeProgress(statement: StatementOfAccount): LateChargeProgress[] {
  let unappliedPayments = lateChargePayments(statement)
  return [...statement.lateCharges].filter((charge) => charge.status === 'Applied').sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((charge) => {
    const paidAmount = Math.min(charge.amount, unappliedPayments)
    unappliedPayments = Math.max(0, unappliedPayments - paidAmount)
    return { ...charge, paidAmount, balance: Math.max(0, charge.amount - paidAmount) }
  })
}

export function statementFinancials(statement: StatementOfAccount) {
  const principalTotal = statement.openingBalance + statement.totalCharges
  const principalPaid = principalPayments(statement)
  const principalBalance = Math.max(0, principalTotal - principalPaid)
  const chargeTotal = statement.lateCharges.filter((charge) => charge.status === 'Applied').reduce((total, charge) => total + charge.amount, 0)
  const chargePaid = lateChargePayments(statement)
  const chargeBalance = Math.max(0, chargeTotal - chargePaid)
  return { principalTotal, principalPaid, principalBalance, chargeTotal, chargePaid, chargeBalance, totalBalance: principalBalance + chargeBalance, totalPayments: principalPaid + chargePaid }
}

export function statementScheduleProgress(statement: StatementOfAccount, today = new Date().toISOString().slice(0, 10)) {
  return getScheduleProgress(statement.paymentSchedule, principalPayments(statement), today, normalizeLateChargePolicy(statement.lateChargePolicy).graceDays)
}

export function scheduleLateChargePolicy(statement: StatementOfAccount, schedule: ScheduleProgress | { lateChargePolicy?: Partial<LateChargePolicy> }) {
  return normalizeLateChargePolicy(schedule.lateChargePolicy ?? statement.lateChargePolicy)
}

export function suggestedLateCharge(balance: number, policy: LateChargePolicy) {
  if (!policy.enabled || balance <= 0 || policy.value <= 0) return 0
  const amount = policy.type === 'Percentage' ? balance * (policy.value / 100) : policy.value
  return Math.round(amount * 100) / 100
}

export function paymentAllocation(statement: StatementOfAccount, amount: number) {
  const financials = statementFinancials(statement)
  const lateChargeAmount = Math.min(Math.max(0, amount), financials.chargeBalance)
  const principalAmount = Math.min(Math.max(0, amount - lateChargeAmount), financials.principalBalance)
  return { lateChargeAmount, principalAmount, unallocatedAmount: Math.max(0, amount - lateChargeAmount - principalAmount) }
}

export function effectiveStatementStatus(statement: StatementOfAccount, today = new Date().toISOString().slice(0, 10)): StatementStatus {
  if (statement.status === 'Cancelled' || statement.status === 'Draft') return statement.status
  if (statementFinancials(statement).totalBalance <= 0.009) return 'Settled'
  if (statementScheduleProgress(statement, today).some((entry) => entry.status === 'Overdue')) return 'Overdue'
  if (statement.payments.length) return 'Partially Settled'
  return statement.status === 'Overdue' ? 'Issued' : statement.status
}

export function collectionRows(statements: StatementOfAccount[], today = new Date().toISOString().slice(0, 10)): CollectionRow[] {
  return statements.flatMap((statement) => {
    if (statement.status === 'Draft' || statement.status === 'Cancelled') return []
    const charges = lateChargeProgress(statement)
    return statementScheduleProgress(statement, today).filter((schedule) => schedule.balance > 0.009).map((schedule) => {
      const policy = scheduleLateChargePolicy(statement, schedule)
      const lateCharge = charges.find((charge) => charge.scheduleEntryId === schedule.id) ?? null
      const reviewed = statement.lateCharges.some((charge) => charge.scheduleEntryId === schedule.id)
      const suggestion = schedule.status === 'Overdue' && !reviewed ? suggestedLateCharge(schedule.balance, policy) : 0
      return { id: `${statement.id}-${schedule.id}`, statement, schedule, lateCharge, suggestedLateCharge: suggestion, totalDue: schedule.balance + (lateCharge?.balance ?? 0) }
    })
  }).sort((left, right) => left.schedule.dueDate.localeCompare(right.schedule.dueDate) || left.statement.clientName.localeCompare(right.statement.clientName))
}
