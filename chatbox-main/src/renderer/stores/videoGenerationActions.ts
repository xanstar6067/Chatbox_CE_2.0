import type { VideoGeneration, VideoGenerationInput, VideoGenerationJob } from '@shared/types'
import { createModel } from '@/adapters'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { queryClient } from '@/stores/queryClient'
import {
  createVideoRecord,
  getVideoRecord,
  removeVideoRecord,
  updateVideoRecord,
  VIDEO_GEN_LIST_QUERY_KEY,
  VIDEO_GEN_QUERY_KEY,
  videoGenerationStore,
} from './videoGenerationStore'

export interface CreateVideoParams {
  prompt: string
  referenceImage?: string
  model: VideoGeneration['model']
  aspectRatio: string
  resolution: string
  duration: number
  generateAudio?: boolean
}

let currentAbortController: AbortController | null = null

function refreshRecord(record: VideoGeneration | null) {
  if (record) queryClient.setQueryData([VIDEO_GEN_QUERY_KEY, record.id], record)
  void queryClient.invalidateQueries({ queryKey: [VIDEO_GEN_LIST_QUERY_KEY] })
}

function assertVideoModel(model: Awaited<ReturnType<typeof createModel>>) {
  if (!model.startVideoGeneration || !model.pollVideoGeneration || !model.downloadVideo) {
    throw new Error('The selected provider does not support video generation')
  }
  return model as typeof model &
    Required<Pick<typeof model, 'startVideoGeneration' | 'pollVideoGeneration' | 'downloadVideo'>>
}

function pollInterval(provider: string) {
  if (provider === 'openrouter') return 30_000
  if (provider === 'gemini') return 10_000
  return 5_000
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

function persistJob(recordId: string, job: VideoGenerationJob) {
  return updateVideoRecord(recordId, {
    taskId: job.id,
    pollingUrl: job.pollingUrl,
    sourceUrl: job.videoUrl,
    status: job.status === 'pending' ? 'pending' : job.status,
    progress: job.progress,
    cost: job.cost,
    error: job.error,
  })
}

async function runVideoGeneration(recordId: string, resume: boolean) {
  const record = await getVideoRecord(recordId)
  if (!record) throw new Error('Video generation record not found')

  const model = assertVideoModel(await createModel({ provider: record.model.provider, modelId: record.model.modelId }))
  currentAbortController = new AbortController()
  const signal = currentAbortController.signal
  videoGenerationStore.getState().setCurrentGeneratingId(recordId)

  try {
    const input: VideoGenerationInput = {
      prompt: record.prompt,
      aspectRatio: record.aspectRatio,
      resolution: record.resolution,
      duration: record.duration,
      generateAudio: record.generateAudio,
    }
    if (record.referenceImage) {
      const imageUrl = await storage.getBlob(record.referenceImage)
      if (!imageUrl) throw new Error('The start frame is no longer available')
      input.image = { imageUrl }
    }

    let job: VideoGenerationJob
    if (resume) {
      if (!record.taskId) throw new Error('This record has no resumable job ID')
      job = {
        id: record.taskId,
        status: record.status === 'completed' ? 'completed' : 'in_progress',
        pollingUrl: record.pollingUrl,
        videoUrl: record.sourceUrl,
        progress: record.progress,
        cost: record.cost,
      }
    } else {
      job = await model.startVideoGeneration(input, signal)
      refreshRecord(await persistJob(recordId, job))
    }

    const deadline = Date.now() + 30 * 60 * 1000
    while (job.status === 'pending' || job.status === 'in_progress') {
      if (Date.now() > deadline) throw new Error('Video generation is taking longer than 30 minutes. Resume it later.')
      await wait(pollInterval(record.model.provider), signal)
      job = await model.pollVideoGeneration(job, signal)
      refreshRecord(await persistJob(recordId, job))
    }

    if (job.status !== 'completed') {
      throw new Error(job.error || `Video generation ${job.status}`)
    }

    refreshRecord(await updateVideoRecord(recordId, { status: 'downloading', sourceUrl: job.videoUrl }))
    const video = await model.downloadVideo(job, signal)
    const storageKey = StorageKeyGenerator.video(`video-gen:${recordId}`)
    await storage.setBlob(storageKey, video.dataUrl)
    refreshRecord(
      await updateVideoRecord(recordId, {
        generatedVideo: storageKey,
        sourceUrl: undefined,
        status: 'completed',
        progress: 100,
        error: undefined,
      })
    )
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    const message = error instanceof Error ? error.message : String(error)
    refreshRecord(await updateVideoRecord(recordId, { status: 'failed', error: message }))
    throw error
  } finally {
    currentAbortController = null
    videoGenerationStore.getState().setCurrentGeneratingId(null)
  }
}

export async function createAndGenerateVideo(params: CreateVideoParams) {
  if (videoGenerationStore.getState().currentGeneratingId) {
    throw new Error('Another video is already being generated')
  }
  const record = await createVideoRecord(params)
  videoGenerationStore.getState().setCurrentRecordId(record.id)
  refreshRecord(record)
  void runVideoGeneration(record.id, false).catch(() => undefined)
  return record
}

export function resumeVideoGeneration(recordId: string) {
  if (videoGenerationStore.getState().currentGeneratingId) {
    throw new Error('Another video is already being generated')
  }
  return runVideoGeneration(recordId, true)
}

export async function retryVideoGeneration(recordId: string) {
  if (videoGenerationStore.getState().currentGeneratingId) {
    throw new Error('Another video is already being generated')
  }
  const record = await getVideoRecord(recordId)
  if (!record) throw new Error('Video generation record not found')
  if (record.generatedVideo) await storage.delBlob(record.generatedVideo).catch(() => undefined)
  refreshRecord(
    await updateVideoRecord(recordId, {
      generatedVideo: undefined,
      sourceUrl: undefined,
      taskId: undefined,
      pollingUrl: undefined,
      progress: undefined,
      error: undefined,
      status: 'pending',
    })
  )
  return runVideoGeneration(recordId, false)
}

export function cancelVideoGeneration() {
  currentAbortController?.abort()
  currentAbortController = null
  videoGenerationStore.getState().setCurrentGeneratingId(null)
  void queryClient.invalidateQueries({ queryKey: [VIDEO_GEN_LIST_QUERY_KEY] })
}

export async function deleteVideoGeneration(recordId: string) {
  const record = await removeVideoRecord(recordId)
  for (const key of [record?.generatedVideo, record?.referenceImage]) {
    if (!key || (!key.startsWith('video:video-gen:') && !key.startsWith('picture:video-creator-ref:'))) continue
    await storage.delBlob(key).catch(() => undefined)
  }
  void queryClient.invalidateQueries({ queryKey: [VIDEO_GEN_LIST_QUERY_KEY] })
}
