import { type VideoGeneration, VideoGenerationSchema } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { createStore, useStore } from 'zustand'
import storage from '@/storage'

const STORAGE_KEY = 'video-generation-records'
export const VIDEO_GEN_LIST_QUERY_KEY = 'video-generation-list'
export const VIDEO_GEN_QUERY_KEY = 'video-generation'

interface VideoGenerationUIState {
  currentGeneratingId: string | null
  currentRecordId: string | null
  setCurrentGeneratingId: (id: string | null) => void
  setCurrentRecordId: (id: string | null) => void
}

export const videoGenerationStore = createStore<VideoGenerationUIState>((set) => ({
  currentGeneratingId: null,
  currentRecordId: null,
  setCurrentGeneratingId: (id) => set({ currentGeneratingId: id }),
  setCurrentRecordId: (id) => set({ currentRecordId: id }),
}))

export async function listVideoRecords(): Promise<VideoGeneration[]> {
  const raw = await storage.getItem<unknown[]>(STORAGE_KEY, [])
  return raw
    .map((item) => VideoGenerationSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
    .sort((a, b) => b.createdAt - a.createdAt)
}

async function writeRecords(records: VideoGeneration[]) {
  await storage.setItemNow(STORAGE_KEY, records.slice(0, 200))
}

export async function getVideoRecord(id: string) {
  return (await listVideoRecords()).find((record) => record.id === id) || null
}

export async function createVideoRecord(params: Omit<VideoGeneration, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
  const now = Date.now()
  const record: VideoGeneration = {
    ...params,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
  }
  await writeRecords([record, ...(await listVideoRecords())])
  return record
}

export async function updateVideoRecord(id: string, updates: Partial<VideoGeneration>) {
  const records = await listVideoRecords()
  let updated: VideoGeneration | null = null
  const next = records.map((record) => {
    if (record.id !== id) return record
    updated = { ...record, ...updates, updatedAt: Date.now() }
    return updated
  })
  if (updated) await writeRecords(next)
  return updated
}

export async function removeVideoRecord(id: string) {
  const records = await listVideoRecords()
  const record = records.find((item) => item.id === id) || null
  await writeRecords(records.filter((item) => item.id !== id))
  if (videoGenerationStore.getState().currentRecordId === id) {
    videoGenerationStore.getState().setCurrentRecordId(null)
  }
  return record
}

export function useVideoGenerationHistory() {
  return useQuery({
    queryKey: [VIDEO_GEN_LIST_QUERY_KEY],
    queryFn: listVideoRecords,
    staleTime: 5 * 60 * 1000,
  })
}

export function useVideoGenerationRecord(id: string | null) {
  return useQuery({
    queryKey: [VIDEO_GEN_QUERY_KEY, id],
    queryFn: () => (id ? getVideoRecord(id) : null),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCurrentVideoRecordId() {
  return useStore(videoGenerationStore, (state) => state.currentRecordId)
}

export function useCurrentVideoGeneratingId() {
  return useStore(videoGenerationStore, (state) => state.currentGeneratingId)
}
