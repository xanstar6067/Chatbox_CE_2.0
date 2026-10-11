import type { Message } from '@shared/types'
import type { LanguageModelUsage } from 'ai'
import { describe, expect, it } from 'vitest'
import { buildMessageContextUsage, findContextUsageAnchor } from './context-usage'

const model = { provider: 'gemini', modelId: 'gemini-3-pro' }

function usage(overrides: Partial<LanguageModelUsage>): LanguageModelUsage {
  return {
    inputTokens: 17000,
    outputTokens: 900,
    totalTokens: 17900,
    inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    ...overrides,
  }
}

function reply(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    role: 'assistant',
    contentParts: [{ type: 'text', text: 'answer' }],
    timestamp: 2000,
    contextUsage: { ...model, inputTokens: 17000, resentOutputTokens: 300, createdAt: 2000 },
    ...overrides,
  }
}

function user(id: string, overrides: Partial<Message> = {}): Message {
  return { id, role: 'user', contentParts: [{ type: 'text', text: 'question' }], timestamp: 1000, ...overrides }
}

describe('buildMessageContextUsage', () => {
  const base = { provider: 'gemini', modelId: 'gemini-3-pro', preserveReasoning: false }
  const withReasoning: Message['contentParts'] = [
    { type: 'reasoning', text: 'thinking' },
    { type: 'text', text: 'answer' },
  ]

  it('keeps only the visible output when the provider separates reasoning', () => {
    const result = buildMessageContextUsage({
      ...base,
      lastStepUsage: usage({ outputTokenDetails: { textTokens: 300, reasoningTokens: 600 } }),
      contentParts: withReasoning,
    })
    expect(result).toMatchObject({ inputTokens: 17000, resentOutputTokens: 300 })
  })

  it('subtracts reported reasoning when the text count is missing', () => {
    const result = buildMessageContextUsage({
      ...base,
      lastStepUsage: usage({ outputTokenDetails: { textTokens: undefined, reasoningTokens: 600 } }),
      contentParts: withReasoning,
    })
    expect(result?.resentOutputTokens).toBe(300)
  })

  it('leaves the output to a local estimate when reasoning is mixed into it', () => {
    const result = buildMessageContextUsage({ ...base, lastStepUsage: usage({}), contentParts: withReasoning })
    expect(result?.resentOutputTokens).toBeUndefined()
  })

  it('uses the whole output when the reply has no reasoning or reasoning is resent', () => {
    const contentParts: Message['contentParts'] = [{ type: 'text', text: 'answer' }]
    expect(buildMessageContextUsage({ ...base, lastStepUsage: usage({}), contentParts })?.resentOutputTokens).toBe(900)
    expect(
      buildMessageContextUsage({
        ...base,
        preserveReasoning: true,
        lastStepUsage: usage({ outputTokenDetails: { textTokens: 300, reasoningTokens: 600 } }),
        contentParts: withReasoning,
      })?.resentOutputTokens
    ).toBe(900)
  })

  it('is not created without a provider prompt count', () => {
    expect(
      buildMessageContextUsage({ ...base, lastStepUsage: usage({ inputTokens: undefined }), contentParts: [] })
    ).toBeUndefined()
  })
})

describe('findContextUsageAnchor', () => {
  it('anchors on the latest reply of the selected model', () => {
    const messages = [user('u1'), reply('a1'), user('u2', { timestamp: 3000 })]
    expect(findContextUsageAnchor({ contextMessages: messages, sessionMessages: messages, model })?.messageId).toBe(
      'a1'
    )
  })

  it('ignores replies of another model', () => {
    const messages = [user('u1'), reply('a1')]
    expect(
      findContextUsageAnchor({
        contextMessages: messages,
        sessionMessages: messages,
        model: { provider: 'openrouter', modelId: 'google/gemini-3-pro' },
      })
    ).toBeUndefined()
  })

  it('rejects the anchor when an earlier message was edited after the reply', () => {
    const messages = [user('u1', { timestamp: 5000 }), reply('a1')]
    expect(findContextUsageAnchor({ contextMessages: messages, sessionMessages: messages, model })).toBeUndefined()
  })

  it('rejects the anchor when the message-count limit truncates the history', () => {
    const messages = [user('u1'), reply('a1')]
    expect(
      findContextUsageAnchor({ contextMessages: messages, sessionMessages: messages, model, maxContextMessageCount: 2 })
    ).toBeUndefined()
  })

  it('rejects the anchor when tool results sent then are now cleaned from the context', () => {
    const withTool = reply('a1', {
      contentParts: [
        { type: 'tool-call', state: 'result', toolCallId: 't1', toolName: 'search', args: {}, result: 'big' },
        { type: 'text', text: 'answer' },
      ],
    })
    const cleaned: Message = { ...withTool, contentParts: [{ type: 'text', text: 'answer' }] }
    expect(
      findContextUsageAnchor({ contextMessages: [user('u1'), cleaned], sessionMessages: [user('u1'), withTool], model })
    ).toBeUndefined()
  })
})
