export type StatementStatus = 'Draft' | 'Issued' | 'Partially Settled' | 'Settled' | 'Overdue' | 'Cancelled'
export type PaymentArrangement = 'Full payment' | 'Installment' | 'Custom schedule'
export type PaymentFrequency = 'Weekly' | 'Every 2 weeks' | 'Monthly' | 'Quarterly' | 'Custom'
export type LateChargeType = 'Percentage' | 'Fixed amount'

export type LateChargePolicy = {
  enabled: boolean
  graceDays: number
  type: LateChargeType
  value: number
}

export type PaymentScheduleEntry = {
  id: string
  label: string
  dueDate: string
  amount: number
  lateChargePolicy?: LateChargePolicy
}

export type StatementItem = {
  id: string
  quotationId: string
  quotationNumber: string
  itemId: string
  variantId: string
  photo: string
  itemName: string
  variantLabel: string
  productCode: string
  unitOfMeasure: string
  quantity: number
  unitPrice: number
  amount: number
}

export type StatementQuotation = {
  id: string
  quotationNumber: string
  dateCreated: string
  subject: string
  projectLocation: string
  subtotalAmount: number
  vatEnabled: boolean
  vatAmount: number
  otherCharges: Array<{ id: string; label: string; amount: number }>
  totalAmount: number
  items: StatementItem[]
}

export type StatementPayment = {
  id: string
  date: string
  amount: number
  method: string
  referenceNumber: string
  notes: string
  principalAmount: number
  lateChargeAmount: number
  createdAt: string
}

export type StatementLateCharge = {
  id: string
  scheduleEntryId: string
  appliedDate: string
  type: LateChargeType
  rateValue: number
  calculatedAmount: number
  amount: number
  status: 'Applied' | 'Waived'
  reason: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type StatementOfAccount = {
  id: string
  soaNumber: string
  statementDate: string
  coverageFrom: string
  coverageTo: string
  dueDate: string
  clientId: string
  clientName: string
  contactPerson: string
  quotations: StatementQuotation[]
  openingBalance: number
  totalCharges: number
  payments: StatementPayment[]
  totalPayments: number
  balance: number
  paymentArrangement: PaymentArrangement
  paymentFrequency: PaymentFrequency
  paymentSchedule: PaymentScheduleEntry[]
  lateChargePolicy: LateChargePolicy
  lateCharges: StatementLateCharge[]
  status: StatementStatus
  notes: string
  terms: string
  createdAt: string
  updatedAt: string
}
