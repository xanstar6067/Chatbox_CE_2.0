import { BaseError } from '@shared/models/errors'
import type { ModelStreamPart } from '@shared/models/types'
import type {
  Message,
  MessageContentParts,
  MessageReasoningPart,
  MessageTextPart,
  MessageToolCallPart,
} from '@shared/types'
import type { ToolSet } from 'ai'

export interface StreamProcessorCallbacks {
  onFileReceived: (mediaType: string, base64: string) => Promise<string>
}

export interface StreamProcessorState {
  contentParts: MessageContentParts
  currentTextPart: MessageTextPart | undefined
  currentReasoningPart: MessageReasoningPart | undefined
  usage: Message['usage']
  finishReason: string | undefined
  nativeWebSearchProvider: string | undefined
}

export function createInitialState(
  initialParts?: MessageContentParts,
  nativeWebSearchProvider?: string
): StreamProcessorState {
  return {
    contentParts: initialParts ? [...initialParts] : [],
    currentTextPart: undefined,
    currentReasoningPart: undefined,
    usage: undefined,
    finishReason: undefined,
    nativeWebSearchProvider,
  }
}

export function finalizeReasoningDuration(part: MessageReasoningPart | undefined): void {
  if (part?.startTime && !part.duration) {
    part.duration = Date.now() - part.startTime
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getSourceTitle(url: string, title?: string): string {
  if (title?.trim()) return title.trim()
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function normalizeSearchResults(value: unknown): Array<{ title: string; link: string; snippet: string }> {
  if (!isRecord(value)) return []

  const results: Array<{ title: string; link: string; snippet: string }> = []
  if (Array.isArray(value.searchResults)) {
    for (const item of value.searchResults) {
      if (isRecord(item) && typeof item.link === 'string') {
        results.push({
          title: typeof item.title === 'string' ? item.title : getSourceTitle(item.link),
          link: item.link,
          snippet: typeof item.snippet === 'string' ? item.snippet : '',
        })
      }
    }
  }
  if (Array.isArray(value.sources)) {
    for (const source of value.sources) {
      if (isRecord(source) && source.type === 'url' && typeof source.url === 'string') {
        results.push({
          title: getSourceTitle(source.url, typeof source.title === 'string' ? source.title : undefined),
          link: source.url,
          snippet: '',
        })
      }
    }
  }
  return results
}

function mergeNativeWebSearchResult(previous: unknown, next: unknown): Record<string, unknown> {
  const previousRecord = isRecord(previous) ? previous : {}
  const nextRecord = isRecord(next) ? next : {}
  const deduplicatedResults = new Map<string, { title: string; link: string; snippet: string }>()

  for (const result of [...normalizeSearchResults(previousRecord), ...normalizeSearchResults(nextRecord)]) {
    if (!deduplicatedResults.has(result.link)) {
      deduplicatedResults.set(result.link, result)
    }
  }

  return {
    ...previousRecord,
    ...nextRecord,
    searchResults: Array.from(deduplicatedResults.values()),
  }
}

function addNativeWebSearchSource(
  contentParts: MessageContentParts,
  source: { url: string; title?: string },
  provider?: string
): void {
  const nativeSearchParts = contentParts.filter(
    (part): part is MessageToolCallPart =>
      part.type === 'tool-call' && part.toolName === 'web_search' && part.providerExecuted === true
  )
  let searchPart = [...nativeSearchParts].reverse().find((part) => part.state === 'call') ?? nativeSearchParts.at(-1)

  if (!searchPart) {
    searchPart = {
      type: 'tool-call',
      state: 'result',
      toolCallId: `native_web_search_${contentParts.length}`,
      toolName: 'web_search',
      args: provider ? { provider } : {},
      result: { searchResults: [] },
      providerExecuted: true,
    }
    const firstAnswerPartIndex = contentParts.findIndex((part) => part.type === 'text')
    if (firstAnswerPartIndex === -1) {
      contentParts.push(searchPart)
    } else {
      contentParts.splice(firstAnswerPartIndex, 0, searchPart)
    }
  }

  if (provider) {
    searchPart.args = {
      ...(isRecord(searchPart.args) ? searchPart.args : {}),
      provider,
    }
  }
  searchPart.state = 'result'
  searchPart.result = mergeNativeWebSearchResult(searchPart.result, {
    searchResults: [
      {
        title: getSourceTitle(source.url, source.title),
        link: source.url,
        snippet: '',
      },
    ],
  })
}

export async function processStreamChunk(
  chunk: ModelStreamPart<ToolSet>,
  state: StreamProcessorState,
  callbacks: StreamProcessorCallbacks
): Promise<{ state: StreamProcessorState; skipUpdate: boolean; statusChunk?: ModelStreamPart<ToolSet> }> {
  const { contentParts, nativeWebSearchProvider } = state
  let { currentTextPart, currentReasoningPart, usage, finishReason } = state

  switch (chunk.type) {
    case 'text-delta': {
      finalizeReasoningDuration(currentReasoningPart)
      currentReasoningPart = undefined
      if (currentTextPart) {
        currentTextPart.text += chunk.text
      } else {
        currentTextPart = { type: 'text', text: chunk.text }
        contentParts.push(currentTextPart)
      }
      break
    }
    case 'reasoning-delta': {
      if (chunk.text.trim()) {
        currentTextPart = undefined
        if (currentReasoningPart) {
          currentReasoningPart.text += chunk.text
        } else {
          currentReasoningPart = {
            type: 'reasoning',
            text: chunk.text,
            startTime: Date.now(),
          }
          contentParts.push(currentReasoningPart)
        }
      }
      break
    }
    case 'tool-call': {
      finalizeReasoningDuration(currentReasoningPart)
      currentTextPart = undefined
      currentReasoningPart = undefined
      const args = 'args' in chunk ? chunk.args : chunk.input
      const toolCallPart: MessageToolCallPart = {
        type: 'tool-call',
        state: 'call',
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        args:
          chunk.providerExecuted && nativeWebSearchProvider && isRecord(args)
            ? { provider: nativeWebSearchProvider, ...args }
            : args,
        providerExecuted: chunk.providerExecuted,
      }
      contentParts.push(toolCallPart)
      break
    }
    case 'tool-result': {
      const existing = contentParts.find((part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId) as
        | MessageToolCallPart
        | undefined
      if (existing) {
        existing.state = 'result'
        const output = 'result' in chunk ? chunk.result : chunk.output
        existing.providerExecuted = existing.providerExecuted || chunk.providerExecuted
        if (existing.toolName === 'web_search' && existing.providerExecuted) {
          existing.result = mergeNativeWebSearchResult(existing.result, output)
          const action = isRecord(output) && isRecord(output.action) ? output.action : undefined
          if (action?.type === 'search' && typeof action.query === 'string') {
            existing.args = {
              ...(isRecord(existing.args) ? existing.args : {}),
              query: action.query,
            }
          }
        } else {
          existing.result = output
        }
      }
      break
    }
    case 'tool-error': {
      finalizeReasoningDuration(currentReasoningPart)
      const existing = contentParts.find((part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId) as
        | MessageToolCallPart
        | undefined
      if (existing) {
        existing.state = 'error'
        existing.result = {
          error: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
          errorCode: chunk.error instanceof BaseError ? chunk.error.code : undefined,
          input: chunk.input,
          toolName: chunk.toolName,
        }
      }
      break
    }
    case 'file': {
      if (chunk.file.mediaType?.startsWith('image/') && chunk.file.base64) {
        finalizeReasoningDuration(currentReasoningPart)
        const storageKey = await callbacks.onFileReceived(chunk.file.mediaType, chunk.file.base64)
        contentParts.push({ type: 'image', storageKey })
        currentTextPart = undefined
        currentReasoningPart = undefined
      }
      break
    }
    case 'source': {
      if (chunk.sourceType === 'url') {
        addNativeWebSearchSource(
          contentParts,
          {
            url: chunk.url,
            title: chunk.title,
          },
          nativeWebSearchProvider
        )
      }
      break
    }
    case 'status': {
      return {
        state: {
          contentParts,
          currentTextPart,
          currentReasoningPart,
          usage,
          finishReason,
          nativeWebSearchProvider,
        },
        skipUpdate: true,
        statusChunk: chunk,
      }
    }
    case 'finish': {
      finishReason = 'finishReason' in chunk ? chunk.finishReason : finishReason
      if ('totalUsage' in chunk && chunk.totalUsage) {
        usage = chunk.totalUsage as Message['usage']
      }
      for (const part of contentParts) {
        if (
          part.type === 'tool-call' &&
          part.toolName === 'web_search' &&
          part.providerExecuted &&
          part.state === 'call'
        ) {
          part.state = 'result'
          part.result = mergeNativeWebSearchResult(part.result, {})
        }
      }
      break
    }
    case 'error': {
      break
    }
    default:
      break
  }

  return {
    state: {
      contentParts,
      currentTextPart,
      currentReasoningPart,
      usage,
      finishReason,
      nativeWebSearchProvider,
    },
    skipUpdate: false,
  }
}
