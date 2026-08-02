import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import { generateText } from 'ai'
import AbstractAISDKModel, { type CallSettings } from '../../../models/abstract-ai-sdk'
import { ApiError } from '../../../models/errors'
import type { CallChatCompletionOptions } from '../../../models/types'
import { apiErrorMessage, responseToVideoDataUrl } from '../../../models/video'
import type { ProviderModelInfo, VideoGenerationInput, VideoGenerationJob } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import { normalizeGoogleThinkingConfig } from '../../../utils/google-thinking'
import { normalizeGeminiHost } from '../../../utils/llm_utils'
import { buildGeminiImageConfig } from '../gemini-types'
import { isGeminiImageModel } from '../image-models'
import { getGeminiNativeWebSearch } from './gemini-web-search'

interface Options {
  geminiAPIKey: string
  geminiAPIHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
}

export default class Gemini extends AbstractAISDKModel {
  public name = 'Google Gemini'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
    this.injectDefaultMetadata = false
  }

  isSupportSystemMessage() {
    return ![
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.5-flash-image-preview',
    ].includes(this.options.model.modelId)
  }

  protected getProvider() {
    return createGoogleGenerativeAI({
      apiKey: this.options.geminiAPIKey,
      baseURL: normalizeGeminiHost(this.options.geminiAPIHost).apiHost,
    })
  }

  public getNativeWebSearch(options?: { hasCustomTools?: boolean }) {
    return getGeminiNativeWebSearch(this.getProvider(), this.options.model, options)
  }

  protected getChatModel(_options: CallChatCompletionOptions): LanguageModelV3 {
    const provider = this.getProvider()

    return provider.chat(this.options.model.modelId)
  }

  protected getCallSettings(options: CallChatCompletionOptions): CallSettings {
    const isModelSupportThinking = this.isSupportReasoning()
    let providerParams: GoogleGenerativeAIProviderOptions = {
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      ],
    }
    if (isModelSupportThinking) {
      providerParams = {
        ...providerParams,
        ...(options.providerOptions?.google || {}),
        thinkingConfig: {
          ...(normalizeGoogleThinkingConfig(
            this.options.model.modelId,
            options.providerOptions?.google?.thinkingConfig
          ) || {}),
          includeThoughts: true,
        },
      }
    }

    const settings: CallSettings = {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
      providerOptions: {
        google: {
          ...providerParams,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }
    if (isGeminiImageModel(this.options.model.modelId)) {
      settings.providerOptions = {
        google: {
          ...providerParams,
          responseModalities: ['TEXT', 'IMAGE'],
        } satisfies GoogleGenerativeAIProviderOptions,
      }
    }
    return settings
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
    if (!isGeminiImageModel(this.options.model.modelId)) {
      throw new ApiError('This Gemini model does not support image generation')
    }

    const provider = this.getProvider()
    const model = provider.chat(this.options.model.modelId)

    const messageContent: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = []
    for (const image of params.images || []) {
      messageContent.push({ type: 'image', image: image.imageUrl })
    }
    messageContent.push({ type: 'text', text: params.prompt })

    const results: string[] = []
    for (let i = 0; i < params.num; i++) {
      const providerOptions: GoogleGenerativeAIProviderOptions = {
        responseModalities: ['TEXT', 'IMAGE'],
      }
      const imageConfig = buildGeminiImageConfig(params.aspectRatio)
      if (imageConfig) {
        providerOptions.imageConfig = imageConfig
      }

      const result = await generateText({
        model,
        messages: [{ role: 'user', content: messageContent }],
        abortSignal: signal,
        providerOptions: {
          google: providerOptions,
        },
        // Image generation is billable; network-error retries could double-charge.
        maxRetries: 0,
      })

      for (const file of result.files) {
        if (file.mediaType?.startsWith('image/') && file.base64) {
          const dataUrl = `data:${file.mediaType};base64,${file.base64}`
          results.push(dataUrl)
          await callback?.(dataUrl)
        }
      }
    }
    return results
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    type Response = {
      models: {
        name: string
        version: string
        displayName: string
        description: string
        inputTokenLimit: number
        outputTokenLimit: number
        supportedGenerationMethods: string[]
        temperature: number
        topP: number
        topK: number
      }[]
    }
    const res = await this.dependencies.request.apiRequest({
      url: `${this.options.geminiAPIHost}/v1beta/models?key=${this.options.geminiAPIKey}`,
      method: 'GET',
      headers: {},
    })
    const json: Response = await res.json()
    if (!json.models) {
      throw new ApiError(JSON.stringify(json))
    }
    return json.models
      .filter((m) => m.supportedGenerationMethods.some((method) => method.includes('generate')))
      .filter((m) => m.name.includes('gemini'))
      .map((m) => ({
        modelId: m.name.replace('models/', ''),
        nickname: m.displayName,
        type: isGeminiImageModel(m.name) ? ('image' as const) : ('chat' as const),
        contextWindow: m.inputTokenLimit,
        maxOutput: m.outputTokenLimit,
      }))
      .sort((a, b) => a.modelId.localeCompare(b.modelId))
  }

  public async startVideoGeneration(params: VideoGenerationInput, signal?: AbortSignal): Promise<VideoGenerationJob> {
    const instance: Record<string, unknown> = { prompt: params.prompt }
    if (params.image) {
      const match = params.image.imageUrl.match(/^data:([^;]+);base64,(.+)$/s)
      if (!match) throw new ApiError('Google Veo requires the start frame as a base64 data URL')
      instance.image = { inlineData: { mimeType: match[1], data: match[2] } }
    }

    const response = await this.dependencies.request.apiRequest({
      url: `${this.geminiApiBase()}/models/${encodeURIComponent(this.options.model.modelId)}:predictLongRunning`,
      method: 'POST',
      headers: {
        'x-goog-api-key': this.options.geminiAPIKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          aspectRatio: params.aspectRatio,
          durationSeconds: String(params.duration),
          resolution: params.resolution,
          numberOfVideos: 1,
        },
      }),
      signal,
      retry: 0,
    })
    if (!response.ok) {
      throw new ApiError(`Google Veo generation failed (${response.status}): ${await response.text()}`)
    }
    const payload = (await response.json()) as { name?: string; error?: unknown }
    if (!payload.name) throw new ApiError(apiErrorMessage(payload.error))
    return { id: payload.name, status: 'pending' }
  }

  public async pollVideoGeneration(job: VideoGenerationJob, signal?: AbortSignal): Promise<VideoGenerationJob> {
    const operationPath = job.id.replace(/^\/+/, '')
    const response = await this.dependencies.request.apiRequest({
      url: `${this.geminiApiBase()}/${operationPath}`,
      method: 'GET',
      headers: { 'x-goog-api-key': this.options.geminiAPIKey },
      signal,
      retry: 0,
    })
    if (!response.ok) {
      throw new ApiError(`Google Veo status failed (${response.status}): ${await response.text()}`)
    }
    const payload = (await response.json()) as {
      done?: boolean
      error?: unknown
      metadata?: { progressPercent?: number }
      response?: {
        generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> }
        generatedVideos?: Array<{ video?: { uri?: string } }>
      }
    }
    if (payload.error) {
      return { ...job, status: 'failed', error: apiErrorMessage(payload.error) }
    }
    const videoUrl =
      payload.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
      payload.response?.generatedVideos?.[0]?.video?.uri
    return {
      ...job,
      status: payload.done ? (videoUrl ? 'completed' : 'failed') : 'in_progress',
      videoUrl,
      progress: payload.metadata?.progressPercent,
      error: payload.done && !videoUrl ? 'Google Veo completed without a video URL' : undefined,
    }
  }

  public async downloadVideo(job: VideoGenerationJob, signal?: AbortSignal) {
    if (!job.videoUrl) throw new ApiError('Google Veo returned no video URL')
    const response = await this.dependencies.request.apiRequest({
      url: job.videoUrl,
      method: 'GET',
      headers: { 'x-goog-api-key': this.options.geminiAPIKey },
      signal,
      retry: 0,
    })
    return responseToVideoDataUrl(response)
  }

  private geminiApiBase() {
    return normalizeGeminiHost(this.options.geminiAPIHost).apiHost.replace(/\/$/, '')
  }
}
