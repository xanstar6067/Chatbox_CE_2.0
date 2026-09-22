import type { Session, SessionMetaRecord } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()
const blobs = new Map<string, string>()

vi.mock('@/platform', () => ({
  default: {
    // 'desktop' keeps the module from scheduling its own startup run in tests
    type: 'desktop',
    appLog: async () => undefined,
    getStorageType: () => 'web',
    setStoreValue: (key: string, value: unknown) => {
      store.set(key, value)
      return Promise.resolve()
    },
    getStoreValue: async (key: string) => store.get(key) ?? null,
    delStoreValue: (key: string) => {
      store.delete(key)
      return Promise.resolve()
    },
    getAllStoreValues: async () => Object.fromEntries(store),
    getAllStoreKeys: async () => Array.from(store.keys()),
    setAllStoreValues: async () => undefined,
    setStoreBlob: (key: string, value: string) => {
      blobs.set(key, value)
      return Promise.resolve()
    },
    getStoreBlob: async (key: string) => blobs.get(key) ?? null,
    delStoreBlob: (key: string) => {
      blobs.delete(key)
      return Promise.resolve()
    },
    listStoreBlobKeys: async () => Array.from(blobs.keys()),
    getImageGenerationStorage: () => ({
      initialize: async () => undefined,
      getTotal: async () => 0,
      getPage: async () => ({ items: [], nextCursor: null, total: 0 }),
    }),
  },
}))

const listAllSessionsMeta = vi.fn(async (): Promise<SessionMetaRecord[]> => [])
vi.mock('@/stores/chatStore', () => ({
  listAllSessionsMeta: () => listAllSessionsMeta(),
  // the paginated list the cleanup used to rely on: only ever the first page, hidden excluded
  listSessionsMeta: async () => [],
}))

const getSettings = vi.fn(() => ({}) as Record<string, unknown>)
vi.mock('@/stores/settingsStore', () => ({
  initSettingsStore: async () => undefined,
  settingsStore: { getState: () => ({ getSettings }) },
}))

function createSession(id: string, overrides: Partial<Session> = {}): Session {
  return { id, name: id, type: 'chat', messages: [], ...overrides } as Session
}

describe('tickStorageTask', () => {
  beforeEach(() => {
    store.clear()
    blobs.clear()
    listAllSessionsMeta.mockResolvedValue([])
    getSettings.mockReturnValue({})
    vi.resetModules()
  })

  it('keeps media of sessions missing from the session list, and drops orphans', async () => {
    // The session list is paginated (50 per page) and hides migrated sessions, so it
    // cannot be the source of truth for what is still referenced.
    store.set(
      'session:beyond-first-page',
      createSession('beyond-first-page', {
        assistantAvatarKey: 'picture:assistant-avatar:beyond-first-page',
        backgroundImage: { type: 'storage-key', storageKey: 'picture:session-bg:beyond-first-page' },
      })
    )
    store.set(
      'session:hidden',
      createSession('hidden', { assistantAvatarKey: 'picture:assistant-avatar:hidden', hidden: true })
    )
    blobs.set('picture:assistant-avatar:beyond-first-page', 'avatar')
    blobs.set('picture:session-bg:beyond-first-page', 'background')
    blobs.set('picture:assistant-avatar:hidden', 'hidden-avatar')
    blobs.set('picture:deleted-session:1', 'orphan')

    const { tickStorageTask } = await import('./storage_clear')
    await tickStorageTask()

    expect(Array.from(blobs.keys()).sort()).toEqual([
      'picture:assistant-avatar:beyond-first-page',
      'picture:assistant-avatar:hidden',
      'picture:session-bg:beyond-first-page',
    ])
  })

  it('keeps global avatars, background and copilot media', async () => {
    getSettings.mockReturnValue({
      userAvatarKey: 'picture:user-avatar:1',
      defaultAssistantAvatarKey: 'picture:default-assistant-avatar:1',
      backgroundImageKey: 'picture:background-image:1',
    })
    store.set('myCopilots', [
      { id: 'c1', name: 'Copilot', prompt: '', avatar: { type: 'storage-key', storageKey: 'picture:copilot-icon:c1' } },
    ])
    for (const key of [
      'picture:user-avatar:1',
      'picture:default-assistant-avatar:1',
      'picture:background-image:1',
      'picture:copilot-icon:c1',
      'picture:orphan:1',
    ]) {
      blobs.set(key, 'data')
    }

    const { tickStorageTask } = await import('./storage_clear')
    await tickStorageTask()

    expect(Array.from(blobs.keys()).sort()).toEqual([
      'picture:background-image:1',
      'picture:copilot-icon:c1',
      'picture:default-assistant-avatar:1',
      'picture:user-avatar:1',
    ])
  })

  it('keeps media referenced only by session meta', async () => {
    listAllSessionsMeta.mockResolvedValue([
      {
        id: 's1',
        name: 's1',
        sortOrder: 1,
        createdAt: 1,
        assistantAvatarKey: 'picture:assistant-avatar:s1',
        backgroundImage: { type: 'storage-key', storageKey: 'picture:session-bg:s1' },
      } as SessionMetaRecord,
    ])
    blobs.set('picture:assistant-avatar:s1', 'avatar')
    blobs.set('picture:session-bg:s1', 'background')

    const { tickStorageTask } = await import('./storage_clear')
    await tickStorageTask()

    expect(Array.from(blobs.keys()).sort()).toEqual(['picture:assistant-avatar:s1', 'picture:session-bg:s1'])
  })
})
