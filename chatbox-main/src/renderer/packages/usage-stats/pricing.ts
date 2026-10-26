import { fetchRemoteModels } from '@shared/models/openai-compatible'
import type { ProviderModelInfo } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'

const CACHE_TTL = 60 * 60 * 1000
let catalog: Promise<ProviderModelInfo[]> | undefined
let expiresAt = 0

/** Shared by automatic OpenRouter pricing and the explicit import in the model editor. */
export async function getOpenRouterPricing(modelId: string, dependencies: ModelDependencies, refresh = false) {
  if (refresh || !catalog || Date.now() >= expiresAt) {
    expiresAt = Date.now() + CACHE_TTL
    catalog = fetchRemoteModels(
      { apiHost: 'https://openrouter.ai/api/v1', apiKey: '' },
      {
        ...dependencies,
        request: {
          ...dependencies.request,
          apiRequest: (options) =>
            dependencies.request.apiRequest({
              ...options,
              signal: AbortSignal.timeout(10_000),
              retry: 0,
            }),
        },
      }
    ).catch((error) => {
      // Briefly cache failures as well, so an unavailable catalog does not delay every request.
      expiresAt = Date.now() + 60_000
      throw error
    })
  }
  const models = await catalog
  return models.find((model) => model.modelId === modelId)?.pricing
}
