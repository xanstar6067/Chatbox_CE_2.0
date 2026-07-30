import type { Message, MessageContentParts, SessionSettings } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { createModel } from '@/adapters'
import {
  buildMessageRefinementInstruction,
  buildMessageRefinementMessages,
  getRefinedText,
  refineMessageText,
  replaceMessageTextParts,
} from './messageRefinement'

vi.mock('@/adapters', () => ({
  createModel: vi.fn(),
}))

describe('messageRefinement', () => {
  it('builds a cleanup request that separates instructions from message text', () => {
    const messages = buildMessageRefinementMessages('cleanup', 'The car is b0рдовая.', 'Make the car blue.', true)

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('mixed-script substitutions')
    expect(messages[0].content).toContain('Make the car blue.')
    expect(messages[1]).toEqual({
      role: 'user',
      content: '<text_to_edit>\nThe car is b0рдовая.\n</text_to_edit>',
    })
  })

  it('uses one user message for models without system-message support', () => {
    const messages = buildMessageRefinementMessages('proofread', 'hello world', '', false)

    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toContain('Correct spelling, grammar, punctuation')
    expect(messages[0].content).toContain('<text_to_edit>\nhello world\n</text_to_edit>')
  })

  it('omits the optional instruction section when it is blank', () => {
    expect(buildMessageRefinementInstruction('cleanup', '   ')).not.toContain('<editing_instruction>')
  })

  it('replaces all visible text while preserving non-text message parts', () => {
    const original: MessageContentParts = [
      { type: 'text', text: 'before' },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 'tool-1',
        toolName: 'search',
        args: {},
        result: {},
      },
      { type: 'text', text: 'after' },
      { type: 'image', storageKey: 'image-1' },
    ]

    expect(replaceMessageTextParts(original, 'corrected')).toEqual([
      { type: 'text', text: 'corrected' },
      original[1],
      original[3],
    ])
  })

  it('adds corrected text to a message that had no text part', () => {
    const original: MessageContentParts = [{ type: 'image', storageKey: 'image-1' }]
    expect(replaceMessageTextParts(original, 'caption')).toEqual([{ type: 'text', text: 'caption' }, original[0]])
  })

  it('extracts and trims text from a model result', () => {
    expect(
      getRefinedText({
        contentParts: [
          { type: 'text', text: '  corrected' },
          { type: 'text', text: 'text  ' },
        ],
      })
    ).toBe('corrected\ntext')
  })

  it('streams the corrected text into the preview callback', async () => {
    const chatStream = vi.fn(function* () {
      yield { type: 'text-delta', id: 'text-1', text: '  corrected' }
      yield { type: 'text-delta', id: 'text-1', text: ' text  ' }
    })
    vi.mocked(createModel).mockResolvedValue({
      isSupportSystemMessage: () => true,
      chatStream,
    } as never)
    const updates: string[] = []

    const result = await refineMessageText({
      sessionId: 'session-1',
      message: {
        id: 'message-1',
        role: 'assistant',
        contentParts: [{ type: 'text', text: 'source text' }],
      } as Message,
      kind: 'cleanup',
      userInstruction: '',
      modelSelection: { provider: 'provider-1', modelId: 'model-1' },
      sessionSettings: { provider: 'chat-provider', modelId: 'chat-model' } as SessionSettings,
      onTextChange: (text) => updates.push(text),
    })

    expect(result).toBe('corrected text')
    expect(updates).toEqual(['  corrected', '  corrected text  '])
    expect(chatStream).toHaveBeenCalledOnce()
  })
})
