import type { GoogleGenerativeAIProvider } from '@ai-sdk/google'
import type { NativeWebSearchConfig } from '../../../models/types'
import type { ProviderModelInfo } from '../../../types'
import { isGeminiImageModel } from '../image-models'

function supportsGoogleSearch(model: ProviderModelInfo): boolean {
  const modelId = model.modelId.toLowerCase()
  return model.type !== 'image' && modelId.startsWith('gemini-') && !isGeminiImageModel(modelId)
}

function supportsGoogleSearchWithCustomTools(modelId: string): boolean {
  const normalized = modelId.toLowerCase()
  const majorVersion = normalized.match(/^gemini-(\d+)/)?.[1]
  return normalized.includes('-latest') || (majorVersion !== undefined && Number(majorVersion) >= 3)
}

export function getGeminiNativeWebSearch(
  provider: GoogleGenerativeAIProvider,
  model: ProviderModelInfo,
  options?: { hasCustomTools?: boolean }
): NativeWebSearchConfig | null {
  if (!supportsGoogleSearch(model)) {
    return null
  }

  // Gemini 3 supports combining Google Search with custom function tools.
  // Earlier Gemini families use the configured fallback provider when other
  // Chatbox tools are active, avoiding an unsupported mixed-tool request.
  if (options?.hasCustomTools && !supportsGoogleSearchWithCustomTools(model.modelId)) {
    return null
  }

  return {
    provider: 'Google Search',
    tools: {
      web_search: provider.tools.googleSearch({}),
    },
  }
}
