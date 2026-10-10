import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import { addAnthropicCacheControl, addBedrockCachePoints, addOpenRouterCacheControl } from './anthropic-cache'

const cacheControl = { type: 'ephemeral' as const }

function hasCacheControl(msg: ModelMessage): boolean {
  return (msg.providerOptions?.anthropic as Record<string, unknown> | undefined)?.cacheControl != null
}

describe('addAnthropicCacheControl', () => {
  it('returns empty array unchanged', () => {
    expect(addAnthropicCacheControl([])).toEqual([])
  })

  it('adds cache control to single user message', () => {
    const messages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]
    const result = addAnthropicCacheControl(messages)
    expect(result).toHaveLength(1)
    expect(hasCacheControl(result[0])).toBe(true)
  })

  it('adds cache control to system message and last message', () => {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]
    const result = addAnthropicCacheControl(messages)
    expect(hasCacheControl(result[0])).toBe(true) // system
    expect(hasCacheControl(result[1])).toBe(true) // last message
  })

  it('places 3 breakpoints in multi-turn conversation', () => {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: [{ type: 'text', text: 'first' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'response1' }] },
      { role: 'user', content: [{ type: 'text', text: 'second' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'response2' }] },
      { role: 'user', content: [{ type: 'text', text: 'third' }] },
    ]
    const result = addAnthropicCacheControl(messages)

    expect(hasCacheControl(result[0])).toBe(true) // system
    expect(hasCacheControl(result[1])).toBe(false) // first user - not second-to-last
    expect(hasCacheControl(result[2])).toBe(false) // assistant
    expect(hasCacheControl(result[3])).toBe(true) // second user (second-to-last)
    expect(hasCacheControl(result[4])).toBe(false) // assistant
    expect(hasCacheControl(result[5])).toBe(true) // third user (last)
  })

  it('handles conversation with tool messages between user messages', () => {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: [{ type: 'text', text: 'first' }] },
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 't1', toolName: 'search', input: {} }] },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 't1', toolName: 'search', output: { type: 'text', value: 'found' } }],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'response1' }] },
      { role: 'user', content: [{ type: 'text', text: 'second' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'response2' }] },
      { role: 'user', content: [{ type: 'text', text: 'third' }] },
    ]
    const result = addAnthropicCacheControl(messages)

    expect(hasCacheControl(result[0])).toBe(true) // system
    expect(hasCacheControl(result[5])).toBe(true) // second-to-last user
    expect(hasCacheControl(result[7])).toBe(true) // last user
    // tool and assistant messages should NOT have cache control
    expect(hasCacheControl(result[2])).toBe(false)
    expect(hasCacheControl(result[3])).toBe(false)
    expect(hasCacheControl(result[4])).toBe(false)
  })

  it('does not mutate original messages', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]
    const result = addAnthropicCacheControl(messages)
    expect(messages[0].providerOptions).toBeUndefined()
    expect(hasCacheControl(result[0])).toBe(true)
  })

  it('preserves existing providerOptions', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'hello' }],
        providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: 1000 } } },
      },
    ]
    const result = addAnthropicCacheControl(messages)
    const anthropic = result[0].providerOptions?.anthropic as Record<string, unknown>
    expect(anthropic.cacheControl).toEqual(cacheControl)
    expect(anthropic.thinking).toEqual({ type: 'enabled', budgetTokens: 1000 })
  })

  it('handles no system message with only one user message', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'only one' }] },
    ]
    const result = addAnthropicCacheControl(messages)
    // Only 1 breakpoint (last message = only user message)
    expect(hasCacheControl(result[0])).toBe(true)
  })
})

describe('provider-specific cache markers', () => {
  const messages: ModelMessage[] = [
    { role: 'system', content: 'you are helpful' },
    { role: 'user', content: [{ type: 'text', text: 'first' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'response1' }] },
    { role: 'user', content: [{ type: 'text', text: 'second' }] },
  ]

  it('marks Bedrock cache points on the same breakpoints', () => {
    const result = addBedrockCachePoints(messages)
    const marked = result.map((msg) => msg.providerOptions?.bedrock?.cachePoint)

    expect(marked).toEqual([{ type: 'default' }, { type: 'default' }, undefined, { type: 'default' }])
    expect(result[0].providerOptions?.anthropic).toBeUndefined()
  })

  it('marks OpenRouter cache control and keeps other OpenRouter options', () => {
    const result = addOpenRouterCacheControl([
      ...messages.slice(0, 3),
      {
        role: 'user',
        content: [{ type: 'text', text: 'second' }],
        providerOptions: { openrouter: { filename: 'notes.txt' } },
      },
    ])

    expect(result[0].providerOptions?.openrouter).toEqual({ cacheControl })
    expect(result[3].providerOptions?.openrouter).toEqual({ filename: 'notes.txt', cacheControl })
  })
})
