import { type CopilotDetail, createMessage, type Session } from '@shared/types'
import { getMessageText } from '@shared/utils/message'

/** Legacy sessions compare only their linked copilot, never every saved prompt. */
export function isCopilotPromptModified(session: Session, prompt: string, copilots: CopilotDetail[]) {
  if (session.copilotPromptModified !== undefined) return session.copilotPromptModified
  const copilot = copilots.find((item) => item.id === session.copilotId)
  return copilot ? prompt.trim() !== copilot.prompt.trim() : Boolean(prompt.trim())
}

export function setSessionPrompt(session: Session, prompt: string): Session {
  const text = prompt.trim()
  const systemMessage = session.messages.find((message) => message.role === 'system')
  const messages = session.messages.filter((message) => message.role !== 'system')
  return {
    ...session,
    messages: text
      ? [
          systemMessage
            ? getMessageText(systemMessage) === text
              ? systemMessage
              : {
                  ...systemMessage,
                  contentParts: [{ type: 'text', text }],
                  tokenCountMap: undefined,
                  tokenCalculatedAt: undefined,
                  tokenCount: undefined,
                  wordCount: undefined,
                }
            : createMessage('system', text),
          ...messages,
        ]
      : messages,
  }
}
