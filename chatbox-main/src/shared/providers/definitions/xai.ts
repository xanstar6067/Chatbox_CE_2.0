import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import { KNOWN_XAI_IMAGE_MODELS } from './image-models'
import XAI from './models/xai'

export const xaiProvider = defineProvider({
  id: ModelProviderEnum.XAI,
  name: 'xAI',
  type: ModelProviderType.OpenAI,
  modelsDevProviderId: 'xai',
  curatedModelIds: [
    'grok-4.3',
    'grok-4.20-multi-agent',
    'grok-4-1-fast',
    'grok-4-1-fast-non-reasoning',
    'grok-4-fast',
    'grok-4',
  ],
  urls: {
    website: 'https://x.ai/',
  },
  defaultSettings: {
    apiHost: 'https://api.x.ai',
    models: [
      {
        modelId: 'grok-4.3',
        contextWindow: 256_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4',
        contextWindow: 256_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4.20-multi-agent',
        nickname: 'Grok 4.20 Multi-Agent',
        contextWindow: 1_000_000,
        capabilities: ['vision', 'reasoning'],
      },
      {
        modelId: 'grok-4-fast',
        contextWindow: 2_000_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4-1-fast',
        contextWindow: 2_000_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4-1-fast-non-reasoning',
        contextWindow: 2_000_000,
        capabilities: ['vision', 'tool_use'],
      },
      ...KNOWN_XAI_IMAGE_MODELS.map((model) => ({
        modelId: model.modelId,
        nickname: model.displayName,
        type: 'image' as const,
        capabilities: ['vision' as const],
      })),
    ],
  },
  createModel: (config) => {
    return new XAI(
      {
        apiKey: config.effectiveApiKey,
        apiHost: config.formattedApiHost,
        model: config.model,
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        stream: config.settings.stream,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `xAI API (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
