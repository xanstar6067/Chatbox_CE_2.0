import type { OAuthCredentials } from '../oauth/types'
import type { RequestCost } from '../utils/cost'
import type { SentryAdapter } from '../utils/sentry_adapter'

export interface ApiRequestOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: RequestInit['body']
  useProxy?: boolean
  signal?: AbortSignal
  retry?: number
}

export interface StorageAdapter {
  saveImage(folder: string, dataUrl: string): Promise<string>
  getImage(storageKey: string): Promise<string>
}

export interface OAuthAdapter {
  refreshCredential(providerId: string, credential: OAuthCredentials): Promise<OAuthCredentials>
  persistCredential(providerId: string, credential: OAuthCredentials): void
  clearCredential(providerId: string): void
}

export interface RequestAdapter {
  fetchWithOptions(
    url: string,
    init?: RequestInit,
    options?: { retry?: number; parseChatboxRemoteError?: boolean }
  ): Promise<Response>
  apiRequest(options: ApiRequestOptions): Promise<Response>
}

/** `chat` marks replies generated in chat sessions; everything else (titles, summaries, tools, tests) is `other`. */
export type UsagePurpose = 'chat' | 'other'

/** Token usage of one completed model request, reported for local usage statistics. */
export interface UsageRecord {
  cost?: RequestCost
  sessionId?: string
  sessionName?: string
  /** Provider id; filled in by getModel() */
  provider?: string
  modelId: string
  /** Human-readable model name when the provider config has one */
  modelLabel?: string
  purpose: UsagePurpose
  timestamp: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface ModelDependencies {
  request: RequestAdapter
  storage: StorageAdapter
  sentry: SentryAdapter
  getRemoteConfig(): any
  oauth?: OAuthAdapter
  /** Current platform type, used for OAuth auth resolution */
  platformType?: 'desktop' | 'web' | 'mobile'
  /** Receives the usage of every completed model request (one call per request step) */
  recordUsage?: (record: UsageRecord) => void
}
