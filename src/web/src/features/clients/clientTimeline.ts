import type { ClientTimelineEntry as ApiClientTimelineEntry, ClientTimelineSummary as ApiClientTimelineSummary } from '../../services/api/clients'

export type ClientTimelineKind = ApiClientTimelineEntry['kind']

export type ClientTimelineEntry = Omit<ApiClientTimelineEntry, 'occurredAt'> & {
  date: string
}

export type ClientTimelineSummary = ApiClientTimelineSummary

export function mapClientTimeline(entries: ApiClientTimelineEntry[]): ClientTimelineEntry[] {
  return entries.map(({ occurredAt, ...entry }) => ({ ...entry, date: occurredAt.slice(0, 10) }))
}

export function emptyClientTimelineSummary(): ClientTimelineSummary {
  return { salesValue: 0, collected: 0, outstanding: 0, recordCount: 0, openStatements: 0, paymentCount: 0 }
}
