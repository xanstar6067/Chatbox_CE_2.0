import type { Message, MessageContentParts, MessageToolCallPart } from '@shared/types'
import type { LanguageModelUsage } from 'ai'

export type MessageContextUsage = NonNullable<Message['contextUsage']>

export interface ContextUsageAnchor {
  messageId: string
  contextUsage: MessageContextUsage
}

/** Tool calls that are replayed to the model on later turns; provider-executed ones are display only. */
function isReplayedToolCall(part: MessageContentParts[number]): part is MessageToolCallPart {
  return part.type === 'tool-call' && !part.providerExecuted
}

function countReplayedToolCalls(message: Message): number {
  return message.contentParts?.filter(isReplayedToolCall).length ?? 0
}

/** Content produced by the final request step: everything after the last replayed tool call. */
export function getFinalStepParts(contentParts: MessageContentParts): MessageContentParts {
  return contentParts.slice(contentParts.findLastIndex(isReplayedToolCall) + 1)
}

/**
 * Output tokens of the final step that are sent back on the next turn. Reasoning is stripped from the
 * history unless `preserveReasoning` is set, so it is subtracted whenever the provider reports it.
 * Returns undefined when the provider count cannot be separated; the caller then estimates the text locally.
 */
function getResentOutputTokens(
  usage: LanguageModelUsage,
  finalStepParts: MessageContentParts,
  preserveReasoning: boolean
): number | undefined {
  const outputTokens = usage.outputTokens
  if (outputTokens === undefined) return undefined
  if (preserveReasoning) return outputTokens

  const textTokens = usage.outputTokenDetails?.textTokens
  if (textTokens !== undefined && textTokens >= 0) return textTokens

  const reasoningTokens = usage.outputTokenDetails?.reasoningTokens
  if (reasoningTokens !== undefined) {
    return outputTokens >= reasoningTokens ? outputTokens - reasoningTokens : undefined
  }
  return finalStepParts.some((part) => part.type === 'reasoning') ? undefined : outputTokens
}

export function buildMessageContextUsage(params: {
  lastStepUsage: LanguageModelUsage | undefined
  provider: string | undefined
  modelId: string | undefined
  contentParts: MessageContentParts
  preserveReasoning: boolean
}): MessageContextUsage | undefined {
  const { lastStepUsage, provider, modelId, contentParts, preserveReasoning } = params
  if (!lastStepUsage?.inputTokens || !provider || !modelId) {
    return undefined
  }
  return {
    provider,
    modelId,
    inputTokens: lastStepUsage.inputTokens,
    resentOutputTokens: getResentOutputTokens(lastStepUsage, getFinalStepParts(contentParts), preserveReasoning),
    createdAt: Date.now(),
  }
}

/**
 * Finds the latest reply of the current model whose provider-reported prompt size still describes the
 * beginning of the current context, so that only the messages after it need a local estimate.
 *
 * The anchor is rejected (falling back to a fully local estimate) when the context may have changed
 * before it since that request: older messages were edited or summarized, the message-count limit
 * truncates the history, or tool-call results that were sent then are now cleaned from the context.
 */
export function findContextUsageAnchor(params: {
  contextMessages: Message[]
  sessionMessages: Message[]
  model?: { provider: string; modelId: string }
  maxContextMessageCount?: number
}): ContextUsageAnchor | undefined {
  const { contextMessages, sessionMessages, model, maxContextMessageCount = Number.MAX_SAFE_INTEGER } = params
  if (!model || contextMessages.length >= maxContextMessageCount) {
    return undefined
  }

  const anchorIndex = contextMessages.findLastIndex(
    (m) =>
      m.role === 'assistant' && m.contextUsage?.provider === model.provider && m.contextUsage.modelId === model.modelId
  )
  if (anchorIndex === -1) {
    return undefined
  }
  const anchor = contextMessages[anchorIndex]
  const contextUsage = anchor.contextUsage as MessageContextUsage

  const originalMessages = new Map(sessionMessages.map((m) => [m.id, m]))
  for (let i = 0; i <= anchorIndex; i++) {
    const message = contextMessages[i]
    if (i < anchorIndex && (message.timestamp ?? 0) > contextUsage.createdAt) {
      return undefined
    }
    const original = originalMessages.get(message.id)
    if (original && countReplayedToolCalls(original) > countReplayedToolCalls(message)) {
      return undefined
    }
  }

  return { messageId: anchor.id, contextUsage }
}
