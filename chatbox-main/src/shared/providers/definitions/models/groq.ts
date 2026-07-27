import OpenAICompatible, { type OpenAICompatibleSettings } from '../../../models/openai-compatible'
import type { ModelDependencies } from '../../../types/adapters'
import { normalizeOpenAIApiHostAndPath } from '../../../utils'

interface Options extends OpenAICompatibleSettings {}

export default class Groq extends OpenAICompatible {
  public name = 'Groq'
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
}
