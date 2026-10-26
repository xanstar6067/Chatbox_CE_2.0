import { createMessage, type Session } from '@shared/types'
import type { UsageRecord } from '@shared/types/adapters'
import { describe, expect, it } from 'vitest'
import { addSpendingRecord, createSpendingStats, pruneSpendingMonths, sessionSpendingRecords } from './spending'

const now = new Date(2026, 9, 26, 12)
const record = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
  modelId: 'test/model',
  purpose: 'chat',
  timestamp: now.getTime(),
  sessionId: 'chat-a',
  sessionName: 'Chat A',
  inputTokens: 1000,
  outputTokens: 100,
  cost: { modelId: 'test/model', timestamp: now.getTime(), usd: 0.25 },
  ...overrides,
})

describe('spending statistics', () => {
  it('aggregates dollars and requests by day and chat, including free and unknown requests', () => {
    const state = createSpendingStats(now.getTime())
    addSpendingRecord(state, record(), now)
    addSpendingRecord(state, record({ cost: { modelId: 'test/model', timestamp: now.getTime(), usd: 0 } }), now)
    addSpendingRecord(state, record({ cost: undefined, sessionId: 'chat-b', sessionName: 'Chat B' }), now)
    addSpendingRecord(state, record({ sessionId: undefined, sessionName: undefined, purpose: 'other' }), now)
    const month = state.months['2026-10']
    expect(month.totals).toEqual({ usd: 0.5, requests: 4, pricedRequests: 3, unknownRequests: 1, totalTokens: 4400 })
    expect(month.days['26']).toEqual(month.totals)
    expect(month.chats['"chat-a"']).toMatchObject({ usd: 0.25, requests: 2, unknownRequests: 0, name: 'Chat A' })
    expect(month.chats.null).toMatchObject({ requests: 1, sessionId: undefined })
  })

  it('rotates complete month buckets without carrying expired chats or days into the new month', () => {
    const state = createSpendingStats(now.getTime())
    addSpendingRecord(state, record({ timestamp: new Date(2026, 8, 1).getTime(), sessionId: 'old' }), now)
    addSpendingRecord(state, record(), now)
    expect(addSpendingRecord(state, record({ timestamp: new Date(2026, 7, 31, 23, 59).getTime() }), now)).toBe(false)
    expect(addSpendingRecord(state, record({ timestamp: new Date(2026, 10, 1).getTime() }), now)).toBe(false)
    const november = new Date(2026, 10, 1)
    expect(pruneSpendingMonths(state, november)).toBe(true)
    expect(Object.keys(state.months)).toEqual(['2026-10'])
    addSpendingRecord(state, record({ timestamp: november.getTime(), sessionId: 'new' }), november)
    expect(Object.values(state.months['2026-11'].chats).map((chat) => chat.sessionId)).toEqual(['new'])
    expect(state.months['2026-11'].totals.requests).toBe(1)
    expect(Object.keys(state.months['2026-11'].days)).toEqual(['1'])
    expect(pruneSpendingMonths(state, november)).toBe(false)
    expect(pruneSpendingMonths(state, new Date(2027, 1, 1))).toBe(true)
    expect(state.months).toEqual({})
  })

  it('keeps December when the year changes and guards malformed usage', () => {
    const january = new Date(2027, 0, 1)
    const state = createSpendingStats(january.getTime())
    expect(
      addSpendingRecord(state, record({ timestamp: new Date(2026, 11, 31).getTime(), sessionId: '__proto__' }), january)
    ).toBe(true)
    expect(addSpendingRecord(state, record({ timestamp: Number.NaN }), january)).toBe(false)
    addSpendingRecord(
      state,
      record({
        timestamp: january.getTime(),
        totalTokens: Number.NaN,
        cost: { modelId: 'x', timestamp: 1, usd: Number.NaN },
      }),
      january
    )
    expect(state.months['2027-01'].totals).toMatchObject({ usd: 0, unknownRequests: 1, totalTokens: 0 })
    expect(pruneSpendingMonths(state, january)).toBe(false)
    expect(Object.values(state.months['2026-12'].chats)[0].sessionId).toBe('__proto__')
  })

  it('imports saved costs and retries once, deduplicates forks and excludes already tracked live requests', () => {
    const oldCost = { modelId: 'test/model', timestamp: 100, usd: 0.25 }
    const liveCost = { modelId: 'test/model', timestamp: 300, usd: 0.5 }
    const reply = { ...createMessage('assistant', 'reply'), costs: [oldCost, liveCost], previousCosts: [oldCost] }
    const unpriced = {
      ...createMessage('assistant', 'old'),
      timestamp: 100,
      usage: { inputTokens: 10, outputTokens: 5 },
    }
    const session = {
      id: 'chat-a',
      name: 'Chat A',
      messages: [reply, unpriced],
      threads: [{ messages: [reply] }],
      messageForksHash: { fork: { lists: [{ messages: [reply] }] } },
    } as unknown as Session
    const seen = new Set<string>()
    const records = sessionSpendingRecords(session, 200, seen)
    expect(records).toHaveLength(3)
    expect(records.filter((record) => record.cost).map((record) => record.cost?.usd)).toEqual([0.25, 0.25])
    expect(records[2]).toMatchObject({ sessionId: 'chat-a', sessionName: 'Chat A', inputTokens: 10, outputTokens: 5 })
    expect(sessionSpendingRecords(session, 200, seen)).toEqual([])
  })
})
