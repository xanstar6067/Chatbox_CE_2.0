import type { CopilotDetail, ImageSource } from '@shared/types'

export const COPILOT_MEDIA_BACKUP_KEY = '__copilot_media'

type BlobStorage = {
  getBlob(key: string): Promise<string | null>
  setBlob(key: string, value: string): Promise<unknown>
  delBlob(key: string): Promise<unknown>
}

type CopilotMediaBackup = {
  version: 1
  blobs: Record<string, string>
}

function addImageSourceStorageKey(keys: Set<string>, source?: ImageSource) {
  if (source?.type === 'storage-key' && source.storageKey) {
    keys.add(source.storageKey)
  }
}

export function getCopilotMediaStorageKeys(copilot: CopilotDetail): Set<string> {
  const keys = new Set<string>()
  addImageSourceStorageKey(keys, copilot.avatar)
  addImageSourceStorageKey(keys, copilot.backgroundImage)
  for (const screenshot of copilot.screenshots ?? []) {
    addImageSourceStorageKey(keys, screenshot)
  }
  return keys
}

export function getCopilotsMediaStorageKeys(copilots: CopilotDetail[]): Set<string> {
  const keys = new Set<string>()
  for (const copilot of copilots) {
    for (const key of getCopilotMediaStorageKeys(copilot)) {
      keys.add(key)
    }
  }
  return keys
}

export async function deleteCopilotMedia(storageKeys: Iterable<string>, blobStorage: BlobStorage): Promise<void> {
  await Promise.allSettled(Array.from(new Set(storageKeys), (key) => blobStorage.delBlob(key)))
}

export function getRemovedCopilotMediaKeys(previous: CopilotDetail[], next: CopilotDetail[]): Set<string> {
  const previousKeys = getCopilotsMediaStorageKeys(previous)
  const nextKeys = getCopilotsMediaStorageKeys(next)
  return new Set(Array.from(previousKeys).filter((key) => !nextKeys.has(key)))
}

export async function addCopilotMediaToBackup(
  backupData: Record<string, unknown>,
  copilots: CopilotDetail[],
  blobStorage: BlobStorage
): Promise<void> {
  const blobs: Record<string, string> = {}
  for (const key of getCopilotsMediaStorageKeys(copilots)) {
    const value = await blobStorage.getBlob(key)
    if (value) {
      blobs[key] = value
    }
  }
  const mediaBackup: CopilotMediaBackup = { version: 1, blobs }
  backupData[COPILOT_MEDIA_BACKUP_KEY] = mediaBackup
}

export async function restoreCopilotMediaFromBackup(
  importData: Record<string, unknown>,
  copilots: CopilotDetail[],
  blobStorage: BlobStorage
): Promise<number> {
  const rawMediaBackup = importData[COPILOT_MEDIA_BACKUP_KEY]
  delete importData[COPILOT_MEDIA_BACKUP_KEY]

  if (!rawMediaBackup || typeof rawMediaBackup !== 'object') {
    return 0
  }

  const mediaBackup = rawMediaBackup as Partial<CopilotMediaBackup>
  if (mediaBackup.version !== 1 || !mediaBackup.blobs || typeof mediaBackup.blobs !== 'object') {
    return 0
  }

  const referencedKeys = getCopilotsMediaStorageKeys(copilots)
  let restoredCount = 0
  for (const [key, value] of Object.entries(mediaBackup.blobs)) {
    if (!referencedKeys.has(key) || typeof value !== 'string') {
      continue
    }
    await blobStorage.setBlob(key, value)
    restoredCount++
  }
  return restoredCount
}
