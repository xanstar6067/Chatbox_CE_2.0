import { settings as getDefaultSettings, newConfigs } from 'src/shared/defaults'
import { getModel } from 'src/shared/providers'
import OpenAI from 'src/shared/providers/definitions/models/openai'
import OpenAIResponses from 'src/shared/providers/definitions/models/openai-responses'
import { ModelProviderEnum, type SessionSettings, type Settings } from 'src/shared/types'
import type { ModelDependencies } from 'src/shared/types/adapters'
import type { SentryScope } from 'src/shared/utils/sentry_adapter'
import { describe, expect, it, vi } from 'vitest'

const mockScope: SentryScope = {
  setTag: vi.fn(),
  setExtra: vi.fn(),
}

const mockDependencies: ModelDependencies = {
  request: {
    fetchWithOptions: vi.fn(),
    apiRequest: vi.fn(),
  },
  storage: {
    saveImage: vi.fn(),
    getImage: vi.fn(),
  },
  sentry: {
    captureException: vi.fn(),
    withScope: vi.fn((callback: (scope: SentryScope) => void) => callback(mockScope)),
  },
  getRemoteConfig: vi.fn(),
  platformType: 'desktop',
  oauth: {
    refreshCredential: vi.fn(),
    persistCredential: vi.fn(),
    clearCredential: vi.fn(),
  },
}

describe('getModel', () => {
  it('adds the configured price snapshot to real provider usage', async () => {
    const pricing = { input: 2, output: 10, cacheRead: 0.2, source: 'manual' as const, updatedAt: 1 }
    const globalSettings = getDefaultSettings()
    globalSettings.providers = { openrouter: { apiKey: 'test-key', models: [{ modelId: 'vendor/model', pricing }] } }
    const recordUsage = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'reply',
            model: 'vendor/model',
            choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
            usage: {
              prompt_tokens: 1000,
              completion_tokens: 50,
              total_tokens: 1050,
              prompt_tokens_details: { cached_tokens: 800 },
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    try {
      const model = getModel(
        { provider: ModelProviderEnum.OpenRouter, modelId: 'vendor/model', stream: false },
        globalSettings,
        newConfigs(),
        { ...mockDependencies, recordUsage }
      )
      await model.chat([{ role: 'user', content: 'hello' }], { usagePurpose: 'chat' })
      expect(recordUsage).toHaveBeenCalledTimes(1)
      const cost = recordUsage.mock.calls[0][0].cost
      expect(cost).toMatchObject({
        modelId: 'vendor/model',
        provider: 'openrouter',
        pricing,
        inputTokens: 1000,
        outputTokens: 50,
        cacheReadTokens: 800,
      })
      expect(cost.usd).toBeCloseTo(0.00106)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns OpenAIResponses when provider is OpenAIResponses', () => {
    const sessionSettings: SessionSettings = {
      provider: ModelProviderEnum.OpenAIResponses,
      modelId: 'gpt-5-pro',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      stream: true,
    }

    const defaultSettings = getDefaultSettings()
    const globalSettings: Settings = {
      ...defaultSettings,
      providers: {
        ...defaultSettings.providers,
        [ModelProviderEnum.OpenAIResponses]: {
          apiKey: 'test-key',
          apiHost: 'https://api.openai.com',
          models: [{ modelId: 'gpt-5-pro' }],
        },
      },
    }

    const model = getModel(sessionSettings, globalSettings, newConfigs(), mockDependencies)

    expect(model).toBeInstanceOf(OpenAIResponses)
  })

  it('returns OpenAIResponses when OpenAI uses OAuth mode', () => {
    const sessionSettings: SessionSettings = {
      provider: ModelProviderEnum.OpenAI,
      modelId: 'gpt-5',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      stream: true,
    }

    const defaultSettings = getDefaultSettings()
    const globalSettings: Settings = {
      ...defaultSettings,
      providers: {
        ...defaultSettings.providers,
        [ModelProviderEnum.OpenAI]: {
          activeAuthMode: 'oauth',
          oauth: {
            accessToken: 'oauth-token',
          },
          models: [{ modelId: 'gpt-5' }],
        },
      },
    }

    const model = getModel(sessionSettings, globalSettings, newConfigs(), mockDependencies)

    expect(model).toBeInstanceOf(OpenAIResponses)
  })

  it('returns OpenAIResponses when openai-responses enables OAuth with shared OpenAI credentials', () => {
    const sessionSettings: SessionSettings = {
      provider: ModelProviderEnum.OpenAIResponses,
      modelId: 'gpt-5-pro',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      stream: true,
    }

    const defaultSettings = getDefaultSettings()
    const globalSettings: Settings = {
      ...defaultSettings,
      providers: {
        ...defaultSettings.providers,
        [ModelProviderEnum.OpenAI]: {
          oauth: {
            accessToken: 'oauth-token',
          },
        },
        [ModelProviderEnum.OpenAIResponses]: {
          activeAuthMode: 'oauth',
          models: [{ modelId: 'gpt-5-pro' }],
        },
      },
    }

    const model = getModel(sessionSettings, globalSettings, newConfigs(), mockDependencies)

    expect(model).toBeInstanceOf(OpenAIResponses)
  })

  it.each([
    [ModelProviderEnum.Qwen, 'qwen3.5-plus', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
    [ModelProviderEnum.QwenPortal, 'coder-model', 'https://portal.qwen.ai/v1'],
    [ModelProviderEnum.MiniMax, 'MiniMax-M2.5', 'https://api.minimax.io/v1'],
    [ModelProviderEnum.MiniMaxCN, 'MiniMax-M2.5', 'https://api.minimaxi.com/v1'],
    [ModelProviderEnum.Moonshot, 'kimi-k2.5', 'https://api.moonshot.ai/v1'],
    [ModelProviderEnum.MoonshotCN, 'kimi-k2.5', 'https://api.moonshot.cn/v1'],
  ])('returns OpenAI-compatible model instances for %s', (provider, modelId, apiHost) => {
    const sessionSettings: SessionSettings = {
      provider,
      modelId,
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      stream: true,
    }

    const defaultSettings = getDefaultSettings()
    const globalSettings: Settings = {
      ...defaultSettings,
      providers: {
        ...defaultSettings.providers,
        [provider]: {
          apiKey: 'test-key',
          apiHost,
          models: [{ modelId }],
        },
      },
    }

    const model = getModel(sessionSettings, globalSettings, newConfigs(), mockDependencies)

    expect(model).toBeInstanceOf(OpenAI)
  })
})
