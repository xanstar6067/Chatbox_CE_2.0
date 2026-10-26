import { settings as defaults } from '@shared/defaults'
import type { ProviderModelInfo, Settings } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ current: undefined as Settings | undefined, listeners: new Set<() => void>() }))
vi.mock('@/platform', () => ({ default: { type: 'desktop' } }))
vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({ ...store.current, getSettings: () => store.current }),
    setState: (update: (state: Settings) => Partial<Settings>) => {
      if (!store.current) throw new Error('No settings')
      store.current = { ...store.current, ...update(store.current) }
      for (const listener of store.listeners) listener()
    },
    subscribe: (listener: () => void) => {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    },
  },
}))
vi.mock('./pricing', () => ({ getOpenRouterCatalog: vi.fn(), getOpenRouterPricing: vi.fn() }))

import { settingsStore } from '@/stores/settingsStore'
import { getOpenRouterCatalog, getOpenRouterPricing } from './pricing'

const priced = (modelId: string): ProviderModelInfo => ({
  modelId,
  pricing: { modelId, input: 1, output: 5, source: 'openrouter', updatedAt: 1 },
})
const catalog = [priced('google/gemini-3.8-flash'), priced('google/gemini-2.5-pro'), priced('openai/gpt-4o')]
const dependencies = {} as ModelDependencies
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  store.listeners.clear()
  store.current = {
    ...defaults(),
    providers: {
      gemini: { apiKey: 'test-google', models: [{ modelId: 'gemini-3.8-flash', nickname: 'My Gemini' }] },
      openai: { apiKey: 'test-openai', models: [{ modelId: 'gpt-4o' }] },
    },
  }
  vi.mocked(getOpenRouterCatalog).mockReset().mockResolvedValue(catalog)
  vi.mocked(getOpenRouterPricing).mockReset().mockResolvedValue(catalog[0].pricing)
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('connected model pricing', () => {
  it('updates Google and OpenAI together without changing IDs, credentials or metadata', async () => {
    const manager = await import('./connected-pricing')
    await manager.updateConnectedPrices(dependencies)
    expect(store.current?.providers?.gemini).toMatchObject({
      apiKey: 'test-google',
      models: [{ modelId: 'gemini-3.8-flash', nickname: 'My Gemini', pricing: { modelId: 'google/gemini-3.8-flash' } }],
    })
    expect(store.current?.providers?.openai?.models?.[0].pricing?.modelId).toBe('openai/gpt-4o')
    expect(manager.priceSearchStore.getState().result).toEqual({ matched: 2, manual: 0, missing: [] })
    expect(getOpenRouterCatalog).toHaveBeenCalledTimes(1)
  })
  it('keeps manual prices and allows an explicit update while automatic lookup is off', async () => {
    if (!store.current) throw new Error('No settings')
    store.current.autoOpenRouterPricing = false
    const manual = { input: 3, output: 15, source: 'manual' as const, updatedAt: 1 }
    const googleModel = store.current.providers?.gemini.models?.[0]
    if (!googleModel) throw new Error('Missing Google model')
    googleModel.pricing = manual
    const manager = await import('./connected-pricing')
    await manager.ensureModelPricing({ provider: 'gemini', modelId: 'gemini-3.8-flash' }, dependencies)
    expect(getOpenRouterPricing).not.toHaveBeenCalled()
    await manager.updateConnectedPrices(dependencies, true)
    expect(getOpenRouterCatalog).not.toHaveBeenCalled()
    await manager.updateConnectedPrices(dependencies)
    expect(store.current.providers?.gemini.models?.[0].pricing).toEqual(manual)
    expect(store.current.providers?.openai.models?.[0].pricing?.modelId).toBe('openai/gpt-4o')
  })
  it('preserves the full default model list when adding prices', async () => {
    if (!store.current) throw new Error('No settings')
    store.current.providers = { gemini: { apiKey: 'test-google' } }
    const manager = await import('./connected-pricing')
    const { getSystemProviders } = await import('@shared/providers')
    const initialModels =
      getSystemProviders().find((provider) => provider.id === 'gemini')?.defaultSettings?.models ?? []
    await manager.updateConnectedPrices(dependencies)
    expect(store.current.providers.gemini.models?.length).toBe(initialModels.length)
    expect(
      store.current.providers.gemini.models?.find((model) => model.modelId === 'gemini-3.8-flash')?.pricing
    ).toBeDefined()
  })
  it('does not resurrect a provider removed while the catalog is loading', async () => {
    let finish: ((value: ProviderModelInfo[]) => void) | undefined
    vi.mocked(getOpenRouterCatalog).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const manager = await import('./connected-pricing')
    const updating = manager.updateConnectedPrices(dependencies)
    if (!store.current || !finish) throw new Error('No pending update')
    store.current.providers = {}
    finish(catalog)
    await updating
    expect(store.current.providers).toEqual({})
  })
  it('refreshes on startup and newly connected models, without reacting to its own price writes', async () => {
    const manager = await import('./connected-pricing')
    const factory = vi.fn(() => Promise.resolve(dependencies))
    manager.initAutomaticPricing(factory)
    await vi.advanceTimersByTimeAsync(400)
    expect(factory).toHaveBeenCalledTimes(1)
    settingsStore.setState((state) => ({
      providers: {
        ...state.providers,
        gemini: {
          ...state.providers?.gemini,
          models: [...(state.providers?.gemini.models ?? []), { modelId: 'gemini-2.5-pro' }],
        },
      },
    }))
    await vi.advanceTimersByTimeAsync(400)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(store.current?.providers?.gemini.models?.[1].pricing?.modelId).toBe('google/gemini-2.5-pro')
    settingsStore.setState(() => ({ autoOpenRouterPricing: false }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
