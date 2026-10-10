import type { UsageRecord } from '@shared/types/adapters'
import { describe, expect, it } from 'vitest'
import {
  addUsageRecord,
  cacheShare,
  createUsageStatsState,
  daysInMonth,
  modelLabelFromDisplayName,
  monthKey,
  previousMonthKey,
  pruneUsageMonths,
  summarizeMonth,
} from './aggregate'

const now = new Date(2026, 9, 10, 12) // 10 October 2026

function record(overrides: Partial<UsageRecord>): UsageRecord {
  return {
    provider: 'openrouter',
    modelId: 'anthropic/claude-opus-5',
    modelLabel: 'Claude Opus 5',
    purpose: 'chat',
    timestamp: new Date(2026, 9, 3, 9).getTime(),
    inputTokens: 1000,
    outputTokens: 200,
    totalTokens: 1200,
    cacheReadTokens: 800,
    cacheWriteTokens: 100,
    ...overrides,
  }
}

describe('usage statistics aggregation', () => {
  it('keys months and days in local time', () => {
    expect(monthKey(now)).toBe('2026-10')
    expect(previousMonthKey(now)).toBe('2026-09')
    expect(previousMonthKey(new Date(2026, 0, 15))).toBe('2025-12')
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2026-10')).toBe(31)
  })

  it('summarizes requests and tokens by day, purpose and model', () => {
    const state = createUsageStatsState(now.getTime())
    addUsageRecord(state, record({}), now)
    addUsageRecord(state, record({ cacheReadTokens: 0, cacheWriteTokens: 0 }), now)
    addUsageRecord(
      state,
      record({ purpose: 'other', modelLabel: undefined, modelId: 'gpt-mini', provider: 'openai', totalTokens: 0 }),
      now
    )

    const summary = summarizeMonth('2026-10', state.months['2026-10'])

    expect(summary.totals).toMatchObject({ requests: 3, inputTokens: 3000, totalTokens: 3600, cacheReadTokens: 1600 })
    expect(summary.byPurpose.chat.requests).toBe(2)
    expect(summary.byPurpose.other).toMatchObject({ requests: 1, totalTokens: 1200 })
    expect(summary.byDay).toHaveLength(31)
    expect(summary.byDay[2].requests).toBe(3)
    expect(summary.byModel.map((row) => [row.provider, row.model, row.requests])).toEqual([
      ['openrouter', 'Claude Opus 5', 2],
      ['openai', 'gpt-mini', 1],
    ])
    expect(cacheShare(summary.totals)).toBeCloseTo(1600 / 3000)
  })

  it('ignores records older than the previous month and prunes old months', () => {
    const state = createUsageStatsState(now.getTime())
    expect(addUsageRecord(state, record({ timestamp: new Date(2026, 7, 31).getTime() }), now)).toBe(false)
    expect(addUsageRecord(state, record({ timestamp: new Date(2026, 8, 1).getTime() }), now)).toBe(true)
    state.months['2026-07'] = {}

    expect(pruneUsageMonths(state, now)).toBe(true)
    expect(Object.keys(state.months)).toEqual(['2026-09'])
  })

  it('keeps model labels of imported and live records consistent', () => {
    expect(modelLabelFromDisplayName('OpenRouter API (Claude Opus 5)')).toBe('Claude Opus 5')
    expect(modelLabelFromDisplayName('gpt-4o')).toBe('gpt-4o')
    expect(modelLabelFromDisplayName(undefined)).toBe('unknown')
  })
})
