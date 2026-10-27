import { type CopilotDetail, createMessage, type Session } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { describe, expect, it } from 'vitest'
import { isCopilotPromptModified, setSessionPrompt } from './copilot-prompt'

const copilot: CopilotDetail = { id: 'role-1', name: 'Role', prompt: 'Original role' }
const session: Session = {
  id: 'chat-1',
  name: 'My chat',
  copilotId: copilot.id,
  messages: [createMessage('system', copilot.prompt), createMessage('user', 'Hello')],
  settings: { provider: 'openai', modelId: 'test', temperature: 0.4 },
  assistantAvatarKey: 'avatar',
  backgroundImage: { type: 'url', url: 'background' },
}

describe('copilot role instructions', () => {
  it('uses the stored modification flag and compares only the linked copilot for legacy chats', () => {
    expect(isCopilotPromptModified(session, copilot.prompt, [copilot])).toBe(false)
    expect(isCopilotPromptModified(session, 'Edited role', [copilot])).toBe(true)
    expect(isCopilotPromptModified({ ...session, copilotPromptModified: true }, copilot.prompt, [copilot])).toBe(true)
    expect(isCopilotPromptModified({ ...session, copilotId: undefined }, 'Custom role', [])).toBe(true)
    expect(isCopilotPromptModified({ ...session, copilotId: 'deleted' }, 'Custom role', [])).toBe(true)
    expect(isCopilotPromptModified({ ...session, copilotId: undefined }, '', [])).toBe(false)
  })

  it('replaces only the role text, invalidates its token cache and keeps conversation parameters', () => {
    const original = {
      ...session,
      messages: [{ ...session.messages[0], tokenCountMap: { default: 100 }, wordCount: 2 }, session.messages[1]],
    }
    const updated = setSessionPrompt(original, ' New role ')
    expect(getMessageText(updated.messages[0])).toBe('New role')
    expect(updated.messages[0].id).toBe(original.messages[0].id)
    expect(updated.messages[0].tokenCountMap).toBeUndefined()
    expect(updated.messages[0].wordCount).toBeUndefined()
    expect(updated.messages[1]).toBe(original.messages[1])
    expect(updated.settings).toBe(original.settings)
    expect(updated.name).toBe(original.name)
    expect(updated.assistantAvatarKey).toBe(original.assistantAvatarKey)
    expect(updated.backgroundImage).toBe(original.backgroundImage)
    expect(getMessageText(original.messages[0])).toBe(copilot.prompt)
  })

  it('adds or removes a system prompt without changing the conversation history', () => {
    const cleared = setSessionPrompt(session, ' ')
    expect(cleared.messages).toEqual([session.messages[1]])
    const restored = setSessionPrompt(cleared, 'Restored')
    expect(restored.messages.map((message) => message.role)).toEqual(['system', 'user'])
    expect(getMessageText(restored.messages[0])).toBe('Restored')
  })
})
