import type { LanguageModelV3Usage } from '@ai-sdk/provider'
import { describe, expect, it } from 'vitest'
import { addSeparatelyReportedReasoningTokens } from './usage-normalization'

function openAICompatibleUsage(raw: {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  completion_tokens_details: { reasoning_tokens: number }
}): LanguageModelV3Usage {
  const reasoning = raw.completion_tokens_details.reasoning_tokens
  return {
    inputTokens: { total: raw.prompt_tokens, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: raw.completion_tokens, text: raw.completion_tokens - reasoning, reasoning },
    raw,
  }
}

describe('addSeparatelyReportedReasoningTokens', () => {
  it('adds xAI reasoning tokens that completion_tokens leaves out', () => {
    const usage = openAICompatibleUsage({
      prompt_tokens: 663,
      completion_tokens: 50,
      total_tokens: 837,
      completion_tokens_details: { reasoning_tokens: 124 },
    })
    expect(addSeparatelyReportedReasoningTokens(usage).outputTokens).toEqual({ total: 174, text: 50, reasoning: 124 })
  })

  it('keeps OpenAI-convention usage where completion already includes reasoning', () => {
    const usage = openAICompatibleUsage({
      prompt_tokens: 663,
      completion_tokens: 174,
      total_tokens: 837,
      completion_tokens_details: { reasoning_tokens: 124 },
    })
    expect(addSeparatelyReportedReasoningTokens(usage)).toBe(usage)
  })
})
