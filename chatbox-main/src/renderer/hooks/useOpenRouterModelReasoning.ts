import { ModelProviderEnum } from '@shared/types'
import type { OpenRouterModelReasoningInfo } from '@shared/utils/openrouter-reasoning'
import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '@/stores/settingsStore'
import { apiRequest } from '@/utils/request'

type OpenRouterModelsPayload = {
  data?: Array<{
    id: string
    supported_parameters?: string[]
    reasoning?: OpenRouterModelReasoningInfo['reasoning']
  }>
}

// When the catalog cannot be loaded, still offer OpenRouter's generic effort levels.
const CATALOG_UNAVAILABLE: OpenRouterModelReasoningInfo = { supportedParameters: ['reasoning'] }

/**
 * Reads the per-model reasoning controls that OpenRouter publishes in its model catalog.
 * Returns `undefined` while loading and `null` when the catalog does not contain the model.
 */
export function useOpenRouterModelReasoning(modelId: string, enabled: boolean) {
  const providerSettings = useSettingsStore((state) => state.providers?.[ModelProviderEnum.OpenRouter])
  const apiHost = (providerSettings?.apiHost || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  const { data, isError } = useQuery({
    queryKey: ['openrouter-model-reasoning', apiHost],
    enabled,
    staleTime: 3600 * 1000,
    queryFn: async () => {
      const response = await apiRequest.get(
        `${apiHost}/models`,
        providerSettings?.apiKey ? { Authorization: `Bearer ${providerSettings.apiKey}` } : {},
        { retry: 1, useProxy: providerSettings?.useProxy }
      )
      const payload = (await response.json()) as OpenRouterModelsPayload
      return new Map<string, OpenRouterModelReasoningInfo>(
        (payload.data || []).map((model) => [
          model.id,
          { supportedParameters: model.supported_parameters, reasoning: model.reasoning },
        ])
      )
    },
  })

  if (isError) return CATALOG_UNAVAILABLE
  if (!data) return undefined
  return data.get(modelId) ?? null
}
