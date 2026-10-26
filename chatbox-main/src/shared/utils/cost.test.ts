import { describe, expect, it } from 'vitest'
import { MessageSchema } from '../types/session'
import { ProviderModelInfoSchema } from '../types/settings'
import { calculateRequestCost, formatCost, type ModelPricing, parseOpenRouterPricing, summarizeCosts } from './cost'

const pricing: ModelPricing = {
  input: 2,
  output: 10,
  cacheRead: 0.2,
  cacheWrite: 2.5,
  requestUSD: 0.01,
  source: 'manual',
  updatedAt: 1,
}
const usage = { modelId: 'test/model', provider: 'test', timestamp: 1, inputTokens: 1000, outputTokens: 100 }

describe('chat cost calculation', () => {
  it('charges uncached input, cache reads, cache writes and output once per request', () => {
    const cost = calculateRequestCost({ ...usage, cacheReadTokens: 600, cacheWriteTokens: 100 }, pricing)
    expect(cost.usd).toBeCloseTo(0.01197)
    expect(summarizeCosts([cost, cost]).usd).toBeCloseTo(0.02394)
  })

  it('keeps a tariff snapshot when prices change later', () => {
    const rate = { ...pricing }
    const cost = calculateRequestCost(usage, rate)
    rate.input = 1000
    expect(cost.pricing?.input).toBe(2)
    expect(cost.usd).toBeCloseTo(0.013)
  })

  it('distinguishes free models, unknown prices and missing usage', () => {
    expect(calculateRequestCost(usage, { ...pricing, input: 0, output: 0, requestUSD: 0 }).usd).toBe(0)
    expect(calculateRequestCost(usage).usd).toBeUndefined()
    expect(calculateRequestCost({ ...usage, inputTokens: undefined }, pricing).usd).toBeUndefined()
    expect(
      calculateRequestCost({ ...usage, cacheReadTokens: 500 }, { ...pricing, cacheRead: undefined }).usd
    ).toBeUndefined()
    const summary = summarizeCosts([calculateRequestCost(usage), calculateRequestCost(usage, pricing)])
    expect(summary).toMatchObject({ known: 1, unknown: 1 })
    expect(summary.usd).toBeCloseTo(0.013)
  })

  it('rejects inconsistent and non-finite token counts', () => {
    for (const inputTokens of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateRequestCost({ ...usage, inputTokens }, pricing).usd).toBeUndefined()
    }
    expect(calculateRequestCost({ ...usage, cacheReadTokens: 1001 }, pricing).usd).toBeUndefined()
  })

  it('converts OpenRouter per-token prices, including zero and optional cache fees', () => {
    expect(
      parseOpenRouterPricing(
        { prompt: '0.000002', completion: '0.00001', input_cache_read: '0', request: '0.01' },
        'test/model',
        1
      )
    ).toEqual({
      input: 2,
      output: 10,
      cacheRead: 0,
      cacheWrite: undefined,
      requestUSD: 0.01,
      source: 'openrouter',
      modelId: 'test/model',
      updatedAt: 1,
    })
    for (const invalid of ['', '-1', 'NaN', null, 'Infinity']) {
      expect(parseOpenRouterPricing({ prompt: invalid, completion: '0' }, 'test/model')).toBeUndefined()
    }
    expect(parseOpenRouterPricing({ prompt: '0' }, 'test/model')).toBeUndefined()
  })

  it('retains prices and request costs through persisted schema parsing', () => {
    const cost = calculateRequestCost(usage, pricing)
    const message = MessageSchema.parse({
      id: 'reply',
      role: 'assistant',
      contentParts: [],
      costs: [cost],
      previousCosts: [cost],
    })
    expect(JSON.parse(JSON.stringify(message)).costs).toEqual([cost])
    expect(message.previousCosts).toEqual([cost])
    expect(ProviderModelInfoSchema.parse({ modelId: 'test/model', pricing }).pricing).toEqual(pricing)
    expect(MessageSchema.parse({ id: 'old', role: 'assistant', contentParts: [] }).costs).toBeUndefined()
    expect(formatCost(0.00000001)).toBe('≈ <$0.000001')
  })
})
