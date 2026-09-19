import type { GoogleGenerativeAIProvider } from '@ai-sdk/google'
import type { ToolSet } from 'ai'
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

  // Gemini 3 supports combining built-in tools with custom function tools
  // (tool context circulation). Earlier Gemini families use the configured
  // fallback provider when other Chatbox tools are active, avoiding an
  // unsupported mixed-tool request.
  if (options?.hasCustomTools && !supportsGoogleSearchWithCustomTools(model.modelId)) {
    return null
  }

  return {
    provider: 'Google Search',
    // @ai-sdk/google bundles a newer provider-utils than `ai`, so its tool types carry a
    // different schema symbol type. The runtime symbol is shared (Symbol.for), so widen here.
    tools: {
      web_search: provider.tools.googleSearch({}),
      // Lets Gemini read pages the user links to, alongside search results.
      url_context: provider.tools.urlContext({}),
    } as unknown as ToolSet,
  }
}
