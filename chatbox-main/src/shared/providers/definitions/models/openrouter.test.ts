import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { CallChatCompletionOptions } from '@shared/models/types'
import type { ProviderModelInfo } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import type { SentryScope } from '@shared/utils/sentry_adapter'
import { generateText } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import OpenRouter, { createOpenRouterWebSearchFetch } from './openrouter'

class TestOpenRouter extends OpenRouter {
  public exposeCallSettings(options: CallChatCompletionOptions = {}) {
    return this.getCallSettings(options)
  }
}

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
  return new TestOpenRouter(
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

  it('sends the selected reasoning effort for the model it was chosen for', () => {
    const model = createModel({ modelId: 'anthropic/claude-opus-5', capabilities: ['reasoning'] })

    expect(
      model.exposeCallSettings({
        providerOptions: { openrouter: { reasoningEffort: 'xhigh', modelId: 'anthropic/claude-opus-5' } },
      }).providerOptions
    ).toEqual({ openrouter: { reasoning: { effort: 'xhigh', exclude: false } } })
  })

  it('disables reasoning through the enabled flag instead of an effort value', () => {
    // Anthropic models reject `effort: 'none'`, so the disable path must not send it.
    const model = createModel({ modelId: 'anthropic/claude-opus-5', capabilities: ['reasoning'] })

    expect(
      model.exposeCallSettings({ providerOptions: { openrouter: { reasoningEffort: 'none' } } }).providerOptions
    ).toEqual({ openrouter: { reasoning: { enabled: false, exclude: true } } })
  })

  it('does not reuse a reasoning effort chosen for another model', () => {
    const model = createModel({ modelId: 'google/gemini-3.8-flash', capabilities: ['reasoning'] })

    expect(
      model.exposeCallSettings({
        providerOptions: { openrouter: { reasoningEffort: 'max', modelId: 'anthropic/claude-opus-5' } },
      }).providerOptions
    ).toBeUndefined()
    expect(model.exposeCallSettings().providerOptions).toBeUndefined()
  })

  it('serializes the reasoning provider option into the OpenRouter request body', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'gen-1',
            model: 'anthropic/claude-opus-5',
            choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    const model = createModel({ modelId: 'anthropic/claude-opus-5', capabilities: ['reasoning'] })
    const { providerOptions } = model.exposeCallSettings({
      providerOptions: { openrouter: { reasoningEffort: 'low' } },
    })

    await generateText({
      model: createOpenRouter({ apiKey: 'test', fetch }).languageModel('anthropic/claude-opus-5'),
      prompt: 'Hi',
      providerOptions,
    })

    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string).reasoning).toEqual({ effort: 'low', exclude: false })
  })

  it('reads tool use, reasoning and output limits from the OpenRouter model catalog', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.request.apiRequest).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'google/gemini-3.8-flash',
              name: 'Google: Gemini 3.8 Flash',
              context_length: 1_048_576,
              architecture: { input_modalities: ['text', 'image'] },
              pricing: { prompt: '0.00000075', completion: '0.00000375' },
              top_provider: { max_completion_tokens: 65_536 },
              supported_parameters: ['reasoning', 'tools', 'tool_choice'],
            },
            {
              id: 'some/legacy-reasoner',
              context_length: 200_000,
              architecture: { input_modalities: ['text'] },
              // Models that predate the unified `reasoning` object expose the control
              // under these names instead.
              supported_parameters: ['include_reasoning', 'reasoning_effort'],
            },
            {
              id: 'some/plain-model',
              context_length: 8192,
              architecture: { input_modalities: ['text'] },
              top_provider: { max_completion_tokens: null },
              supported_parameters: ['temperature'],
            },
          ],
        }),
        { status: 200 }
      )
    )
    const model = createModel({ modelId: 'google/gemini-3.8-flash' }, dependencies)

    await expect(model.listModels()).resolves.toEqual([
      {
        modelId: 'google/gemini-3.8-flash',
        type: 'chat',
        nickname: 'Google: Gemini 3.8 Flash',
        contextWindow: 1_048_576,
        maxOutput: 65_536,
        capabilities: ['vision', 'reasoning', 'tool_use'],
      },
      {
        modelId: 'some/legacy-reasoner',
        type: 'chat',
        contextWindow: 200_000,
        capabilities: ['reasoning'],
      },
      { modelId: 'some/plain-model', type: 'chat', contextWindow: 8192 },
    ])
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
