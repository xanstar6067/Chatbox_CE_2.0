import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import AbstractAISDKModel from '../../../models/abstract-ai-sdk'
import { fetchRemoteModels } from '../../../models/openai-compatible'
import type { CallChatCompletionOptions, NativeWebSearchConfig } from '../../../models/types'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'

const OPENROUTER_WEB_SEARCH_TOOL = {
  type: 'openrouter:web_search',
} as const

type FetchFunction = typeof globalThis.fetch

function hasOpenRouterWebSearchTool(tools: unknown[]): boolean {
  return tools.some(
    (tool) =>
      typeof tool === 'object' &&
      tool !== null &&
      'type' in tool &&
      (tool as { type?: unknown }).type === OPENROUTER_WEB_SEARCH_TOOL.type
  )
}

/**
 * The OpenRouter AI SDK currently drops provider-defined tools while mapping
 * AI SDK tools to OpenAI-compatible function tools. Add OpenRouter's server
 * tool to the final request body so function tools and native web search can
 * be used together.
 */
export function createOpenRouterWebSearchFetch(baseFetch: FetchFunction): FetchFunction {
  return (input, init) => {
    if (typeof init?.body !== 'string') {
      return baseFetch(input, init)
    }

    try {
      const payload = JSON.parse(init.body) as unknown
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        return baseFetch(input, init)
      }

      const request = payload as Record<string, unknown>
      const tools = Array.isArray(request.tools) ? request.tools : []
      if (hasOpenRouterWebSearchTool(tools)) {
        return baseFetch(input, init)
      }

      return baseFetch(input, {
        ...init,
        body: JSON.stringify({
          ...request,
          tools: [...tools, OPENROUTER_WEB_SEARCH_TOOL],
        }),
      })
    } catch {
      return baseFetch(input, init)
    }
  }
}

interface Options {
  apiKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
}

export default class OpenRouter extends AbstractAISDKModel {
  public name = 'OpenRouter'

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

  protected getProvider(options: CallChatCompletionOptions = {}) {
    return createOpenRouter({
      apiKey: this.options.apiKey,
      headers: {
        'HTTP-Referer': 'https://chatboxai.app',
        'X-Title': 'Chatbox AI',
      },
      ...(options.webSearchMode === 'model'
        ? {
            fetch: createOpenRouterWebSearchFetch((input, init) => globalThis.fetch(input, init)),
          }
        : {}),
    })
  }

  protected getChatModel(options: CallChatCompletionOptions = {}) {
    const provider = this.getProvider(options)
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public getNativeWebSearch(): NativeWebSearchConfig | null {
    if (this.options.model.type === 'image') {
      return null
    }
    return {
      provider: 'OpenRouter Search',
      // The server tool is inserted into the serialized OpenRouter request by
      // createOpenRouterWebSearchFetch. Keeping this empty avoids a duplicate
      // client-side function tool while still selecting native search mode.
      tools: {},
    }
  }

  public listModels(): Promise<ProviderModelInfo[]> {
    return fetchRemoteModels(
      {
        apiHost: 'https://openrouter.ai/api/v1',
        apiKey: this.options.apiKey,
        useProxy: false,
      },
      this.dependencies
    ).catch((err) => {
      console.error(err)
      return []
    })
  }
}
