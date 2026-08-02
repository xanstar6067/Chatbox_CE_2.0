import { z } from 'zod'

export const VideoGenerationJobStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
])
export type VideoGenerationJobStatus = z.infer<typeof VideoGenerationJobStatusSchema>

export const VideoGenerationStatusSchema = z.enum([
  'pending',
  'in_progress',
  'downloading',
  'completed',
  'failed',
  'cancelled',
  'expired',
])
export type VideoGenerationStatus = z.infer<typeof VideoGenerationStatusSchema>

export const VideoGenerationModelSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
})
export type VideoGenerationModel = z.infer<typeof VideoGenerationModelSchema>

export const VideoGenerationSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  referenceImage: z.string().optional(),
  generatedVideo: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  model: VideoGenerationModelSchema,
  status: VideoGenerationStatusSchema,
  taskId: z.string().optional(),
  pollingUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  aspectRatio: z.string(),
  resolution: z.string(),
  duration: z.number(),
  generateAudio: z.boolean().optional(),
  progress: z.number().optional(),
  cost: z.number().optional(),
  error: z.string().optional(),
})
export type VideoGeneration = z.infer<typeof VideoGenerationSchema>

export interface VideoGenerationInput {
  prompt: string
  image?: { imageUrl: string }
  aspectRatio: string
  resolution: string
  duration: number
  generateAudio?: boolean
}

export interface VideoGenerationJob {
  id: string
  status: VideoGenerationJobStatus
  pollingUrl?: string
  videoUrl?: string
  progress?: number
  cost?: number
  error?: string
}

export interface DownloadedVideo {
  dataUrl: string
  mediaType: string
}
