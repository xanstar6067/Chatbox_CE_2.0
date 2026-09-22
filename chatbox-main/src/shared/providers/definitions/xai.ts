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
    'grok-4.7',
    'grok-4.6',
    'grok-4.5',
    'grok-4.3',
    'grok-4.20-0309-reasoning',
    'grok-4.20-0309-non-reasoning',
    'grok-4.20-multi-agent',
    'grok-build-0.1',
  ],
  urls: {
    website: 'https://x.ai/',
  },
  defaultSettings: {
    apiHost: 'https://api.x.ai',
    // https://docs.x.ai/developers/models
    // grok-4, grok-4-fast and grok-4-1-fast were retired on 2026-05-15 and now redirect to grok-4.3.
    models: [
      {
        modelId: 'grok-4.7',
        contextWindow: 500_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4.6',
        contextWindow: 500_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4.5',
        contextWindow: 500_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4.3',
        contextWindow: 1_000_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4.20-0309-reasoning',
        nickname: 'Grok 4.20 Reasoning',
        contextWindow: 1_000_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4.20-0309-non-reasoning',
        nickname: 'Grok 4.20',
        contextWindow: 1_000_000,
        capabilities: ['vision', 'tool_use'],
      },
      {
        modelId: 'grok-4.20-multi-agent',
        nickname: 'Grok 4.20 Multi-Agent',
        contextWindow: 1_000_000,
        capabilities: ['vision', 'reasoning'],
      },
      {
        modelId: 'grok-build-0.1',
        nickname: 'Grok Build',
        contextWindow: 256_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
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
