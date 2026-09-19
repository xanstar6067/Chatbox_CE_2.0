import { describe, expect, it } from 'vitest'
import {
  getImageModelFamily,
  getRatioOptionsForModel,
  KNOWN_GEMINI_IMAGE_MODELS,
  KNOWN_XAI_IMAGE_MODELS,
} from './image-models'

describe('image model definitions', () => {
  it('includes every current Nano Banana model', () => {
    expect(KNOWN_GEMINI_IMAGE_MODELS.map((model) => model.modelId)).toEqual([
      'gemini-3.1-flash-lite-image',
      'gemini-3.1-flash-image',
      'gemini-3-pro-image',
      'gemini-2.5-flash-image',
    ])
  })

  it('recognizes Grok Imagine models and their aspect ratios', () => {
    expect(KNOWN_XAI_IMAGE_MODELS.map((model) => model.modelId)).toEqual([
      'grok-imagine-image-2.0',
      'grok-imagine-image',
    ])
    expect(getImageModelFamily('grok-imagine-image-2.0')).toBe('xai')
    expect(getImageModelFamily('grok-imagine-image-quality')).toBe('xai')
    expect(getRatioOptionsForModel('grok-imagine-image')).toContain('19.5:9')
    expect(getRatioOptionsForModel('grok-imagine-image-2.0')).toEqual(expect.arrayContaining(['21:9', '5:2']))
  })
})
