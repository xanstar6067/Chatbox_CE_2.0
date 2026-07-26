import type { ModelDependencies } from '@shared/types/adapters'
import type { SentryScope } from '@shared/utils/sentry_adapter'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText,
}))

import Gemini from './gemini'

function createDependencies(): ModelDependencies {
  return {
    request: {
      apiRequest: vi.fn(),
      fetchWithOptions: vi.fn(),
    },
    storage: {
      saveImage: vi.fn(),
      getImage: vi.fn(),
    },
    sentry: {
      captureException: vi.fn(),
      withScope: vi.fn((callback: (scope: SentryScope) => void) =>
        callback({
          setTag: vi.fn(),
          setExtra: vi.fn(),
        })
      ),
    },
    getRemoteConfig: vi.fn(),
    platformType: 'desktop',
  }
}

describe('Gemini image generation', () => {
  beforeEach(() => {
    generateText.mockReset()
  })

  it('generates Nano Banana images with reference images and aspect ratio', async () => {
    generateText.mockResolvedValue({
      files: [{ mediaType: 'image/png', base64: 'AAAA' }],
    })
    const model = new Gemini(
      {
        geminiAPIKey: 'gemini-test-key',
        geminiAPIHost: 'https://generativelanguage.googleapis.com',
        model: { modelId: 'gemini-3.1-flash-image', type: 'image', capabilities: ['vision'] },
      },
      createDependencies()
    )
    const callback = vi.fn()

    const result = await model.paint(
      {
        prompt: 'Turn this into a watercolor',
        images: [{ imageUrl: 'data:image/png;base64,BBBB' }],
        num: 1,
        aspectRatio: '16:9',
      },
      undefined,
      callback
    )

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: 'data:image/png;base64,BBBB' },
              { type: 'text', text: 'Turn this into a watercolor' },
            ],
          },
        ],
        providerOptions: {
          google: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: '16:9' },
          },
        },
        maxRetries: 0,
      })
    )
    expect(result).toEqual(['data:image/png;base64,AAAA'])
    expect(callback).toHaveBeenCalledWith('data:image/png;base64,AAAA')
  })
})

describe('Gemini native web search', () => {
  it('uses Google Search when no custom tools are active', () => {
    const model = new Gemini(
      {
        geminiAPIKey: 'gemini-test-key',
        geminiAPIHost: 'https://generativelanguage.googleapis.com',
        model: { modelId: 'gemini-2.5-flash', type: 'chat' },
      },
      createDependencies()
    )

    const nativeSearch = model.getNativeWebSearch()

    expect(nativeSearch?.provider).toBe('Google Search')
    expect(nativeSearch?.tools.web_search).toBeDefined()
  })

  it('uses the fallback provider for Gemini 2.5 when custom tools are active', () => {
    const model = new Gemini(
      {
        geminiAPIKey: 'gemini-test-key',
        geminiAPIHost: 'https://generativelanguage.googleapis.com',
        model: { modelId: 'gemini-2.5-flash', type: 'chat' },
      },
      createDependencies()
    )

    expect(model.getNativeWebSearch({ hasCustomTools: true })).toBeNull()
  })

  it('can combine Google Search with custom tools on Gemini 3', () => {
    const model = new Gemini(
      {
        geminiAPIKey: 'gemini-test-key',
        geminiAPIHost: 'https://generativelanguage.googleapis.com',
        model: { modelId: 'gemini-3.1-pro-preview', type: 'chat' },
      },
      createDependencies()
    )

    expect(model.getNativeWebSearch({ hasCustomTools: true })?.tools.web_search).toBeDefined()
  })
})
