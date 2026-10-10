import type { ModelMessage } from 'ai'

type CacheMarker = NonNullable<ModelMessage['providerOptions']>

/**
 * Add prompt cache breakpoints using the given provider-specific marker.
 * Places up to 3 breakpoints for optimal prefix caching:
 * 1. System message (constant prefix, always cache-hit)
 * 2. Second-to-last user message (previous turn's breakpoint, cache-hit on this turn)
 * 3. Last message (creates new cache prefix for the next turn)
 */
function addCacheBreakpoints(messages: ModelMessage[], marker: CacheMarker): ModelMessage[] {
  if (messages.length === 0) {
    return messages
  }

  const result = [...messages]
  const cacheIndices = new Set<number>()

  // 1. Cache system message if present
  if (result[0]?.role === 'system') {
    cacheIndices.add(0)
  }

  // 2. Cache second-to-last user message (previous turn's "last message" breakpoint)
  const lastIndex = result.length - 1
  let userCount = 0
  for (let i = lastIndex; i >= 0; i--) {
    if (result[i].role === 'user') {
      userCount++
      if (userCount === 2) {
        cacheIndices.add(i)
        break
      }
    }
  }

  // 3. Cache the last message
  cacheIndices.add(lastIndex)

  for (const idx of cacheIndices) {
    const msg = result[idx]
    const providerOptions: CacheMarker = { ...msg.providerOptions }
    for (const [provider, options] of Object.entries(marker)) {
      providerOptions[provider] = { ...providerOptions[provider], ...options }
    }
    result[idx] = { ...msg, providerOptions }
  }

  return result
}

/**
 * Add ephemeral cache control breakpoints for Anthropic prompt caching
 * (direct Anthropic API and Anthropic-style gateways).
 * See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */
export function addAnthropicCacheControl(messages: ModelMessage[]): ModelMessage[] {
  return addCacheBreakpoints(messages, { anthropic: { cacheControl: { type: 'ephemeral' } } })
}

/**
 * Add cache checkpoints for AWS Bedrock (Converse API `cachePoint` blocks).
 * The Bedrock provider ignores `anthropic.cacheControl`, so it needs its own marker.
 * See: https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
 */
export function addBedrockCachePoints(messages: ModelMessage[]): ModelMessage[] {
  return addCacheBreakpoints(messages, { bedrock: { cachePoint: { type: 'default' } } })
}

/**
 * Add `cache_control` breakpoints for OpenRouter models that need explicit caching
 * (Anthropic Claude, Alibaba Qwen).
 * See: https://openrouter.ai/docs/features/prompt-caching
 */
export function addOpenRouterCacheControl(messages: ModelMessage[]): ModelMessage[] {
  return addCacheBreakpoints(messages, { openrouter: { cacheControl: { type: 'ephemeral' } } })
}
