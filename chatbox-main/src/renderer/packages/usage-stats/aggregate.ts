import type { UsagePurpose, UsageRecord } from '@shared/types/adapters'

export interface UsageCounters {
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** Counters of one month, keyed by `day|purpose|provider|model`. */
export type UsageMonthBuckets = Record<string, UsageCounters>

export interface UsageStatsState {
  version: 1
  /** When live recording started; history import only covers messages before it. */
  trackingStartedAt: number
  historyImported: boolean
  /** Only the current and the previous month are kept, keyed `YYYY-MM`. */
  months: Record<string, UsageMonthBuckets>
}

export interface UsageBreakdownRow extends UsageCounters {
  provider: string
  model: string
}

export interface UsageMonthSummary {
  month: string
  totals: UsageCounters
  byPurpose: Record<UsagePurpose, UsageCounters>
  byModel: UsageBreakdownRow[]
  /** One entry per calendar day of the month, index 0 = day 1. */
  byDay: UsageCounters[]
}

const SEPARATOR = '|'

export function emptyCounters(): UsageCounters {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

export function createUsageStatsState(now: number): UsageStatsState {
  return { version: 1, trackingStartedAt: now, historyImported: false, months: {} }
}

const pad = (value: number) => String(value).padStart(2, '0')

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function previousMonthKey(date: Date): string {
  return monthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1))
}

/** Start of the previous month: the oldest moment the statistics cover. */
export function retentionStart(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function addCounters(target: UsageCounters, source: Partial<UsageCounters>) {
  target.requests += source.requests ?? 0
  target.inputTokens += source.inputTokens ?? 0
  target.outputTokens += source.outputTokens ?? 0
  target.totalTokens += source.totalTokens ?? 0
  target.reasoningTokens += source.reasoningTokens ?? 0
  target.cacheReadTokens += source.cacheReadTokens ?? 0
  target.cacheWriteTokens += source.cacheWriteTokens ?? 0
}

/** Adds one request to the state in place. Records outside the retention window are ignored. */
export function addUsageRecord(state: UsageStatsState, record: UsageRecord, now = new Date()): boolean {
  if (record.timestamp < retentionStart(now)) {
    return false
  }
  const date = new Date(record.timestamp)
  const month = monthKey(date)
  const model = record.modelLabel || record.modelId || 'unknown'
  const key = [pad(date.getDate()), record.purpose, record.provider || 'unknown', model].join(SEPARATOR)
  if (!state.months[month]) {
    state.months[month] = {}
  }
  const buckets = state.months[month]
  if (!buckets[key]) {
    buckets[key] = emptyCounters()
  }
  const counters = buckets[key]
  const input = record.inputTokens ?? 0
  const output = record.outputTokens ?? 0
  addCounters(counters, {
    requests: 1,
    inputTokens: input,
    outputTokens: output,
    totalTokens: record.totalTokens || input + output,
    reasoningTokens: record.reasoningTokens,
    cacheReadTokens: record.cacheReadTokens,
    cacheWriteTokens: record.cacheWriteTokens,
  })
  return true
}

/** Drops months older than the previous one. Returns true when something was removed. */
export function pruneUsageMonths(state: UsageStatsState, now = new Date()): boolean {
  const keep = new Set([monthKey(now), previousMonthKey(now)])
  let changed = false
  for (const month of Object.keys(state.months)) {
    if (!keep.has(month)) {
      delete state.months[month]
      changed = true
    }
  }
  return changed
}

export function summarizeMonth(month: string, buckets: UsageMonthBuckets | undefined): UsageMonthSummary {
  const totals = emptyCounters()
  const byPurpose: Record<UsagePurpose, UsageCounters> = { chat: emptyCounters(), other: emptyCounters() }
  const byDay = Array.from({ length: daysInMonth(month) }, emptyCounters)
  const byModel = new Map<string, UsageBreakdownRow>()

  for (const [key, counters] of Object.entries(buckets ?? {})) {
    const [day, purpose, provider, ...modelParts] = key.split(SEPARATOR)
    const model = modelParts.join(SEPARATOR)
    addCounters(totals, counters)
    addCounters(byPurpose[purpose === 'chat' ? 'chat' : 'other'], counters)
    const dayCounters = byDay[Number(day) - 1]
    if (dayCounters) addCounters(dayCounters, counters)
    const modelKey = `${provider}${SEPARATOR}${model}`
    let row = byModel.get(modelKey)
    if (!row) {
      row = { provider, model, ...emptyCounters() }
      byModel.set(modelKey, row)
    }
    addCounters(row, counters)
  }

  return {
    month,
    totals,
    byPurpose,
    byDay,
    byModel: [...byModel.values()].sort((a, b) => b.totalTokens - a.totalTokens || b.requests - a.requests),
  }
}

/** Share of input tokens that were read from the prompt cache (0..1). */
export function cacheShare(counters: UsageCounters): number {
  return counters.inputTokens > 0 ? Math.min(1, counters.cacheReadTokens / counters.inputTokens) : 0
}

/**
 * Saved messages only keep the display name, e.g. "OpenRouter API (Claude Opus 5)".
 * Use the part in parentheses so imported and live entries share the model label.
 */
export function modelLabelFromDisplayName(displayName: string | undefined): string {
  if (!displayName) {
    return 'unknown'
  }
  const match = displayName.match(/\(([^()]+)\)\s*$/)
  return (match ? match[1] : displayName).trim()
}
