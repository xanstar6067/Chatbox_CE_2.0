import type { MessageContentParts } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  buildMessageRefinementInstruction,
  buildMessageRefinementMessages,
  getRefinedText,
  replaceMessageTextParts,
} from './messageRefinement'

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
})
