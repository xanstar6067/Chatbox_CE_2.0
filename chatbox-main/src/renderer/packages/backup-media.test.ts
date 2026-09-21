import type { CopilotDetail } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import {
  collectMediaStorageKeys,
  getSessionMediaStorageKeys,
  getSettingsMediaStorageKeys,
  MEDIA_BACKUP_KEY,
  restoreMediaBackup,
  streamMediaBackupSection,
} from './backup-media'

async function collectStream(generator: AsyncGenerator<string, void, unknown>): Promise<string> {
  let out = ''
  for await (const chunk of generator) {
    out += chunk
  }
  return out
}

describe('backup media storage keys', () => {
  it('collects global avatars and background, skipping empty defaults', () => {
    expect(
      Array.from(
        getSettingsMediaStorageKeys({
          userAvatarKey: 'picture:user-avatar:1',
          defaultAssistantAvatarKey: '',
          backgroundImageKey: 'picture:background-image:1',
        })
      )
    ).toEqual(['picture:user-avatar:1', 'picture:background-image:1'])
  })

  it('collects per-conversation avatar and background, ignoring remote URLs', () => {
    expect(
      Array.from(
        getSessionMediaStorageKeys({
          assistantAvatarKey: 'picture:assistant-avatar:s1',
          backgroundImage: { type: 'storage-key', storageKey: 'picture:session-bg:s1' },
        })
      )
    ).toEqual(['picture:assistant-avatar:s1', 'picture:session-bg:s1'])

    expect(
      Array.from(getSessionMediaStorageKeys({ backgroundImage: { type: 'url', url: 'https://example.com/bg.png' } }))
    ).toEqual([])
  })

  it('collects settings, session and copilot media into one deduplicated set', () => {
    const copilots: CopilotDetail[] = [
      { id: 'c1', name: 'Copilot', prompt: '', avatar: { type: 'storage-key', storageKey: 'picture:copilot-icon:c1' } },
    ]
    const keys = collectMediaStorageKeys({
      settings: { userAvatarKey: 'picture:user-avatar:1' },
      sessions: [
        { assistantAvatarKey: 'picture:assistant-avatar:s1' },
        { assistantAvatarKey: 'picture:assistant-avatar:s1' },
        null,
      ],
      copilots,
    })

    expect(Array.from(keys)).toEqual([
      'picture:user-avatar:1',
      'picture:assistant-avatar:s1',
      'picture:copilot-icon:c1',
    ])
  })
})

describe('backup media section', () => {
  it('streams a valid JSON section and skips missing blobs', async () => {
    const getBlob = vi.fn(async (key: string) => (key === 'picture:missing' ? null : `data:image/png;base64,${key}`))

    const json = await collectStream(
      streamMediaBackupSection(['picture:a', 'picture:missing', 'picture:b'], { getBlob })
    )

    expect(JSON.parse(`{${json}}`)).toEqual({
      [MEDIA_BACKUP_KEY]: {
        version: 1,
        blobs: {
          'picture:a': 'data:image/png;base64,picture:a',
          'picture:b': 'data:image/png;base64,picture:b',
        },
      },
    })
  })

  it('streams a valid empty section when nothing is referenced', async () => {
    const json = await collectStream(streamMediaBackupSection([], { getBlob: vi.fn(async () => null) }))

    expect(JSON.parse(`{${json}}`)).toEqual({ [MEDIA_BACKUP_KEY]: { version: 1, blobs: {} } })
  })

  it('restores blobs and drops the section from the imported data', async () => {
    const setBlob = vi.fn(async () => undefined)
    const importData: Record<string, unknown> = {
      settings: { userAvatarKey: 'picture:user-avatar:1' },
      [MEDIA_BACKUP_KEY]: {
        version: 1,
        blobs: {
          'picture:user-avatar:1': 'data:image/png;base64,avatar',
          settings: 'not a blob key',
          'picture:empty': '',
        },
      },
    }

    const restored = await restoreMediaBackup(importData, { setBlob })

    expect(restored).toBe(1)
    expect(setBlob).toHaveBeenCalledTimes(1)
    expect(setBlob).toHaveBeenCalledWith('picture:user-avatar:1', 'data:image/png;base64,avatar')
    expect(importData).not.toHaveProperty(MEDIA_BACKUP_KEY)
  })

  it('imports a backup without a media section without failing', async () => {
    const setBlob = vi.fn(async () => undefined)

    await expect(restoreMediaBackup({ settings: {} }, { setBlob })).resolves.toBe(0)
    await expect(restoreMediaBackup({ [MEDIA_BACKUP_KEY]: { version: 2 } }, { setBlob })).resolves.toBe(0)
    expect(setBlob).not.toHaveBeenCalled()
  })
})
