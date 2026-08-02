import type { ProviderModelInfo } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import type { SentryScope } from '@shared/utils/sentry_adapter'
import { describe, expect, it, vi } from 'vitest'
import OpenRouter, { createOpenRouterWebSearchFetch } from './openrouter'

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

function createModel(model: ProviderModelInfo, dependencies = createDependencies()) {
  return new OpenRouter(
    {
      apiKey: 'openrouter-test-key',
      model,
    },
    dependencies
  )
}

describe('OpenRouter', () => {
  it('exposes OpenRouter server-side web search for chat models', () => {
    const model = createModel({
      modelId: 'x-ai/grok-4',
      capabilities: ['reasoning', 'tool_use'],
    })

    expect(model.getNativeWebSearch()).toEqual({
      provider: 'OpenRouter Search',
      tools: {},
    })
  })

  it('does not expose web search for image models', () => {
    const model = createModel({
      modelId: 'openai/gpt-image-1',
      type: 'image',
    })

    expect(model.getNativeWebSearch()).toBeNull()
  })

  it('adds the OpenRouter web search server tool and preserves function tools', async () => {
    const baseFetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response('{}')))
    const webSearchFetch = createOpenRouterWebSearchFetch(baseFetch)

    await webSearchFetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'x-ai/grok-4',
        messages: [{ role: 'user', content: 'Latest news?' }],
        tools: [
          {
            type: 'function',
            function: { name: 'local_tool', parameters: { type: 'object' } },
          },
        ],
      }),
    })

    const request = JSON.parse(baseFetch.mock.calls[0][1]?.body as string)
    expect(request.tools).toEqual([
      {
        type: 'function',
        function: { name: 'local_tool', parameters: { type: 'object' } },
      },
      { type: 'openrouter:web_search' },
    ])
  })

  it('does not add a duplicate OpenRouter web search tool', async () => {
    const baseFetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response('{}')))
    const webSearchFetch = createOpenRouterWebSearchFetch(baseFetch)

    await webSearchFetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'x-ai/grok-4',
        messages: [{ role: 'user', content: 'Latest news?' }],
        tools: [{ type: 'openrouter:web_search' }],
      }),
    })

    const request = JSON.parse(baseFetch.mock.calls[0][1]?.body as string)
    expect(request.tools).toEqual([{ type: 'openrouter:web_search' }])
  })

  it('passes non-JSON request bodies through unchanged', async () => {
    const baseFetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response('{}')))
    const webSearchFetch = createOpenRouterWebSearchFetch(baseFetch)

    await webSearchFetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      body: 'not-json',
    })

    expect(baseFetch.mock.calls[0][1]?.body).toBe('not-json')
  })

  it('uses the dedicated image API with reference images', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.request.apiRequest).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ b64_json: 'AQID', media_type: 'image/webp' }] }), { status: 200 })
    )
    const model = createModel({ modelId: 'bytedance-seed/seedream-4.5', type: 'image' }, dependencies)

    await expect(
      model.paint({
        prompt: 'Watercolor city',
        images: [{ imageUrl: 'data:image/png;base64,AAAA' }],
        num: 1,
        aspectRatio: '16:9',
      })
    ).resolves.toEqual(['data:image/webp;base64,AQID'])

    expect(JSON.parse(vi.mocked(dependencies.request.apiRequest).mock.calls[0][0].body as string)).toEqual({
      model: 'bytedance-seed/seedream-4.5',
      prompt: 'Watercolor city',
      n: 1,
      aspect_ratio: '16:9',
      input_references: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }],
    })
  })

  it('submits and polls asynchronous video jobs', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.request.apiRequest)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'job-1', status: 'pending', polling_url: '/api/v1/videos/job-1' }), {
          status: 202,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'job-1',
            status: 'completed',
            unsigned_urls: ['/videos/job-1/content?index=0'],
            usage: { cost: 0.25 },
          }),
          { status: 200 }
        )
      )
    const model = createModel({ modelId: 'google/veo-3.1-fast', type: 'video' }, dependencies)
    const started = await model.startVideoGeneration({
      prompt: 'Sunrise',
      duration: 4,
      resolution: '720p',
      aspectRatio: '16:9',
      generateAudio: true,
    })
    const completed = await model.pollVideoGeneration(started)

    expect(started).toMatchObject({ id: 'job-1', status: 'pending' })
    expect(completed).toMatchObject({ id: 'job-1', status: 'completed', cost: 0.25 })
    expect(vi.mocked(dependencies.request.apiRequest).mock.calls[1][0].url).toBe(
      'https://openrouter.ai/api/v1/videos/job-1'
    )
  })
})
