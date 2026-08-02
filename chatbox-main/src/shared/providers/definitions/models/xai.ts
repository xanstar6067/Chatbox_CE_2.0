import { createOpenAI, type OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import { extractReasoningMiddleware, type ToolSet, wrapLanguageModel } from 'ai'
import type { CallSettings } from '../../../models/abstract-ai-sdk'
import { ApiError } from '../../../models/errors'
import OpenAICompatible, { type OpenAICompatibleSettings } from '../../../models/openai-compatible'
import type { CallChatCompletionOptions, NativeWebSearchConfig } from '../../../models/types'
import { createFetchWithProxy } from '../../../models/utils/fetch-proxy'
import { responseToVideoDataUrl } from '../../../models/video'
import type { VideoGenerationInput, VideoGenerationJob } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import { normalizeOpenAIApiHostAndPath } from '../../../utils'

interface Options extends OpenAICompatibleSettings {}

export function isXaiMultiAgentModel(modelId: string): boolean {
  return /^grok-4\.20-multi-agent(?:-|$)/i.test(modelId)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export default class XAI extends OpenAICompatible {
  public name = 'xAI'
  public options: Options
  constructor(options: Options, dependencies: ModelDependencies) {
    const { apiHost } = normalizeOpenAIApiHostAndPath({ apiHost: options.apiHost })
    super(
      {
        apiKey: options.apiKey,
        apiHost,
        model: options.model,
        temperature: options.temperature,
        topP: options.topP,
        maxOutputTokens: options.maxOutputTokens,
        stream: options.stream,
      },
      dependencies
    )
    this.options = {
      ...options,
      apiHost,
    }
  }

  public isSupportToolUse() {
    // Multi-Agent supports xAI server-side tools, but not the client-side custom
    // tools exposed by Chatbox.
    if (isXaiMultiAgentModel(this.options.model.modelId)) return false
    return super.isSupportToolUse()
  }

  private usesResponsesAPI(options: CallChatCompletionOptions): boolean {
    return isXaiMultiAgentModel(this.options.model.modelId) || options.webSearchMode === 'model'
  }

  private getResponsesProvider() {
    return createOpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.apiHost,
      fetch: createFetchWithProxy(this.options.useProxy, this.dependencies),
    })
  }

  public getNativeWebSearch(): NativeWebSearchConfig | null {
    if (this.options.model.type === 'image' || this.options.model.modelId.startsWith('grok-imagine-')) {
      return null
    }
    return {
      provider: 'xAI Search',
      // Provider-defined tools with an output schema are more specific than
      // ToolSet's index signature, so keep the runtime tool and widen it here.
      tools: {
        web_search: this.getResponsesProvider().tools.webSearch(),
      } as unknown as ToolSet,
    }
  }

  protected getCallSettings(options: CallChatCompletionOptions = {}): CallSettings {
    if (!this.usesResponsesAPI(options)) {
      return super.getCallSettings()
    }

    const requestedEffort = options.providerOptions?.openai?.reasoningEffort
    const providerOptions: OpenAIResponsesProviderOptions = {
      store: false,
    }
    if (requestedEffort || isXaiMultiAgentModel(this.options.model.modelId)) {
      providerOptions.reasoningEffort = requestedEffort || 'low'
    }
    return {
      // xAI server-side tools run through Responses. Avoid Chat Completions-only
      // sampling parameters and let the Responses API use its defaults.
      providerOptions: { openai: providerOptions },
    }
  }

  protected getChatModel(options: CallChatCompletionOptions = {}) {
    if (!this.usesResponsesAPI(options)) {
      return super.getChatModel()
    }

    return wrapLanguageModel({
      model: this.getResponsesProvider().responses(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public async paint(
    params: {
      prompt: string
      images?: { imageUrl: string }[]
      num: number
      aspectRatio?: string
    },
    signal?: AbortSignal,
    callback?: (picBase64: string) => void | Promise<void>
  ): Promise<string[]> {
    if (!this.options.model.modelId.startsWith('grok-imagine-image')) {
      throw new ApiError('This xAI model does not support image generation')
    }

    const inputImages = params.images?.slice(0, 3) || []
    const isEdit = inputImages.length > 0
    const body: Record<string, unknown> = {
      model: this.options.model.modelId,
      prompt: params.prompt,
      n: params.num,
      // Returning the image inline avoids a second cross-origin request to the
      // short-lived imgen.x.ai URL, which Android WebView blocks with CORS.
      response_format: 'b64_json',
    }
    if (params.aspectRatio && params.aspectRatio !== 'auto') {
      body.aspect_ratio = params.aspectRatio
    }
    if (inputImages.length === 1) {
      body.image = { type: 'image_url', url: inputImages[0].imageUrl }
    } else if (inputImages.length > 1) {
      body.images = inputImages.map((image) => ({ type: 'image_url', url: image.imageUrl }))
    }

    const response = await this.dependencies.request.apiRequest({
      url: `${this.options.apiHost}/images/${isEdit ? 'edits' : 'generations'}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
      retry: 0,
    })
    if (!response.ok) {
      throw new ApiError(`xAI image generation failed (${response.status}): ${await response.text()}`)
    }

    const payload = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string; mime_type?: string }>
    }
    if (!payload.data?.length) {
      throw new ApiError('xAI image generation returned no images')
    }

    const results: string[] = []
    for (const image of payload.data) {
      let dataUrl: string
      if (image.b64_json) {
        dataUrl = `data:${image.mime_type || 'image/png'};base64,${image.b64_json}`
      } else if (image.url) {
        const imageResponse = await this.dependencies.request.apiRequest({
          url: image.url,
          method: 'GET',
          signal,
          retry: 0,
        })
        if (!imageResponse.ok) {
          throw new ApiError(`Failed to download generated xAI image (${imageResponse.status})`)
        }
        const mimeType = image.mime_type || imageResponse.headers.get('content-type') || 'image/jpeg'
        dataUrl = `data:${mimeType};base64,${arrayBufferToBase64(await imageResponse.arrayBuffer())}`
      } else {
        continue
      }
      results.push(dataUrl)
      await callback?.(dataUrl)
    }

    if (results.length === 0) {
      throw new ApiError('xAI image generation returned no usable images')
    }
    return results
  }

  public async startVideoGeneration(params: VideoGenerationInput, signal?: AbortSignal): Promise<VideoGenerationJob> {
    const body: Record<string, unknown> = {
      model: this.options.model.modelId,
      prompt: params.prompt,
      duration: params.duration,
      aspect_ratio: params.aspectRatio,
      resolution: params.resolution,
    }
    if (params.image) body.image = { url: params.image.imageUrl }

    const response = await this.dependencies.request.apiRequest({
      url: `${this.options.apiHost}/videos/generations`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
      retry: 0,
      useProxy: this.options.useProxy,
    })
    if (!response.ok) {
      throw new ApiError(`xAI video generation failed (${response.status}): ${await response.text()}`)
    }
    const payload = (await response.json()) as { request_id?: string }
    if (!payload.request_id) throw new ApiError('xAI returned no video request ID')
    return { id: payload.request_id, status: 'pending' }
  }

  public async pollVideoGeneration(job: VideoGenerationJob, signal?: AbortSignal): Promise<VideoGenerationJob> {
    const response = await this.dependencies.request.apiRequest({
      url: `${this.options.apiHost}/videos/${encodeURIComponent(job.id)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
      signal,
      retry: 0,
      useProxy: this.options.useProxy,
    })
    if (!response.ok) {
      throw new ApiError(`xAI video status failed (${response.status}): ${await response.text()}`)
    }
    const payload = (await response.json()) as {
      status?: string
      video?: { url?: string }
      progress?: number
      error?: { message?: string } | string
    }
    const status: VideoGenerationJob['status'] =
      payload.status === 'done'
        ? 'completed'
        : payload.status === 'failed'
          ? 'failed'
          : payload.status === 'expired'
            ? 'expired'
            : 'in_progress'
    const error = typeof payload.error === 'string' ? payload.error : payload.error?.message
    return { ...job, status, videoUrl: payload.video?.url, progress: payload.progress, error }
  }

  public async downloadVideo(job: VideoGenerationJob, signal?: AbortSignal) {
    if (!job.videoUrl) throw new ApiError('xAI returned no video URL')
    const response = await this.dependencies.request.apiRequest({
      url: job.videoUrl,
      method: 'GET',
      headers: {},
      signal,
      retry: 0,
      useProxy: this.options.useProxy,
    })
    return responseToVideoDataUrl(response)
  }
}
