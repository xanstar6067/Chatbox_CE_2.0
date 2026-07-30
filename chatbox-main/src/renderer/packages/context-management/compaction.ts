import type { CompactionPoint, Message } from '@shared/types'
import { createMessage } from '@shared/types'
import { setCompactionUIState } from '@/stores/atoms/compactionAtoms'
import * as chatStore from '@/stores/chatStore'
import { settingsStore } from '@/stores/settingsStore'
import { getContextMessagesForTokenEstimation } from './context-tokens'
import { generateSummaryWithStream } from './summary-generator'

const ongoingCompactions = new Set<string>()

export interface CompactionResult {
  success: boolean
  compacted: boolean
  error?: Error
  summaryMessageId?: string
}

export async function runManualCompactionWithUIState(sessionId: string): Promise<CompactionResult> {
  setCompactionUIState(sessionId, { status: 'running', error: null, streamingText: '' })

  const result = await runCompactionWithStreaming(sessionId)

  if (result.success) {
    setCompactionUIState(sessionId, { status: 'idle', error: null, streamingText: '' })
  } else {
    setCompactionUIState(sessionId, {
      status: 'failed',
      error: result.error?.message ?? 'Compaction failed',
      streamingText: '',
    })
  }

  return result
}

async function runCompactionWithStreaming(sessionId: string): Promise<CompactionResult> {
  if (ongoingCompactions.has(sessionId)) {
    return { success: true, compacted: false }
  }

  ongoingCompactions.add(sessionId)

  try {
    const session = await chatStore.getSession(sessionId)
    if (!session) {
      return { success: false, compacted: false, error: new Error('Session not found') }
    }

    const globalSettings = settingsStore.getState().getSettings()
    const modelId = session.settings?.modelId ?? globalSettings.defaultChatModel?.model
    if (!modelId) {
      return { success: true, compacted: false }
    }

    const mergedSettings = await chatStore.getSessionSettings(sessionId)
    const currentContext = getContextMessagesForTokenEstimation(session, { settings: mergedSettings })

    const summaryResult = await generateSummaryWithStream({
      messages: currentContext,
      sessionSettings: session.settings,
      onStreamUpdate: (text) => {
        setCompactionUIState(sessionId, { streamingText: text })
      },
    })

    if (!summaryResult.success || !summaryResult.summary) {
      return {
        success: false,
        compacted: false,
        error: summaryResult.error ?? new Error('Failed to generate summary'),
      }
    }

    const summaryMessage = createMessage('assistant', summaryResult.summary)
    summaryMessage.isSummary = true

    const lastNonSummaryMessage = [...session.messages].reverse().find((message) => !message.isSummary)
    if (!lastNonSummaryMessage) {
      return { success: false, compacted: false, error: new Error('No messages to compact') }
    }

    const newCompactionPoint: CompactionPoint = {
      summaryMessageId: summaryMessage.id,
      boundaryMessageId: lastNonSummaryMessage.id,
      createdAt: Date.now(),
    }

    await chatStore.updateSessionWithMessages(sessionId, (currentSession) => {
      if (!currentSession) {
        throw new Error('Session not found during update')
      }

      const updatedMessages: Message[] = [...currentSession.messages, summaryMessage]
      const updatedCompactionPoints: CompactionPoint[] = [
        ...(currentSession.compactionPoints ?? []),
        newCompactionPoint,
      ]

      return {
        ...currentSession,
        messages: updatedMessages,
        compactionPoints: updatedCompactionPoints,
      }
    })

    return {
      success: true,
      compacted: true,
      summaryMessageId: summaryMessage.id,
    }
  } catch (error) {
    return {
      success: false,
      compacted: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  } finally {
    ongoingCompactions.delete(sessionId)
  }
}
