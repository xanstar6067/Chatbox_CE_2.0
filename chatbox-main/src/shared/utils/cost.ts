import { z } from 'zod'

/** Prices are USD per million tokens; requestUSD is a flat fee per request. */
export const ModelPricingSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative().optional(),
  cacheWrite: z.number().nonnegative().optional(),
  requestUSD: z.number().nonnegative().optional(),
  source: z.enum(['manual', 'openrouter']),
  modelId: z.string().optional(),
  updatedAt: z.number(),
})

export type ModelPricing = z.infer<typeof ModelPricingSchema>

export const RequestCostSchema = z.object({
  provider: z.string().optional(),
  modelId: z.string(),
  timestamp: z.number(),
  inputTokens: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
  cacheReadTokens: z.number().nonnegative().optional(),
  cacheWriteTokens: z.number().nonnegative().optional(),
  pricing: ModelPricingSchema.optional(),
  usd: z.number().nonnegative().optional(),
  usageEstimated: z.boolean().optional(),
})

export type RequestCost = z.infer<typeof RequestCostSchema>

export function calculateRequestCost(usage: Omit<RequestCost, 'usd' | 'pricing'>, pricing?: ModelPricing): RequestCost {
  const snapshot: RequestCost = { ...usage, pricing: pricing ? { ...pricing } : undefined }
  const { inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0 } = usage
  if (!pricing || inputTokens === undefined || outputTokens === undefined) return snapshot
  const numbers = [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens]
  if (numbers.some((value) => !Number.isFinite(value) || value < 0)) return snapshot
  if (cacheReadTokens + cacheWriteTokens > inputTokens) return snapshot
  // Missing cache rates stay unknown rather than silently using the full input price.
  if (cacheReadTokens > 0 && pricing.cacheRead === undefined) return snapshot
  if (cacheWriteTokens > 0 && pricing.cacheWrite === undefined) return snapshot
  const usd =
    ((inputTokens - cacheReadTokens - cacheWriteTokens) * pricing.input +
      cacheReadTokens * (pricing.cacheRead ?? 0) +
      cacheWriteTokens * (pricing.cacheWrite ?? 0) +
      outputTokens * pricing.output) /
      1_000_000 +
    (pricing.requestUSD ?? 0)
  if (Number.isFinite(usd)) snapshot.usd = usd
  return snapshot
}

/** The public OpenRouter catalog expresses prices as USD per token. */
export function parseOpenRouterPricing(value: unknown, modelId: string, now = Date.now()): ModelPricing | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const price = (key: string) => {
    const value = raw[key]
    if (typeof value !== 'string' && typeof value !== 'number') return undefined
    if (typeof value === 'string' && !value.trim()) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
  }
  const input = price('prompt')
  const output = price('completion')
  if (input === undefined || output === undefined) return undefined
  const cacheRead = price('input_cache_read')
  const cacheWrite = price('input_cache_write')
  const result = ModelPricingSchema.safeParse({
    input: input * 1_000_000,
    output: output * 1_000_000,
    cacheRead: cacheRead === undefined ? undefined : cacheRead * 1_000_000,
    cacheWrite: cacheWrite === undefined ? undefined : cacheWrite * 1_000_000,
    requestUSD: price('request'),
    source: 'openrouter',
    modelId,
    updatedAt: now,
  })
  return result.success ? result.data : undefined
}

export function summarizeCosts(costs: readonly RequestCost[]) {
  return {
    usd: costs.reduce((sum, cost) => sum + (cost.usd ?? 0), 0),
    known: costs.filter((cost) => cost.usd !== undefined).length,
    unknown: costs.filter((cost) => cost.usd === undefined).length,
  }
}

export function formatCost(usd: number): string {
  if (usd > 0 && usd < 0.000001) return '≈ <$0.000001'
  return `≈ $${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}
