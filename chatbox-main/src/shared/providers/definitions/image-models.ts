export interface KnownImageModel {
  modelId: string
  displayName: string
}

export const KNOWN_GEMINI_IMAGE_MODELS: KnownImageModel[] = [
  { modelId: 'gemini-3.1-flash-lite-image', displayName: 'Nano Banana 2 Lite' },
  { modelId: 'gemini-3.1-flash-image', displayName: 'Nano Banana 2' },
  { modelId: 'gemini-3-pro-image', displayName: 'Nano Banana Pro' },
  { modelId: 'gemini-2.5-flash-image', displayName: 'Nano Banana' },
]

// grok-imagine-image-quality retires on 2026-11-02 and redirects to grok-imagine-image-2.0.
export const KNOWN_XAI_IMAGE_MODELS: KnownImageModel[] = [
  { modelId: 'grok-imagine-image-2.0', displayName: 'Grok Imagine 2.0' },
  { modelId: 'grok-imagine-image', displayName: 'Grok Imagine' },
]

export type ImageModelFamily = 'gemini' | 'openai' | 'xai'

const RATIO_OPTIONS: Record<ImageModelFamily | 'default', string[]> = {
  openai: ['auto', '1:1', '3:2', '2:3'],
  gemini: ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9'],
  xai: [
    'auto',
    '1:1',
    '16:9',
    '9:16',
    '4:3',
    '3:4',
    '3:2',
    '2:3',
    '2:1',
    '1:2',
    '19.5:9',
    '9:19.5',
    '20:9',
    '9:20',
    '21:9',
    '5:2',
  ],
  default: ['auto', '1:1', '3:2', '2:3'],
}

export function getImageModelFamily(modelId: string): ImageModelFamily | 'default' {
  if (modelId.includes('gemini') && modelId.includes('image')) return 'gemini'
  if (modelId.startsWith('grok-imagine-image')) return 'xai'
  if (modelId.startsWith('gpt-image')) return 'openai'
  return 'default'
}

export function isGeminiImageModel(modelId: string): boolean {
  return getImageModelFamily(modelId) === 'gemini'
}

export function getRatioOptionsForModel(modelId: string): string[] {
  return RATIO_OPTIONS[getImageModelFamily(modelId)] ?? RATIO_OPTIONS.default
}
