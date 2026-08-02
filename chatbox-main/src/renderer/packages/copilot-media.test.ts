import type { CopilotDetail } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import {
  addCopilotMediaToBackup,
  COPILOT_MEDIA_BACKUP_KEY,
  getCopilotMediaStorageKeys,
  getRemovedCopilotMediaKeys,
  restoreCopilotMediaFromBackup,
} from './copilot-media'

function createCopilot(overrides: Partial<CopilotDetail> = {}): CopilotDetail {
  return {
    id: 'copilot-1',
    name: 'Copilot',
    prompt: 'Help me',
    ...overrides,
  }
}

describe('copilot media storage', () => {
  it('collects all local media and ignores remote URLs', () => {
    const copilot = createCopilot({
      avatar: { type: 'storage-key', storageKey: 'picture:avatar' },
      backgroundImage: { type: 'storage-key', storageKey: 'picture:background' },
      screenshots: [
        { type: 'url', url: 'https://example.com/screenshot.png' },
        { type: 'storage-key', storageKey: 'picture:screenshot' },
      ],
    })

    expect(Array.from(getCopilotMediaStorageKeys(copilot))).toEqual([
      'picture:avatar',
      'picture:background',
      'picture:screenshot',
    ])
  })

  it('only removes media no longer referenced by another copilot', () => {
    const sharedAvatar = { type: 'storage-key' as const, storageKey: 'picture:shared' }
    const previous = [
      createCopilot({ avatar: sharedAvatar, backgroundImage: { type: 'storage-key', storageKey: 'picture:old' } }),
      createCopilot({ id: 'copilot-2', avatar: sharedAvatar }),
    ]
    const next = [createCopilot({ id: 'copilot-2', avatar: sharedAvatar })]

    expect(Array.from(getRemovedCopilotMediaKeys(previous, next))).toEqual(['picture:old'])
  })

  it('backs up and restores referenced media', async () => {
    const copilots = [
      createCopilot({
        avatar: { type: 'storage-key', storageKey: 'picture:avatar' },
        backgroundImage: { type: 'storage-key', storageKey: 'picture:missing' },
      }),
    ]
    const getBlob = vi.fn(async (key: string) => (key === 'picture:avatar' ? 'data:image/png;base64,avatar' : null))
    const setBlob = vi.fn(async () => undefined)
    const delBlob = vi.fn(async () => undefined)
    const backupData: Record<string, unknown> = {}

    await addCopilotMediaToBackup(backupData, copilots, { getBlob, setBlob, delBlob })
    const mediaBackup = backupData[COPILOT_MEDIA_BACKUP_KEY] as { blobs: Record<string, string> }
    mediaBackup.blobs['picture:not-referenced'] = 'data:image/png;base64,ignored'

    const restored = await restoreCopilotMediaFromBackup(backupData, copilots, { getBlob, setBlob, delBlob })

    expect(restored).toBe(1)
    expect(setBlob).toHaveBeenCalledTimes(1)
    expect(setBlob).toHaveBeenCalledWith('picture:avatar', 'data:image/png;base64,avatar')
    expect(backupData).not.toHaveProperty(COPILOT_MEDIA_BACKUP_KEY)
  })

  it('accepts legacy backups without a media section', async () => {
    const importData = { myCopilots: [createCopilot()] }
    const storage = {
      getBlob: vi.fn(async () => null),
      setBlob: vi.fn(async () => undefined),
      delBlob: vi.fn(async () => undefined),
    }

    await expect(restoreCopilotMediaFromBackup(importData, importData.myCopilots, storage)).resolves.toBe(0)
    expect(storage.setBlob).not.toHaveBeenCalled()
  })
})
