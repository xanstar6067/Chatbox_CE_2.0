/**
 * Token Requirement Analyzer
 *
 * Analyzes messages to determine which tokens need calculation and which are cached.
 * Returns known token counts and a list of pending computation tasks.
 */

import type { Message, MessageFile, MessageLink } from '@shared/types/session'
import { getMessageText } from '@shared/utils/message'
import { MAX_INLINE_FILE_LINES } from '@/packages/context-management/attachment-payload'
import { type ContextUsageAnchor, getFinalStepParts } from '@/packages/context-management/context-usage'
import { getTokenCacheKey, isAttachmentCacheValid, isMessageTextCacheValid } from './cache-keys'
import { getPriority } from './computation-queue'
import { countsReasoningTokens, estimateTokens } from './tokenizer'
import type { ComputationTask, ContentMode, TokenBreakdown, TokenizerType } from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for analyzing token requirements
 */
export interface AnalyzeTokenRequirementsOptions {
  /** Current input message (not yet sent) */
  constructedMessage: Message | undefined
  /** Context messages (already in conversation) */
  contextMessages: Message[]
  /** Tokenizer type to use */
  tokenizerType: TokenizerType
  /** Whether the model supports tool use for files (affects preview mode) */
  modelSupportToolUseForFile: boolean
  /**
   * Reply whose provider-reported prompt size replaces the local estimate of itself and every earlier
   * context message (see findContextUsageAnchor).
   */
  anchor?: ContextUsageAnchor
}

/**
 * Result of token requirement analysis
 */
export interface AnalysisResult {
  /** Token count for current input (known values only) */
  currentInputTokens: number
  /** Token count for context messages (known values only) */
  contextTokens: number
  /** Tasks that need computation (without sessionId - caller must add it) */
  pendingTasks: Omit<ComputationTask, 'id' | 'createdAt' | 'sessionId'>[]
  /** Whether contextTokens starts from the anchor's provider-reported prompt size */
  usesProviderCount: boolean
  /** Detailed breakdown of token sources */
  breakdown: {
    currentInput: TokenBreakdown
    context: TokenBreakdown
  }
}

/**
 * Result of analyzing a single message's text
 */
interface MessageTextAnalysisResult {
  /** Known token count (0 if needs calculation) */
  tokens: number
  /** Whether calculation is needed */
  needsCalculation: boolean
  /** Task to submit (if calculation needed) */
  task?: Omit<ComputationTask, 'id' | 'createdAt' | 'sessionId'>
}

/**
 * Result of analyzing a message's attachments
 */
interface MessageAttachmentsAnalysisResult {
  /** Known token count (sum of cached values) */
  tokens: number
  /** Tasks to submit for uncached attachments */
  tasks: Omit<ComputationTask, 'id' | 'createdAt' | 'sessionId'>[]
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze token requirements for messages
 *
 * For each message (current input + context):
 * 1. Check if text token is cached and valid
 * 2. For each attachment, determine contentMode and check cache
 * 3. Return known token counts + list of tasks that need computation
 *
 * @param options - Analysis options
 * @returns Analysis result with known tokens and pending tasks
 */
export function analyzeTokenRequirements(options: AnalyzeTokenRequirementsOptions): AnalysisResult {
  const { constructedMessage, contextMessages, tokenizerType, modelSupportToolUseForFile, anchor } = options

  const pendingTasks: Omit<ComputationTask, 'id' | 'createdAt' | 'sessionId'>[] = []
  let currentInputText = 0
  let currentInputAttachments = 0
  let contextText = 0
  let contextAttachments = 0

  // Analyze current input message
  if (constructedMessage) {
    const textResult = analyzeMessageText(constructedMessage, tokenizerType, true, 0)
    currentInputText = textResult.tokens
    if (textResult.needsCalculation && textResult.task) {
      pendingTasks.push(textResult.task)
    }

    const attachmentsResult = analyzeMessageAttachments(
      constructedMessage,
      tokenizerType,
      modelSupportToolUseForFile,
      true,
      0
    )
    currentInputAttachments = attachmentsResult.tokens
    pendingTasks.push(...attachmentsResult.tasks)
  }

  // Analyze context messages (reverse order so newest messages have higher priority)
  // contextMessages is ordered oldest to newest, but we want newest first for calculation
  const contextLength = contextMessages.length
  const anchorIndex = anchor ? contextMessages.findIndex((m) => m.id === anchor.messageId) : -1
  for (let index = Math.max(anchorIndex, 0); index < contextLength; index++) {
    const msg = contextMessages[index]
    if (index === anchorIndex && anchor) {
      contextText += getAnchorTokens(msg, anchor, tokenizerType)
      continue
    }
    // Reverse priority: newest message (last in array) gets priority 0
    const priorityIndex = contextLength - 1 - index

    const textResult = analyzeMessageText(msg, tokenizerType, false, priorityIndex)
    contextText += textResult.tokens
    if (textResult.needsCalculation && textResult.task) {
      pendingTasks.push(textResult.task)
    }

    const attachmentsResult = analyzeMessageAttachments(
      msg,
      tokenizerType,
      modelSupportToolUseForFile,
      false,
      priorityIndex
    )
    contextAttachments += attachmentsResult.tokens
    pendingTasks.push(...attachmentsResult.tasks)
  }

  return {
    currentInputTokens: currentInputText + currentInputAttachments,
    contextTokens: contextText + contextAttachments,
    pendingTasks,
    usesProviderCount: anchorIndex !== -1,
    breakdown: {
      currentInput: { text: currentInputText, attachments: currentInputAttachments },
      context: { text: contextText, attachments: contextAttachments },
    },
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Analyze a message's text content for token calculation
 *
 * @param message - The message to analyze
 * @param tokenizerType - Tokenizer type to use
 * @param isCurrentInput - Whether this is the current input (not yet sent)
 * @param messageIndex - Position in context (0 = most recent)
 * @returns Analysis result with tokens and optional task
 */
function analyzeMessageText(
  message: Message,
  tokenizerType: TokenizerType,
  isCurrentInput: boolean,
  messageIndex: number
): MessageTextAnalysisResult {
  // For current input (constructedMessage), calculate tokens inline.
  // This message only exists in React state, not in the store,
  // so async task execution would fail with "message not found".
  if (isCurrentInput) {
    const text = getMessageText(message, true, true)
    const tokens = estimateTokens(text, getTokenModel(tokenizerType))
    return { tokens, needsCalculation: false }
  }

  // For context messages, check cache first
  const cachedValue = message.tokenCountMap?.[tokenizerType]
  const calculatedAt = message.tokenCalculatedAt?.[tokenizerType]
  const cacheValid =
    isMessageTextCacheValid(cachedValue, calculatedAt, message.updatedAt) &&
    !countedStaleReasoning(message, tokenizerType, calculatedAt)

  if (cacheValid) {
    return { tokens: cachedValue ?? 0, needsCalculation: false }
  }

  return {
    tokens: 0,
    needsCalculation: true,
    task: {
      type: 'message-text',
      messageId: message.id,
      tokenizerType,
      priority: getPriority(isCurrentInput, 'message-text', messageIndex),
    },
  }
}

/**
 * Message text counts cached before this moment included reasoning even where it is not sent to the model.
 * Such counts are recalculated for messages that contain reasoning.
 */
const REASONING_EXCLUDED_SINCE = Date.UTC(2026, 9, 11, 18, 30)

function countedStaleReasoning(message: Message, tokenizerType: TokenizerType, calculatedAt: number | undefined) {
  return (
    !countsReasoningTokens(tokenizerType) &&
    (calculatedAt ?? 0) < REASONING_EXCLUDED_SINCE &&
    message.contentParts.some((part) => part.type === 'reasoning' && part.text)
  )
}

/**
 * The anchor's prompt size covers every earlier context message; only its own final reply is added,
 * taken from the provider when it reported the count, otherwise estimated locally.
 */
function getAnchorTokens(message: Message, anchor: ContextUsageAnchor, tokenizerType: TokenizerType): number {
  const { inputTokens, resentOutputTokens } = anchor.contextUsage
  if (resentOutputTokens !== undefined) {
    return inputTokens + resentOutputTokens
  }
  const finalReply = { ...message, contentParts: getFinalStepParts(message.contentParts) }
  const text = getMessageText(finalReply, true, countsReasoningTokens(tokenizerType))
  return inputTokens + estimateTokens(text, getTokenModel(tokenizerType))
}

function getTokenModel(tokenizerType: TokenizerType): { provider: string; modelId: string } | undefined {
  if (tokenizerType === 'deepseek') {
    return { provider: 'deepseek', modelId: 'deepseek-chat' }
  }
  return undefined
}

/**
 * Analyze a message's attachments for token calculation
 *
 * @param message - The message to analyze
 * @param tokenizerType - Tokenizer type to use
 * @param modelSupportToolUseForFile - Whether model supports tool use for files
 * @param isCurrentInput - Whether this is the current input (not yet sent)
 * @param messageIndex - Position in context (0 = most recent)
 * @returns Analysis result with tokens and tasks
 */
function analyzeMessageAttachments(
  message: Message,
  tokenizerType: TokenizerType,
  modelSupportToolUseForFile: boolean,
  isCurrentInput: boolean,
  messageIndex: number
): MessageAttachmentsAnalysisResult {
  let totalTokens = 0
  const tasks: Omit<ComputationTask, 'id' | 'createdAt' | 'sessionId'>[] = []

  // Combine files and links into a single array for processing
  const allAttachments: Array<{ attachment: MessageFile | MessageLink; type: 'file' | 'link' }> = [
    ...(message.files || []).map((f) => ({ attachment: f, type: 'file' as const })),
    ...(message.links || []).map((l) => ({ attachment: l, type: 'link' as const })),
  ]

  for (const { attachment, type } of allAttachments) {
    // Skip attachments without storage key (not yet uploaded/processed)
    if (!attachment.storageKey) continue

    // Determine content mode based on file size and model capability
    const isLargeFile = (attachment.lineCount ?? 0) > MAX_INLINE_FILE_LINES
    const usePreview = modelSupportToolUseForFile && isLargeFile
    const contentMode: ContentMode = usePreview ? 'preview' : 'full'
    const cacheKey = getTokenCacheKey({ tokenizerType, contentMode })

    if (isAttachmentCacheValid(attachment, cacheKey)) {
      totalTokens += attachment.tokenCountMap?.[cacheKey] ?? 0
    } else {
      // Needs calculation
      tasks.push({
        type: 'attachment',
        messageId: message.id,
        attachmentId: attachment.id,
        attachmentType: type,
        tokenizerType,
        contentMode,
        priority: getPriority(isCurrentInput, 'attachment', messageIndex),
      })
    }
  }

  return { tokens: totalTokens, tasks }
}
