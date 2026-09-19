import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import OpenRouter from './models/openrouter'

export const openRouterProvider = defineProvider({
  id: ModelProviderEnum.OpenRouter,
  name: 'OpenRouter',
  type: ModelProviderType.OpenAI,
  modelsDevProviderId: 'openrouter',
  curatedModelIds: [
    // Top-tier flagship models
    'anthropic/claude-opus-5',
    'anthropic/claude-sonnet-5',
    'google/gemini-3.8-flash',
    'google/gemini-3.1-pro-preview',
    'openai/gpt-6-astra',
    'openai/gpt-5.6-luna',
    'x-ai/grok-4.6',
    'x-ai/grok-4.3',
    // Value & reasoning models
    'deepseek/deepseek-v4-pro',
    'deepseek/deepseek-v4.1-flash',
    'moonshotai/kimi-k3',
    'minimax/minimax-m3',
    // Free models
    'deepseek/deepseek-v4-flash-0731:free',
    'qwen/qwen3.8-27b:free',
    'google/gemma-4-31b-it:free',
  ],
  urls: {
    website: 'https://openrouter.ai/',
  },
  defaultSettings: {
    apiHost: 'https://openrouter.ai/api/v1',
    // Metadata from https://openrouter.ai/api/v1/models
    models: [
      // --- Anthropic ---
      {
        modelId: 'anthropic/claude-opus-5',
        nickname: 'Claude Opus 5',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_000_000,
        maxOutput: 128_000,
      },
      {
        modelId: 'anthropic/claude-sonnet-5',
        nickname: 'Claude Sonnet 5',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_000_000,
        maxOutput: 128_000,
      },
      // --- Google ---
      {
        modelId: 'google/gemini-3.8-flash',
        nickname: 'Gemini 3.8 Flash',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_048_576,
        maxOutput: 65_536,
      },
      {
        modelId: 'google/gemini-3.1-pro-preview',
        nickname: 'Gemini 3.1 Pro',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_048_576,
        maxOutput: 65_536,
      },
      {
        modelId: 'google/gemini-3.5-flash-lite',
        nickname: 'Gemini 3.5 Flash Lite',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_048_576,
        maxOutput: 65_536,
      },
      // --- OpenAI ---
      {
        modelId: 'openai/gpt-6-astra',
        nickname: 'GPT-6 Astra',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_050_000,
        maxOutput: 128_000,
      },
      {
        modelId: 'openai/gpt-5.6-luna',
        nickname: 'GPT-5.6 Luna',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_050_000,
        maxOutput: 128_000,
      },
      // --- xAI ---
      {
        modelId: 'x-ai/grok-4.6',
        nickname: 'Grok 4.6',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 500_000,
        maxOutput: 450_000,
      },
      {
        modelId: 'x-ai/grok-4.3',
        nickname: 'Grok 4.3',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_000_000,
        maxOutput: 900_000,
      },
      // --- DeepSeek ---
      {
        modelId: 'deepseek/deepseek-v4-pro',
        nickname: 'DeepSeek V4 Pro',
        capabilities: ['tool_use', 'reasoning'],
        contextWindow: 1_048_576,
        maxOutput: 384_000,
      },
      {
        modelId: 'deepseek/deepseek-v4.1-flash',
        nickname: 'DeepSeek V4.1 Flash',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_048_576,
        maxOutput: 384_000,
      },
      // --- Moonshot ---
      {
        modelId: 'moonshotai/kimi-k3',
        nickname: 'Kimi K3',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_048_576,
        maxOutput: 943_718,
      },
      // --- MiniMax ---
      {
        modelId: 'minimax/minimax-m3',
        nickname: 'MiniMax M3',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 1_048_576,
        maxOutput: 512_000,
      },
      // --- Free models ---
      {
        modelId: 'deepseek/deepseek-v4-flash-0731:free',
        nickname: 'DeepSeek V4 Flash (free)',
        capabilities: ['tool_use', 'reasoning'],
        contextWindow: 1_048_576,
        maxOutput: 393_216,
      },
      {
        modelId: 'qwen/qwen3.8-27b:free',
        nickname: 'Qwen3.8 27B (free)',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 262_144,
        maxOutput: 235_929,
      },
      {
        modelId: 'google/gemma-4-31b-it:free',
        nickname: 'Gemma 4 31B (free)',
        capabilities: ['tool_use', 'reasoning', 'vision'],
        contextWindow: 262_144,
        maxOutput: 32_768,
      },
    ],
  },
  createModel: (config) => {
    return new OpenRouter(
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
    return `OpenRouter API (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
