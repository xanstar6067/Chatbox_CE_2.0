import { isUsingOAuth, mergeSharedOAuthProviderSettings } from '@shared/oauth'
import { getSystemProviders as SystemProviders } from '@shared/providers'
import type { ProviderModelInfo, SessionSettings, Settings } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import type { ModelPricing } from '@shared/utils/cost'
import { createStore, useStore } from 'zustand'
import platform from '@/platform'
import { settingsStore } from '@/stores/settingsStore'
import { getOpenRouterCatalog, getOpenRouterPricing } from './pricing'
import { matchOpenRouterPrice, supportsReferencePricing } from './pricing-match'

function providerModels(settings: Settings, provider: string): ProviderModelInfo[] {
  return (
    settings.providers?.[provider]?.models ??
    SystemProviders().find((item) => item.id === provider)?.defaultSettings?.models ??
    []
  )
}

export function connectedPricingModels(settings: Settings) {
  return [...SystemProviders(), ...(settings.customProviders ?? [])].flatMap((provider) => {
    if (!supportsReferencePricing(provider.id)) return []
    const config = mergeSharedOAuthProviderSettings(provider.id, settings.providers)
    const connected = provider.isCustom
      ? !!config.models?.length
      : !!(
          config.apiKey ||
          isUsingOAuth(config, platform.type) ||
          (provider.id === 'bedrock' && config.accessKey && config.secretKey)
        )
    if (!connected) return []
    return providerModels(settings, provider.id)
      .filter((model) => (!model.type || model.type === 'chat') && !config.excludedModels?.includes(model.modelId))
      .map((model) => ({ provider: provider.id, name: provider.name, model }))
  })
}

function savePrice(provider: string, modelId: string, pricing: ModelPricing, automatic: boolean) {
  settingsStore.setState((state) => {
    if (automatic && state.autoOpenRouterPricing === false) return state
    if (!state.providers?.[provider] && !connectedPricingModels(state).some((item) => item.provider === provider))
      return state
    const models = providerModels(state, provider)
    const current = models.find((model) => model.modelId === modelId)
    if (
      !current ||
      current.pricing?.source === 'manual' ||
      state.providers?.[provider]?.excludedModels?.includes(modelId)
    )
      return state
    if (JSON.stringify(current.pricing) === JSON.stringify(pricing)) return state
    return {
      providers: {
        ...state.providers,
        [provider]: {
          ...state.providers?.[provider],
          models: models.map((model) => (model.modelId === modelId ? { ...model, pricing } : model)),
        },
      },
    }
  })
}

/** Runs before a model request too, so a newly selected model does not need a restart. */
export async function ensureModelPricing(settings: SessionSettings, dependencies: ModelDependencies) {
  const global = settingsStore.getState().getSettings()
  const { provider, modelId } = settings
  if (global.autoOpenRouterPricing === false || !provider || !modelId || !supportsReferencePricing(provider)) return
  const model = providerModels(global, provider).find((model) => model.modelId === modelId)
  if (!model || model.pricing?.source === 'manual' || (model.type && model.type !== 'chat')) return
  try {
    const pricing = await getOpenRouterPricing(modelId, dependencies, false, provider, model.pricing?.modelId)
    if (pricing) savePrice(provider, modelId, pricing, true)
  } catch (error) {
    console.warn('OpenRouter pricing unavailable; using the saved rate if available', error)
  }
}

interface PriceSearchResult {
  matched: number
  manual: number
  missing: string[]
}
interface PriceSearchState {
  loading: boolean
  error: boolean
  result?: PriceSearchResult
}
export const priceSearchStore = createStore<PriceSearchState>(() => ({ loading: false, error: false }))
export const usePriceSearch = <T>(selector: (state: PriceSearchState) => T) => useStore(priceSearchStore, selector)
let inFlight: Promise<void> | undefined

export function updateConnectedPrices(
  dependencies: ModelDependencies,
  automatic = false,
  refresh = true
): Promise<void> {
  if (inFlight) return inFlight
  if (automatic && settingsStore.getState().autoOpenRouterPricing === false) return Promise.resolve()
  priceSearchStore.setState({ loading: true, error: false })
  inFlight = (async () => {
    const initialModels = connectedPricingModels(settingsStore.getState().getSettings())
    if (initialModels.every(({ model }) => model.pricing?.source === 'manual')) {
      priceSearchStore.setState({ result: { matched: 0, manual: initialModels.length, missing: [] } })
      return
    }
    const catalog = await getOpenRouterCatalog(dependencies, refresh)
    // Re-read after fetching: models may have been added, removed or manually edited in the meantime.
    const settings = settingsStore.getState().getSettings()
    if (automatic && settings.autoOpenRouterPricing === false) return
    const result: PriceSearchResult = { matched: 0, manual: 0, missing: [] }
    for (const { provider, name, model } of connectedPricingModels(settings)) {
      if (model.pricing?.source === 'manual') {
        result.manual++
        continue
      }
      const pricing = matchOpenRouterPrice(model.modelId, provider, catalog, model.pricing?.modelId)
      if (pricing) {
        savePrice(provider, model.modelId, pricing, automatic)
        result.matched++
      } else result.missing.push(`${name}: ${model.modelId}`)
    }
    priceSearchStore.setState({ result })
  })()
    .catch((error) => {
      priceSearchStore.setState({ error: true })
      console.warn('Could not update connected model prices', error)
    })
    .finally(() => {
      inFlight = undefined
      priceSearchStore.setState({ loading: false })
    })
  return inFlight
}

let initialized = false
export function initAutomaticPricing(getDependencies: () => Promise<ModelDependencies>) {
  if (initialized) return
  initialized = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const fingerprint = () => {
    const settings = settingsStore.getState().getSettings()
    return JSON.stringify([
      settings.autoOpenRouterPricing,
      connectedPricingModels(settings).map(({ provider, model }) => [
        provider,
        model.modelId,
        model.pricing?.source === 'manual',
      ]),
    ])
  }
  let previous = fingerprint()
  const schedule = () => {
    clearTimeout(timer)
    if (settingsStore.getState().autoOpenRouterPricing === false) return
    timer = setTimeout(() => {
      void getDependencies()
        .then((deps) => updateConnectedPrices(deps, true, false))
        .catch((error) => console.warn('Automatic price refresh failed', error))
    }, 350)
  }
  settingsStore.subscribe(() => {
    const next = fingerprint()
    if (next !== previous) {
      previous = next
      schedule()
    }
  })
  schedule()
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', schedule)
    window.setInterval(schedule, 60 * 60 * 1000)
  }
}
