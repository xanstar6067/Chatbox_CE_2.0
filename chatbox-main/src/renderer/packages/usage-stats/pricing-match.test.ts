import type { ProviderModelInfo } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { matchOpenRouterPrice } from './pricing-match'

const model = (modelId: string): ProviderModelInfo => ({
  modelId,
  pricing: {
    input: 1,
    output: 5,
    source: 'openrouter',
    modelId,
    updatedAt: 1,
  },
})
const catalog = [
  'google/gemini-3.8-flash',
  'openai/gpt-4o',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-3.5-sonnet',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash:free',
  'vendor-a/duplicate',
  'vendor-b/duplicate',
].map(model)

describe('OpenRouter model matching', () => {
  it('maps direct Google and OpenAI IDs to their exact catalog counterparts', () => {
    expect(matchOpenRouterPrice('gemini-3.8-flash', 'gemini', catalog)?.modelId).toBe('google/gemini-3.8-flash')
    expect(matchOpenRouterPrice('models/gemini-3.8-flash', 'gemini', catalog)?.modelId).toBe('google/gemini-3.8-flash')
    expect(matchOpenRouterPrice('gpt-4o', 'openai', catalog)?.modelId).toBe('openai/gpt-4o')
    expect(matchOpenRouterPrice('gpt-4o', 'openai-responses', catalog)?.modelId).toBe('openai/gpt-4o')
  })
  it('handles Anthropic native version punctuation and date suffixes', () => {
    expect(matchOpenRouterPrice('claude-sonnet-4-5-20250929', 'claude', catalog)?.modelId).toBe(
      'anthropic/claude-sonnet-4.5'
    )
    expect(matchOpenRouterPrice('claude-3-5-sonnet-20241022', 'claude', catalog)?.modelId).toBe(
      'anthropic/claude-3.5-sonnet'
    )
  })
  it('never confuses vendors, ambiguous aliases, free variants or unknown versions', () => {
    expect(matchOpenRouterPrice('gemini-3.8-flash', 'openai', catalog)).toBeUndefined()
    expect(matchOpenRouterPrice('duplicate', 'proxy', catalog)).toBeUndefined()
    expect(matchOpenRouterPrice('gemini-3.8-flash-preview', 'gemini', catalog)).toBeUndefined()
    expect(matchOpenRouterPrice('gemini-2.5-flash', 'gemini', catalog)?.modelId).toBe('google/gemini-2.5-flash')
    expect(matchOpenRouterPrice('gemini-2.5-flash:free', 'gemini', catalog)?.modelId).toBe(
      'google/gemini-2.5-flash:free'
    )
    expect(matchOpenRouterPrice('gemini-3.8-flash', 'openrouter', catalog)).toBeUndefined()
  })
  it('accepts full IDs and existing explicit reference IDs for custom providers', () => {
    expect(matchOpenRouterPrice('google/gemini-3.8-flash', 'proxy', catalog)?.modelId).toBe('google/gemini-3.8-flash')
    expect(matchOpenRouterPrice('my-deployment', 'azure', catalog, 'openai/gpt-4o')?.modelId).toBe('openai/gpt-4o')
    expect(matchOpenRouterPrice('gemini-3.8-flash', 'proxy', catalog)?.modelId).toBe('google/gemini-3.8-flash')
    expect(matchOpenRouterPrice('gemini-3.8-flash', 'gemini', catalog, 'missing/id')).toBeUndefined()
  })
})
