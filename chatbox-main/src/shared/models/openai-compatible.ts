import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import type { ProviderModelInfo, ToolUseScope } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { OPENROUTER_REASONING_PARAMETERS } from '../utils/openrouter-reasoning'
import AbstractAISDKModel, { type CallSettings } from './abstract-ai-sdk'
import { ApiError } from './errors'
import type { ModelInterface } from './types'
import { createFetchWithProxy } from './utils/fetch-proxy'

export interface OpenAICompatibleSettings {
  apiKey: string
  apiHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  useProxy?: boolean
  maxOutputTokens?: number
  stream?: boolean
}

export default abstract class OpenAICompatible extends AbstractAISDKModel implements ModelInterface {
  public name = 'OpenAI Compatible'

  constructor(
    public options: OpenAICompatibleSettings,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
  }

  protected getCallSettings(): CallSettings {
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
    }
  }

  static isSupportTextEmbedding() {
    return true
  }
  isSupportToolUse(scope?: ToolUseScope) {
    if (
      scope &&
      ['web-browsing', 'read-file'].includes(scope) &&
      /deepseek-(v3|r1)$/.test(this.options.model.modelId.toLowerCase())
    ) {
      return false
    }
    return super.isSupportToolUse()
  }

  protected getProvider() {
    return createOpenAICompatible({
      name: this.name,
      apiKey: this.options.apiKey,
      baseURL: this.options.apiHost,
      fetch: createFetchWithProxy(this.options.useProxy, this.dependencies),
    })
  }

  protected getChatModel() {
    const provider = this.getProvider()
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public async listModels(): Promise<ProviderModelInfo[]> {
    return await fetchRemoteModels(
      {
        apiHost: this.options.apiHost,
        apiKey: this.options.apiKey,
        useProxy: this.options.useProxy,
      },
      this.dependencies
    ).catch((err) => {
      console.error(err)
      return []
    })
  }
}

interface ListModelsResponse {
  object: 'list'
  data: {
    id: string
    object: 'model'
    created: number
    owned_by?: string
    // OpenRouter specific fields
    name?: string
    context_length?: number
    architecture?: {
      input_modalities?: string[]
      output_modalities?: string[]
      tokenizer?: string
    }
    pricing?: {
      prompt?: string
      completion?: string
      image?: string
      request?: string
      web_search?: string
      internal_reasoning?: string
    }
    top_provider?: {
      is_moderated?: boolean
      max_completion_tokens?: number | null
    }
    canonical_slug?: string
    hugging_face_id?: string
    per_request_limits?: Record<string, unknown>
    supported_parameters?: string[]
  }[]
}

export async function fetchRemoteModels(
  params: {
    apiHost: string
    apiKey: string
    useProxy?: boolean
    extraHeaders?: Record<string, string>
    customFetch?: typeof globalThis.fetch
  },
  dependencies: ModelDependencies
) {
  const headers = {
    Authorization: `Bearer ${params.apiKey}`,
    ...(params.extraHeaders || {}),
  }
  const response = params.customFetch
    ? await params.customFetch(`${params.apiHost}/models`, {
        method: 'GET',
        headers,
      })
    : await dependencies.request.apiRequest({
        url: `${params.apiHost}/models`,
        method: 'GET',
        headers,
        useProxy: params.useProxy,
      })
  const json: ListModelsResponse = await response.json()
  if (!json.data) {
    throw new ApiError(JSON.stringify(json))
  }
  return json.data.map((item) => {
    const modelInfo: ProviderModelInfo = {
      modelId: item.id,
      type: 'chat',
    }

    // Add nickname from OpenRouter name field
    if (item.name) {
      modelInfo.nickname = item.name
    }

    // Add context window if available
    if (item.context_length) {
      modelInfo.contextWindow = item.context_length
    }

    if (item.top_provider?.max_completion_tokens) {
      modelInfo.maxOutput = item.top_provider.max_completion_tokens
    }

    // Add capabilities based on architecture
    if (item.architecture) {
      const capabilities: ProviderModelInfo['capabilities'] = []
      const supportedParameters = item.supported_parameters || []

      // Check for vision capability
      if (item.architecture.input_modalities?.includes('image')) {
        capabilities.push('vision')
      }

      // Check for web search capability (OpenRouter specific)
      if (item.pricing?.web_search && item.pricing.web_search !== '0') {
        capabilities.push('web_search')
      }

      // Check for reasoning capability (OpenRouter specific). Most reasoning models are
      // only discoverable through supported_parameters; separate reasoning pricing is rare.
      if (
        supportedParameters.some((parameter) => OPENROUTER_REASONING_PARAMETERS.includes(parameter)) ||
        (item.pricing?.internal_reasoning && item.pricing.internal_reasoning !== '0')
      ) {
        capabilities.push('reasoning')
      }

      // Check for tool use capability (OpenRouter specific)
      if (supportedParameters.includes('tools')) {
        capabilities.push('tool_use')
      }

      if (capabilities.length > 0) {
        modelInfo.capabilities = capabilities
      }
    }

    return modelInfo
  })
}
