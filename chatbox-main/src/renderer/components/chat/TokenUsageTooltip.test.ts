import { describe, expect, it } from 'vitest'
import { getTokenUsageBreakdown } from './TokenUsageTooltip'

describe('getTokenUsageBreakdown', () => {
  it('splits input tokens by prompt cache usage', () => {
    const breakdown = getTokenUsageBreakdown({
      inputTokens: 10_000,
      outputTokens: 500,
      totalTokens: 10_500,
      reasoningTokens: 120,
      inputTokenDetails: { noCacheTokens: 1_000, cacheReadTokens: 8_500, cacheWriteTokens: 500 },
    })

    expect(breakdown).toEqual({
      inputTokens: 10_000,
      outputTokens: 500,
      reasoningTokens: 120,
      totalTokens: 10_500,
      cacheReadTokens: 8_500,
      cacheWriteTokens: 500,
      uncachedTokens: 1_000,
      cacheHitRatio: 0.85,
    })
  })

  it('falls back to the deprecated cachedInputTokens field and derives uncached tokens', () => {
    const breakdown = getTokenUsageBreakdown({ inputTokens: 2_000, totalTokens: 2_100, cachedInputTokens: 1_500 })

    expect(breakdown.cacheReadTokens).toBe(1_500)
    expect(breakdown.uncachedTokens).toBe(500)
    expect(breakdown.cacheHitRatio).toBe(0.75)
  })

  it('reports a cache write without hits as 0% from cache', () => {
    const breakdown = getTokenUsageBreakdown({
      inputTokens: 4_000,
      inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 3_800 },
    })

    expect(breakdown.cacheHitRatio).toBe(0)
    expect(breakdown.uncachedTokens).toBe(200)
  })

  it('leaves cache fields empty when the provider reported no cache data', () => {
    const breakdown = getTokenUsageBreakdown({ inputTokens: 300, outputTokens: 20 }, 320)

    expect(breakdown.totalTokens).toBe(320)
    expect(breakdown.cacheHitRatio).toBeUndefined()
    expect(breakdown.uncachedTokens).toBeUndefined()
  })

  it('uses the fallback total for messages without usage', () => {
    expect(getTokenUsageBreakdown(undefined, 42)).toMatchObject({ totalTokens: 42, cacheHitRatio: undefined })
  })
})
