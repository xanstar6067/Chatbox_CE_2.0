import { createMessage, type Session } from '@shared/types'
import type { UsageRecord } from '@shared/types/adapters'
import type { RequestCost } from '@shared/utils/cost'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addSpendingRecord, createSpendingStats } from './spending'

vi.mock('@/storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('@/stores/chatStore', () => ({ listAllSessionsMeta: vi.fn(), getSession: vi.fn() }))

import storage from '@/storage'
import * as chatStore from '@/stores/chatStore'

const now = new Date(2026, 9, 26, 12)
const usage = (timestamp: number, usd = 0.25): UsageRecord & { cost: RequestCost } => ({
  modelId: 'test',
  purpose: 'chat',
  sessionId: 'chat-a',
  sessionName: 'Chat A',
  timestamp,
  cost: { modelId: 'test', timestamp, usd },
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.resetModules()
  vi.mocked(storage.getItem).mockReset().mockResolvedValue(null)
  vi.mocked(storage.setItem).mockClear()
  vi.mocked(chatStore.listAllSessionsMeta).mockReset().mockResolvedValue([])
  vi.mocked(chatStore.getSession).mockReset()
})
afterEach(() => vi.useRealTimers())

describe('persisted spending statistics', () => {
  it('imports old chat costs once while preserving live usage and skips already tracked saved requests', async () => {
    const store = await import('./spending-store')
    await store.refreshSpendingStats()
    const old = usage(new Date(2026, 9, 1).getTime())
    const live = usage(now.getTime(), 0.5)
    store.recordSpending(live)
    const session = {
      id: 'chat-a',
      name: 'Chat A',
      messages: [{ ...createMessage('assistant', 'reply'), costs: [old.cost, live.cost] }],
    } as Session
    vi.mocked(chatStore.listAllSessionsMeta).mockResolvedValue([{ id: 'chat-a' }] as Awaited<
      ReturnType<typeof chatStore.listAllSessionsMeta>
    >)
    vi.mocked(chatStore.getSession).mockResolvedValue(session)
    await store.importSpendingHistory()
    await store.importSpendingHistory()
    expect(store.spendingStore.getState().stats?.months['2026-10'].totals).toMatchObject({ usd: 0.75, requests: 2 })
    expect(chatStore.listAllSessionsMeta).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenLastCalledWith(
      'spending-stats',
      expect.objectContaining({ historyImported: true })
    )
  })

  it('does not partially import history when reading a chat fails, and retries without duplicates', async () => {
    const store = await import('./spending-store')
    const old = usage(new Date(2026, 9, 1).getTime())
    const session = {
      id: 'chat-a',
      name: 'Chat A',
      messages: [{ ...createMessage('assistant', 'reply'), costs: [old.cost] }],
    } as Session
    vi.mocked(chatStore.listAllSessionsMeta).mockResolvedValue([{ id: 'a' }, { id: 'b' }] as Awaited<
      ReturnType<typeof chatStore.listAllSessionsMeta>
    >)
    vi.mocked(chatStore.getSession).mockResolvedValueOnce(session).mockRejectedValueOnce(new Error('read failed'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await store.importSpendingHistory()
      expect(store.spendingStore.getState()).toMatchObject({
        error: true,
        stats: { historyImported: false, months: {} },
      })
      vi.mocked(chatStore.getSession).mockResolvedValue(session)
      await store.importSpendingHistory()
      expect(store.spendingStore.getState().stats?.months['2026-10'].totals.requests).toBe(1)
    } finally {
      log.mockRestore()
    }
  })

  it('expires an entire old month on load and after the next calendar boundary', async () => {
    const state = createSpendingStats(new Date(2026, 8, 1).getTime())
    addSpendingRecord(state, usage(new Date(2026, 8, 1).getTime()), now)
    addSpendingRecord(state, usage(now.getTime()), now)
    vi.mocked(storage.getItem).mockResolvedValue(state)
    const store = await import('./spending-store')
    await store.refreshSpendingStats()
    vi.setSystemTime(new Date(2026, 10, 1))
    await store.refreshSpendingStats()
    expect(Object.keys(store.spendingStore.getState().stats?.months ?? {})).toEqual(['2026-10'])
    const persisted = vi.mocked(storage.setItem).mock.calls.at(-1)?.[1] as typeof state
    expect(persisted.months['2026-09']).toBeUndefined()
  })
})
