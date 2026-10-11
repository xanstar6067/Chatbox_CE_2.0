import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { extractReasoningMiddleware, type JSONValue, type ModelMessage, type ToolSet, wrapLanguageModel } from 'ai'
import AbstractAISDKModel, { type CallSettings } from '../../../models/abstract-ai-sdk'
import { addOpenRouterCacheControl } from '../../../models/anthropic-cache'
import { ApiError } from '../../../models/errors'
import { fetchRemoteModels } from '../../../models/openai-compatible'
import type {
  CallChatCompletionOptions,
  ChatStreamOptions,
  ModelStreamPart,
  NativeWebSearchConfig,
} from '../../../models/types'
import { separateReasoningUsageMiddleware } from '../../../models/usage-normalization'
import { apiErrorMessage, responseToVideoDataUrl } from '../../../models/video'
import type { ProviderModelInfo, StreamTextResult, VideoGenerationInput, VideoGenerationJob } from '../../../types'
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

/**
 * Anthropic and Alibaba models on OpenRouter only cache prompts with explicit
 * `cache_control` breakpoints; other upstreams cache automatically. Free
 * variants are skipped: they are not billed and may be served by providers
 * without cache support.
 */
export function isOpenRouterExplicitCacheModel(modelId: string): boolean {
  const id = modelId.replace(/^~/, '')
  return /^(anthropic|qwen)\//.test(id) && !id.endsWith(':free')
}

function moveCacheControlIntoContent(message: unknown): unknown {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return message
  }
  const { cache_control: cacheControl, ...rest } = message as Record<string, unknown>
  if (cacheControl == null || typeof rest.content !== 'string' || rest.content.length === 0) {
    return message
  }
  return { ...rest, content: [{ type: 'text', text: rest.content, cache_control: cacheControl }] }
}

/**
 * The OpenRouter AI SDK puts `cache_control` of system and assistant messages
 * on the message itself, next to plain string content. OpenRouter documents
 * breakpoints only on content parts, so move the marker into a text part.
 */
export function createOpenRouterCacheControlFetch(baseFetch: FetchFunction): FetchFunction {
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
      if (!Array.isArray(request.messages)) {
        return baseFetch(input, init)
      }

      const messages = request.messages.map(moveCacheControlIntoContent)
      if (messages.every((message, index) => message === (request.messages as unknown[])[index])) {
        return baseFetch(input, init)
      }

      return baseFetch(input, {
        ...init,
        body: JSON.stringify({ ...request, messages }),
      })
    } catch {
      return baseFetch(input, init)
    }
  }
}

interface Options {
  apiKey: string
  apiHost?: string
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

  protected getCallSettings(options: CallChatCompletionOptions = {}): CallSettings {
    const settings: CallSettings = {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
    }
    // The OpenRouter SDK spreads providerOptions.openrouter into the request body.
    const openrouter: Record<string, JSONValue> = {}
    const { reasoningEffort, modelId } = options.providerOptions?.openrouter || {}
    if (reasoningEffort && (!modelId || modelId === this.options.model.modelId)) {
      // OpenRouter maps the unified effort onto each upstream model.
      // `effort: 'none'` is rejected by part of the upstream models (Anthropic among
      // them), so reasoning is disabled through the universally accepted `enabled` flag.
      openrouter.reasoning =
        reasoningEffort === 'none' ? { enabled: false, exclude: true } : { effort: reasoningEffort, exclude: false }
    }
    if (options.sessionId) {
      // Sticky routing: keeps a chat on the same upstream provider so its prompt cache stays warm.
      openrouter.session_id = options.sessionId
    }
    if (Object.keys(openrouter).length > 0) {
      settings.providerOptions = { openrouter }
    }
    return settings
  }

  protected getProvider(options: CallChatCompletionOptions = {}) {
    let fetch: FetchFunction | undefined
    if (isOpenRouterExplicitCacheModel(this.options.model.modelId)) {
      fetch = createOpenRouterCacheControlFetch((input, init) => globalThis.fetch(input, init))
    }
    if (options.webSearchMode === 'model') {
      fetch = createOpenRouterWebSearchFetch(fetch ?? ((input, init) => globalThis.fetch(input, init)))
    }
    return createOpenRouter({
      apiKey: this.options.apiKey,
      baseURL: this.openRouterBase(),
      headers: {
        'HTTP-Referer': 'https://chatboxai.app',
        'X-Title': 'Chatbox AI',
      },
      ...(fetch ? { fetch } : {}),
    })
  }

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
    return isOpenRouterExplicitCacheModel(this.options.model.modelId) ? addOpenRouterCacheControl(messages) : messages
  }

  protected getChatModel(options: CallChatCompletionOptions = {}) {
    const provider = this.getProvider(options)
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      // Upstream providers such as xAI can pass through completion counts that exclude reasoning.
      middleware: [extractReasoningMiddleware({ tagName: 'think' }), separateReasoningUsageMiddleware],
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
        apiHost: this.openRouterBase(),
        apiKey: this.options.apiKey,
        useProxy: false,
      },
      this.dependencies
    ).catch((err) => {
      console.error(err)
      return []
    })
  }

  public async paint(
    params: { prompt: string; images?: { imageUrl: string }[]; num: number; aspectRatio?: string },
    signal?: AbortSignal,
    callback?: (picBase64: string) => void | Promise<void>
  ): Promise<string[]> {
    const body: Record<string, unknown> = {
      model: this.options.model.modelId,
      prompt: params.prompt,
      n: params.num,
    }
    if (params.aspectRatio && params.aspectRatio !== 'auto') body.aspect_ratio = params.aspectRatio
    if (params.images?.length) {
      body.input_references = params.images.map(({ imageUrl }) => ({
        type: 'image_url',
        image_url: { url: imageUrl },
      }))
    }

    const response = await this.openRouterRequest('/images', 'POST', signal, body)
    if (!response.ok) {
      throw new ApiError(`OpenRouter image generation failed (${response.status}): ${await response.text()}`)
    }
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string; media_type?: string }> }
    const results = (payload.data || [])
      .filter((item): item is { b64_json: string; media_type?: string } => Boolean(item.b64_json))
      .map((item) => `data:${item.media_type || 'image/png'};base64,${item.b64_json}`)
    if (results.length === 0) throw new ApiError('OpenRouter returned no generated images')
    for (const result of results) await callback?.(result)
    return results
  }

  public async startVideoGeneration(params: VideoGenerationInput, signal?: AbortSignal): Promise<VideoGenerationJob> {
    const body: Record<string, unknown> = {
      model: this.options.model.modelId,
      prompt: params.prompt,
      duration: params.duration,
      resolution: params.resolution,
      aspect_ratio: params.aspectRatio,
      generate_audio: params.generateAudio,
    }
    if (params.image) {
      body.frame_images = [{ type: 'image_url', image_url: { url: params.image.imageUrl }, frame_type: 'first_frame' }]
    }
    const response = await this.openRouterRequest('/videos', 'POST', signal, body)
    if (!response.ok) {
      throw new ApiError(`OpenRouter video generation failed (${response.status}): ${await response.text()}`)
    }
    const payload = (await response.json()) as {
      id: string
      status?: string
      polling_url?: string
      error?: unknown
    }
    return {
      id: payload.id,
      status: this.mapVideoStatus(payload.status),
      pollingUrl: payload.polling_url,
      error: payload.error ? apiErrorMessage(payload.error) : undefined,
    }
  }

  public async pollVideoGeneration(job: VideoGenerationJob, signal?: AbortSignal): Promise<VideoGenerationJob> {
    const pollingPath = job.pollingUrl || `/videos/${encodeURIComponent(job.id)}`
    const response = await this.openRouterRequest(pollingPath, 'GET', signal)
    if (!response.ok) {
      throw new ApiError(`OpenRouter video status failed (${response.status}): ${await response.text()}`)
    }
    const payload = (await response.json()) as {
      id?: string
      status?: string
      polling_url?: string
      unsigned_urls?: string[]
      usage?: { cost?: number }
      error?: unknown
    }
    return {
      id: payload.id || job.id,
      status: this.mapVideoStatus(payload.status),
      pollingUrl: payload.polling_url || job.pollingUrl,
      videoUrl: payload.unsigned_urls?.[0],
      cost: payload.usage?.cost,
      error: payload.error ? apiErrorMessage(payload.error) : undefined,
    }
  }

  public async downloadVideo(job: VideoGenerationJob, signal?: AbortSignal) {
    const contentUrl = job.videoUrl || `/videos/${encodeURIComponent(job.id)}/content?index=0`
    return responseToVideoDataUrl(await this.openRouterRequest(contentUrl, 'GET', signal))
  }

  private mapVideoStatus(status?: string): VideoGenerationJob['status'] {
    if (status === 'completed') return 'completed'
    if (status === 'failed') return 'failed'
    if (status === 'cancelled') return 'cancelled'
    if (status === 'expired') return 'expired'
    if (status === 'in_progress') return 'in_progress'
    return 'pending'
  }

  private openRouterRequest(
    pathOrUrl: string,
    method: 'GET' | 'POST',
    signal?: AbortSignal,
    body?: Record<string, unknown>
  ) {
    const base = this.openRouterBase()
    let url: string
    if (/^https?:\/\//.test(pathOrUrl)) {
      url = pathOrUrl
    } else if (pathOrUrl.startsWith('/api/v1/')) {
      // OpenRouter may return a root-relative polling URL even though our
      // configured base already ends in /api/v1.
      url = `${new URL(base).origin}${pathOrUrl}`
    } else {
      url = `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
    }
    return this.dependencies.request.apiRequest({
      url,
      method,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://chatboxai.app',
        'X-Title': 'Chatbox AI',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      retry: 0,
    })
  }

  private openRouterBase() {
    return (this.options.apiHost || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  }
}
