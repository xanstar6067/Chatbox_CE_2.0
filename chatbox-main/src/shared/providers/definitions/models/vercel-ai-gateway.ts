import { createGatewayProvider } from '@ai-sdk/gateway'
import type { ModelMessage, ToolSet } from 'ai'
import AbstractAISDKModel from '../../../models/abstract-ai-sdk'
import { addAnthropicCacheControl } from '../../../models/anthropic-cache'
import type { CallChatCompletionOptions, ChatStreamOptions, ModelStreamPart } from '../../../models/types'
import { createFetchWithProxy } from '../../../models/utils/fetch-proxy'
import type { ProviderModelInfo, StreamTextResult } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'

interface Options {
  apiKey: string
  apiHost?: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  useProxy?: boolean
  stream?: boolean
}

export default class VercelAIGateway extends AbstractAISDKModel {
  public name = 'Vercel AI Gateway'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
  }

  protected getCallSettings() {
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
    }
  }

  protected getProvider() {
    return createGatewayProvider({
      apiKey: this.options.apiKey,
      ...(this.options.apiHost ? { baseURL: this.options.apiHost } : {}),
      fetch: createFetchWithProxy(this.options.useProxy, this.dependencies),
    })
  }

  protected getChatModel() {
    const provider = this.getProvider()
    return provider.languageModel(this.options.model.modelId)
  }

  // The gateway forwards message providerOptions to the upstream provider, and
  // Claude caches prompts only at explicit cache breakpoints.
  public async chat(messages: ModelMessage[], options: CallChatCompletionOptions): Promise<StreamTextResult> {
    return super.chat(this.addCacheControl(messages), options)
  }

  public async *chatStream<T extends ToolSet>(
    messages: ModelMessage[],
    options: ChatStreamOptions
  ): AsyncGenerator<ModelStreamPart<T>> {
    yield* super.chatStream<T>(this.addCacheControl(messages), options)
  }

  private addCacheControl(messages: ModelMessage[]) {
    return this.options.model.modelId.startsWith('anthropic/') ? addAnthropicCacheControl(messages) : messages
  }

  public async listModels(): Promise<ProviderModelInfo[]> {
    try {
      const provider = this.getProvider()
      const response = await provider.getAvailableModels()
      return response.models
        .filter((m) => !m.modelType || m.modelType === 'language')
        .map((m) => {
          const capabilities: ProviderModelInfo['capabilities'] = []

          // Infer capabilities from the underlying provider in the model ID
          const providerId = m.specification?.provider || m.id.split('/')[0]
          if (providerId) {
            const lower = providerId.toLowerCase()
            // Most gateway models support tool use
            if (!lower.includes('perplexity')) {
              capabilities.push('tool_use')
            }
            // Vision support for known providers
            if (['anthropic', 'openai', 'google', 'xai', 'meta'].some((p) => lower.includes(p))) {
              capabilities.push('vision')
            }
          }

          return {
            modelId: m.id,
            nickname: m.name,
            type: 'chat' as const,
            ...(capabilities.length > 0 ? { capabilities } : {}),
          }
        })
    } catch (err) {
      console.error('Failed to fetch Vercel AI Gateway models:', err)
      return []
    }
  }
}
