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

function createModel(model: ProviderModelInfo) {
  return new OpenRouter(
    {
      apiKey: 'openrouter-test-key',
      model,
    },
    createDependencies()
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
})
