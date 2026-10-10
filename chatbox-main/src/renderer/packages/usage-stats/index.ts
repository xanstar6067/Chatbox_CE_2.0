import type { Message, Session } from '@shared/types'
import type { UsageRecord } from '@shared/types/adapters'
import { createStore, useStore } from 'zustand'
import { getLogger } from '@/lib/utils'
import storage from '@/storage'
import * as chatStore from '@/stores/chatStore'
import {
  addUsageRecord,
  createUsageStatsState,
  modelLabelFromDisplayName,
  pruneUsageMonths,
  retentionStart,
  type UsageStatsState,
} from './aggregate'

export * from './aggregate'

const log = getLogger('usage-stats')
const STORAGE_KEY = 'usage-stats'

interface UsageStatsStore {
  stats: UsageStatsState | null
  importing: boolean
}

export const usageStatsStore = createStore<UsageStatsStore>(() => ({ stats: null, importing: false }))

export function useUsageStats<T>(selector: (state: UsageStatsStore) => T): T {
  return useStore(usageStatsStore, selector)
}

let loadPromise: Promise<UsageStatsState> | null = null

function commit(stats: UsageStatsState) {
  // New top-level object so subscribers re-render; storage.setItem debounces the disk write.
  usageStatsStore.setState({ stats: { ...stats } })
  void storage.setItem(STORAGE_KEY, stats)
}

function loadUsageStats(): Promise<UsageStatsState> {
  loadPromise ??= (async () => {
    let stats: UsageStatsState | null = null
    try {
      stats = await storage.getItem<UsageStatsState | null>(STORAGE_KEY, null)
    } catch (error) {
      log.error('Failed to load usage statistics', error)
    }
    if (stats?.version !== 1 || typeof stats.months !== 'object' || stats.months === null) {
      stats = createUsageStatsState(Date.now())
      commit(stats)
    } else if (pruneUsageMonths(stats)) {
      commit(stats)
    } else {
      usageStatsStore.setState({ stats })
    }
    return stats
  })()
  return loadPromise
}

/**
 * Loads the statistics at startup so `trackingStartedAt` is fixed before the
 * first request; the history import counts only messages older than that.
 */
export function initUsageStats() {
  void loadUsageStats()
}

export function recordUsage(record: UsageRecord) {
  void loadUsageStats().then((stats) => {
    const added = addUsageRecord(stats, record)
    const pruned = pruneUsageMonths(stats)
    if (added || pruned) {
      commit(stats)
    }
  })
}

export async function resetUsageStats() {
  const stats = await loadUsageStats()
  stats.months = {}
  // Nothing to import after a reset: the history is intentionally dropped.
  stats.historyImported = true
  stats.trackingStartedAt = Date.now()
  commit(stats)
}

function collectSessionMessages(session: Session): Message[] {
  const messages = [...session.messages]
  for (const thread of session.threads ?? []) {
    messages.push(...thread.messages)
  }
  // Regenerated replies live in the other fork branches and were billed as well.
  for (const fork of Object.values(session.messageForksHash ?? {})) {
    for (const list of fork.lists) {
      messages.push(...list.messages)
    }
  }
  return messages
}

/**
 * One-time import of the replies saved before live recording started. Saved
 * messages keep only the total usage of a reply, so each counts as one request.
 */
export async function importUsageHistory() {
  const stats = await loadUsageStats()
  if (stats.historyImported || usageStatsStore.getState().importing) {
    return
  }
  usageStatsStore.setState({ importing: true })
  try {
    const since = retentionStart(new Date())
    const seen = new Set<string>()
    for (const meta of await chatStore.listAllSessionsMeta()) {
      const session = await chatStore.getSession(meta.id)
      if (!session) continue
      for (const message of collectSessionMessages(session)) {
        if (seen.has(message.id)) continue
        seen.add(message.id)
        const usage = message.usage
        const timestamp = message.timestamp
        if (message.role !== 'assistant' || !usage || timestamp === undefined) continue
        if (timestamp < since || timestamp >= stats.trackingStartedAt) continue
        addUsageRecord(stats, {
          provider: message.aiProvider || 'unknown',
          modelId: modelLabelFromDisplayName(message.model),
          purpose: 'chat',
          timestamp,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          reasoningTokens: usage.reasoningTokens,
          cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens,
          cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens,
        })
      }
    }
    stats.historyImported = true
    commit(stats)
  } catch (error) {
    log.error('Failed to import usage history', error)
  } finally {
    usageStatsStore.setState({ importing: false })
  }
}
