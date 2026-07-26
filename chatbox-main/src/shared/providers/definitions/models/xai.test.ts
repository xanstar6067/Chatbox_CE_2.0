import type { CallChatCompletionOptions } from '@shared/models/types'
import type { ProviderModelInfo } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import type { SentryScope } from '@shared/utils/sentry_adapter'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import XAI, { isXaiMultiAgentModel } from './xai'

class TestXAI extends XAI {
  public exposeCallSettings(options: CallChatCompletionOptions = {}) {
    return this.getCallSettings(options)
  }
}

const apiRequest = vi.fn()

function createDependencies(): ModelDependencies {
  return {
    request: {
      apiRequest,
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
  return new TestXAI(
    {
      apiKey: 'xai-test-key',
      model,
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 4096,
    },
    createDependencies()
  )
}

describe('XAI', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('routes every Grok 4.20 Multi-Agent alias through Responses-compatible settings', () => {
    expect(isXaiMultiAgentModel('grok-4.20-multi-agent')).toBe(true)
    expect(isXaiMultiAgentModel('grok-4.20-multi-agent-experimental-beta-0304')).toBe(true)
    expect(isXaiMultiAgentModel('grok-4.20-experimental-beta-0304-reasoning')).toBe(false)

    const model = createModel({
      modelId: 'grok-4.20-multi-agent-experimental-beta-0304',
      capabilities: ['reasoning', 'tool_use'],
    })

    expect(model.isSupportToolUse()).toBe(false)
    expect(model.exposeCallSettings()).toEqual({
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          store: false,
        },
      },
    })
  })

  it('exposes xAI server-side web search through Responses settings', () => {
    const model = createModel({
      modelId: 'grok-4-fast',
      capabilities: ['reasoning', 'tool_use'],
    })

    expect(model.getNativeWebSearch()?.provider).toBe('xAI Search')
    expect(model.getNativeWebSearch()?.tools.web_search).toBeDefined()
    expect(model.exposeCallSettings({ webSearchMode: 'model' })).toEqual({
      providerOptions: {
        openai: {
          store: false,
        },
      },
    })
  })

  it('requests Grok Imagine output as base64 without fetching imgen.x.ai', async () => {
    apiRequest.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ b64_json: 'AQID', mime_type: 'image/jpeg' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const model = createModel({ modelId: 'grok-imagine-image-quality', type: 'image' })
    const callback = vi.fn()
    const result = await model.paint({ prompt: 'A cat astronaut', num: 1, aspectRatio: '16:9' }, undefined, callback)

    expect(JSON.parse(apiRequest.mock.calls[0][0].body)).toEqual({
      model: 'grok-imagine-image-quality',
      prompt: 'A cat astronaut',
      n: 1,
      response_format: 'b64_json',
      aspect_ratio: '16:9',
    })
    expect(apiRequest.mock.calls[0][0].url).toBe('https://api.x.ai/v1/images/generations')
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(result).toEqual(['data:image/jpeg;base64,AQID'])
    expect(callback).toHaveBeenCalledWith('data:image/jpeg;base64,AQID')
  })
})
