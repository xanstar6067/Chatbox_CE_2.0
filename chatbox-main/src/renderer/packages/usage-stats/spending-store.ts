import type { UsageRecord } from '@shared/types/adapters'
import { createStore, useStore } from 'zustand'
import storage from '@/storage'
import * as chatStore from '@/stores/chatStore'
import {
  addSpendingRecord,
  createSpendingStats,
  pruneSpendingMonths,
  type SpendingStats,
  sessionSpendingRecords,
} from './spending'

const STORAGE_KEY = 'spending-stats'
const trackingStartedAt = Date.now()
interface SpendingStore {
  stats: SpendingStats | null
  importing: boolean
  error: boolean
}
export const spendingStore = createStore<SpendingStore>(() => ({ stats: null, importing: false, error: false }))
export const useSpendingStats = <T>(selector: (state: SpendingStore) => T) => useStore(spendingStore, selector)
let loadPromise: Promise<SpendingStats> | undefined
let rotationStarted = false

function commit(stats: SpendingStats) {
  spendingStore.setState({ stats: { ...stats, months: { ...stats.months } } })
  void storage.setItem(STORAGE_KEY, stats).catch((error) => console.error('Failed to save spending statistics', error))
}

function loadSpendingStats(): Promise<SpendingStats> {
  loadPromise ??= (async () => {
    const saved = await storage.getItem<SpendingStats | null>(STORAGE_KEY, null)
    const stats =
      saved?.version === 1 && saved.months && typeof saved.months === 'object'
        ? saved
        : createSpendingStats(trackingStartedAt)
    pruneSpendingMonths(stats)
    commit(stats)
    return stats
  })().catch((error) => {
    loadPromise = undefined
    spendingStore.setState({ error: true })
    throw error
  })
  return loadPromise
}

export async function refreshSpendingStats() {
  try {
    const stats = await loadSpendingStats()
    if (pruneSpendingMonths(stats)) commit(stats)
  } catch (error) {
    console.error('Failed to load spending statistics', error)
  }
}

export function initSpendingStats() {
  void refreshSpendingStats()
  if (rotationStarted || typeof window === 'undefined') return
  rotationStarted = true
  // Rotate on resume and at the calendar boundary even if the app stays open overnight.
  window.addEventListener('focus', () => void refreshSpendingStats())
  const scheduleRotation = () => {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    window.setTimeout(
      () => {
        void refreshSpendingStats()
        scheduleRotation()
      },
      Math.min(24 * 60 * 60 * 1000, nextMonth.getTime() - now.getTime())
    )
  }
  scheduleRotation()
}

export function recordSpending(record: UsageRecord) {
  void loadSpendingStats()
    .then((stats) => {
      const added = addSpendingRecord(stats, record)
      const pruned = pruneSpendingMonths(stats)
      if (added || pruned) commit(stats)
    })
    .catch((error) => console.error('Failed to record spending statistics', error))
}

export async function importSpendingHistory() {
  if (spendingStore.getState().importing) return
  spendingStore.setState({ importing: true, error: false })
  try {
    const stats = await loadSpendingStats()
    if (stats.historyImported) return
    const records: UsageRecord[] = []
    const seen = new Set<string>()
    for (const meta of await chatStore.listAllSessionsMeta()) {
      const session = await chatStore.getSession(meta.id)
      if (session) records.push(...sessionSpendingRecords(session, stats.trackingStartedAt, seen))
    }
    // Apply only after the whole scan succeeds, so a retry cannot double-count a partial import.
    for (const record of records) addSpendingRecord(stats, record)
    stats.historyImported = true
    pruneSpendingMonths(stats)
    commit(stats)
  } catch (error) {
    spendingStore.setState({ error: true })
    console.error('Failed to import spending history', error)
  } finally {
    spendingStore.setState({ importing: false })
  }
}
