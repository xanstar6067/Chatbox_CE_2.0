import { fetchRemoteModels } from '@shared/models/openai-compatible'
import type { ProviderModelInfo } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import { matchOpenRouterPrice } from './pricing-match'

const CACHE_TTL = 60 * 60 * 1000
let catalog: Promise<ProviderModelInfo[]> | undefined
let expiresAt = 0

/** Shared by automatic OpenRouter pricing and the explicit import in the model editor. */
export function getOpenRouterCatalog(dependencies: ModelDependencies, refresh = false): Promise<ProviderModelInfo[]> {
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
  return catalog
}

export async function getOpenRouterPricing(
  modelId: string,
  dependencies: ModelDependencies,
  refresh = false,
  provider = 'openrouter',
  referenceId?: string
) {
  return matchOpenRouterPrice(modelId, provider, await getOpenRouterCatalog(dependencies, refresh), referenceId)
}
