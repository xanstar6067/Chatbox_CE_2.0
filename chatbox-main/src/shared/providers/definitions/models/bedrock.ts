import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import type { ModelMessage, ToolSet } from 'ai'
import AbstractAISDKModel, { type CallSettings } from '../../../models/abstract-ai-sdk'
import { addBedrockCachePoints } from '../../../models/anthropic-cache'
import type { CallChatCompletionOptions, ChatStreamOptions, ModelStreamPart } from '../../../models/types'
import type { ProviderModelInfo, StreamTextResult } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'

/**
 * Claude models on Bedrock cache prompts only at explicit cache checkpoints.
 * Legacy Claude models without prompt caching support are excluded because
 * Bedrock rejects checkpoints for them.
 */
export function isBedrockCacheModel(modelId: string): boolean {
  return (
    /anthropic\.|claude/i.test(modelId) &&
    !/claude-(instant|v2|3-(haiku|sonnet|opus)|3-5-haiku|3-5-sonnet-20240620)/i.test(modelId)
  )
}

interface Options {
  accessKey: string
  secretKey: string
  sessionToken?: string
  region: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
}

export default class Bedrock extends AbstractAISDKModel {
  public name = 'AWS Bedrock'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
  }

  protected getProvider() {
    const config: {
      region: string
      accessKeyId: string
      secretAccessKey: string
      sessionToken?: string
    } = {
      region: this.options.region,
      accessKeyId: this.options.accessKey,
      secretAccessKey: this.options.secretKey,
    }

    if (this.options.sessionToken) {
      config.sessionToken = this.options.sessionToken
    }

    return createAmazonBedrock(config)
  }

  protected getChatModel() {
    const provider = this.getProvider()
    return provider.languageModel(this.options.model.modelId)
  }

  protected getCallSettings(_options: CallChatCompletionOptions): CallSettings {
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
    }
  }

  public async chat(messages: ModelMessage[], options: CallChatCompletionOptions): Promise<StreamTextResult> {
    return super.chat(this.addCachePoints(messages), options)
  }

  public async *chatStream<T extends ToolSet>(
    messages: ModelMessage[],
    options: ChatStreamOptions
  ): AsyncGenerator<ModelStreamPart<T>> {
    yield* super.chatStream<T>(this.addCachePoints(messages), options)
  }

  private addCachePoints(messages: ModelMessage[]) {
    return isBedrockCacheModel(this.options.model.modelId) ? addBedrockCachePoints(messages) : messages
  }
}
