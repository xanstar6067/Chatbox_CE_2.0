import type { CopilotDetail, ImageSource } from '@shared/types'
import { getCopilotsMediaStorageKeys } from './copilot-media'

/**
 * Avatars and background images are stored as blobs, outside of the key-value
 * store that holds settings and sessions. Those only keep the blob key, so a
 * backup that exports key-value data alone restores broken image references.
 *
 * This section carries the blob payloads alongside the regular backup data. It
 * is prefixed with `__` like the other backup metadata keys, so that importers
 * which do not know about it (older builds, the upstream app) skip it instead
 * of writing it back as a regular value: a backup stays importable elsewhere,
 * and a backup produced elsewhere simply restores without images.
 */
export const MEDIA_BACKUP_KEY = '__blobs'

/** Blob key prefixes a backup may write back into blob storage. */
const RESTORABLE_BLOB_PREFIXES = ['picture:', 'video:', 'file:']

export type MediaBackupSection = {
  version: 1
  blobs: Record<string, string>
}

type BlobStorage = {
  getBlob(key: string): Promise<string | null>
  setBlob(key: string, value: string): Promise<unknown>
}

/** Anything carrying per-conversation media: the stored session or its meta record. */
type SessionMediaHolder = {
  assistantAvatarKey?: string
  backgroundImage?: ImageSource
}

type SettingsMediaHolder = {
  userAvatarKey?: string
  defaultAssistantAvatarKey?: string
  backgroundImageKey?: string
}

function addKey(keys: Set<string>, key?: string) {
  if (typeof key === 'string' && key !== '') {
    keys.add(key)
  }
}

function addImageSource(keys: Set<string>, source?: ImageSource) {
  if (source?.type === 'storage-key') {
    addKey(keys, source.storageKey)
  }
}

/** Blob keys of the global user avatar, default assistant avatar and background image. */
export function getSettingsMediaStorageKeys(settings?: SettingsMediaHolder | null): Set<string> {
  const keys = new Set<string>()
  if (!settings) {
    return keys
  }
  addKey(keys, settings.userAvatarKey)
  addKey(keys, settings.defaultAssistantAvatarKey)
  addKey(keys, settings.backgroundImageKey)
  return keys
}

/** Blob keys of a conversation's own assistant avatar and background image. */
export function getSessionMediaStorageKeys(session?: SessionMediaHolder | null): Set<string> {
  const keys = new Set<string>()
  if (!session) {
    return keys
  }
  addKey(keys, session.assistantAvatarKey)
  addImageSource(keys, session.backgroundImage)
  return keys
}

export type MediaStorageKeySources = {
  settings?: SettingsMediaHolder | null
  sessions?: (SessionMediaHolder | null | undefined)[]
  copilots?: CopilotDetail[]
}

/** Add every blob key referenced by the given data to the target set. */
export function addMediaStorageKeys(keys: Set<string>, sources: MediaStorageKeySources): Set<string> {
  for (const key of getSettingsMediaStorageKeys(sources.settings)) {
    keys.add(key)
  }
  for (const session of sources.sessions ?? []) {
    for (const key of getSessionMediaStorageKeys(session)) {
      keys.add(key)
    }
  }
  if (sources.copilots?.length) {
    for (const key of getCopilotsMediaStorageKeys(sources.copilots)) {
      keys.add(key)
    }
  }
  return keys
}

export function collectMediaStorageKeys(sources: MediaStorageKeySources): Set<string> {
  return addMediaStorageKeys(new Set<string>(), sources)
}

export function isRestorableBlobKey(key: string): boolean {
  return RESTORABLE_BLOB_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export function parseMediaBackupSection(raw: unknown): MediaBackupSection | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const section = raw as Partial<MediaBackupSection>
  if (section.version !== 1 || !section.blobs || typeof section.blobs !== 'object') {
    return null
  }
  return { version: 1, blobs: section.blobs }
}

/**
 * Stream the media section of a backup: `"__blobs":{"version":1,"blobs":{…}}`.
 * Blobs are read and emitted one at a time so that a large backup never has to
 * be held in memory as a single string.
 */
export async function* streamMediaBackupSection(
  storageKeys: Iterable<string>,
  blobStorage: Pick<BlobStorage, 'getBlob'>
): AsyncGenerator<string, void, unknown> {
  yield `${JSON.stringify(MEDIA_BACKUP_KEY)}:{"version":1,"blobs":{`
  let isFirstBlob = true
  for (const key of storageKeys) {
    try {
      const blob = await blobStorage.getBlob(key)
      if (typeof blob !== 'string' || blob === '') {
        continue
      }
      yield `${isFirstBlob ? '' : ','}${JSON.stringify(key)}:${JSON.stringify(blob)}`
      isFirstBlob = false
    } catch (error) {
      console.warn(`Failed to export blob ${key}:`, error)
    }
  }
  yield '}}'
}

/**
 * Write the blobs of a backup back into blob storage. Returns the number of
 * restored blobs; a backup without a media section restores nothing and is not
 * an error.
 */
export async function restoreMediaBackup(
  importData: Record<string, unknown>,
  blobStorage: Pick<BlobStorage, 'setBlob'>
): Promise<number> {
  const section = parseMediaBackupSection(importData[MEDIA_BACKUP_KEY])
  delete importData[MEDIA_BACKUP_KEY]
  if (!section) {
    return 0
  }

  let restoredCount = 0
  for (const [key, value] of Object.entries(section.blobs)) {
    if (typeof value !== 'string' || value === '' || !isRestorableBlobKey(key)) {
      continue
    }
    await blobStorage.setBlob(key, value)
    restoredCount++
  }
  return restoredCount
}
