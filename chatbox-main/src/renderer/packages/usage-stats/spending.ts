import type { Message, Session } from '@shared/types'
import type { UsageRecord } from '@shared/types/adapters'
import { monthKey, previousMonthKey } from './aggregate'

export interface SpendingCounters {
  usd: number
  requests: number
  pricedRequests: number
  unknownRequests: number
  totalTokens: number
}

export interface ChatSpending extends SpendingCounters {
  sessionId?: string
  name?: string
  lastRequestAt: number
}

export interface SpendingMonth {
  totals: SpendingCounters
  days: Record<string, SpendingCounters>
  chats: Record<string, ChatSpending>
}

export interface SpendingStats {
  version: 1
  trackingStartedAt: number
  historyImported: boolean
  months: Record<string, SpendingMonth>
}

export const emptySpending = (): SpendingCounters => ({
  usd: 0,
  requests: 0,
  pricedRequests: 0,
  unknownRequests: 0,
  totalTokens: 0,
})

export function createSpendingStats(now = Date.now()): SpendingStats {
  return { version: 1, trackingStartedAt: now, historyImported: false, months: {} }
}

export function emptySpendingMonth(): SpendingMonth {
  return { totals: emptySpending(), days: {}, chats: {} }
}

/** Whole calendar-month buckets rotate; chat and daily data expire together. */
export function pruneSpendingMonths(stats: SpendingStats, now = new Date()): boolean {
  const keep = new Set([monthKey(now), previousMonthKey(now)])
  let changed = false
  for (const month of Object.keys(stats.months)) {
    if (!keep.has(month)) {
      delete stats.months[month]
      changed = true
    }
  }
  return changed
}

export function addSpendingRecord(stats: SpendingStats, record: UsageRecord, now = new Date()): boolean {
  if (!Number.isFinite(record.timestamp)) return false
  const date = new Date(record.timestamp)
  const month = monthKey(date)
  if (month !== monthKey(now) && month !== previousMonthKey(now)) return false
  stats.months[month] ??= emptySpendingMonth()
  const bucket = stats.months[month]
  bucket.days[String(date.getDate())] ??= emptySpending()
  const day = bucket.days[String(date.getDate())]
  // JSON quoting also prevents imported IDs like "__proto__" from becoming object property setters.
  const chatKey = JSON.stringify(record.sessionId ?? null)
  bucket.chats[chatKey] ??= {
    ...emptySpending(),
    sessionId: record.sessionId,
    name: record.sessionName,
    lastRequestAt: record.timestamp,
  }
  const chat = bucket.chats[chatKey]
  if (record.sessionName && record.timestamp >= chat.lastRequestAt) chat.name = record.sessionName
  chat.lastRequestAt = Math.max(chat.lastRequestAt, record.timestamp)
  const amount = record.cost?.usd
  const known = amount !== undefined && Number.isFinite(amount) && amount >= 0
  const tokens = record.totalTokens ?? (record.inputTokens ?? 0) + (record.outputTokens ?? 0)
  for (const counters of [bucket.totals, day, chat]) {
    counters.requests++
    counters.usd += known ? amount : 0
    counters.pricedRequests += known ? 1 : 0
    counters.unknownRequests += known ? 0 : 1
    counters.totalTokens += Number.isFinite(tokens) && tokens >= 0 ? tokens : 0
  }
  return true
}

/** Import saved tariffs, never recalculate historical messages with today's prices. */
export function sessionSpendingRecords(session: Session, before: number, seen: Set<string>): UsageRecord[] {
  const messages: Message[] = [
    ...session.messages,
    ...(session.threads ?? []).flatMap((thread) => thread.messages),
    ...Object.values(session.messageForksHash ?? {}).flatMap((fork) => fork.lists.flatMap((list) => list.messages)),
  ]
  const records: UsageRecord[] = []
  for (const message of messages) {
    if (message.role !== 'assistant' || seen.has(message.id)) continue
    seen.add(message.id)
    const costs = [...(message.costs ?? []), ...(message.previousCosts ?? [])]
    for (const cost of costs) {
      if (cost.timestamp >= before) continue
      records.push({ ...cost, cost, sessionId: session.id, sessionName: session.name, purpose: 'chat' })
    }
    // Old replies can have usage without a price. Keep them visible as unknown spending.
    if (
      !message.costs?.length &&
      !message.generating &&
      message.usage &&
      message.timestamp !== undefined &&
      message.timestamp < before
    ) {
      records.push({
        ...message.usage,
        modelId: message.contextUsage?.modelId ?? message.model ?? 'unknown',
        provider: message.aiProvider,
        timestamp: message.timestamp,
        sessionId: session.id,
        sessionName: session.name,
        purpose: 'chat',
      })
    }
  }
  return records
}
