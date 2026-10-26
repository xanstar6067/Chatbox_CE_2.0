import type { ProviderSettings } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const testStore = vi.hoisted(() => ({ providers: {} as Record<string, ProviderSettings> }))

vi.mock('@/packages/usage-stats', () => ({ recordUsage: vi.fn() }))
vi.mock('@/packages/usage-stats/pricing', () => ({ getOpenRouterPricing: vi.fn() }))

vi.mock('@shared/models', () => ({
  getModel: vi.fn().mockReturnValue({
    name: 'test-model',
    modelId: 'test-model-id',
    isSupportVision: () => false,
    isSupportToolUse: () => false,
    isSupportSystemMessage: () => true,
    chat: vi.fn(),
    chatStream: vi.fn(),
    paint: vi.fn(),
  }),
}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      providers: testStore.providers,
      getSettings: () => ({
        language: 'en',
        providers: testStore.providers,
        theme: 'light',
      }),
    }),
    setState: vi.fn((update) => {
      const result = update({ providers: testStore.providers })
      testStore.providers = result.providers
    }),
  },
}))

vi.mock('@/platform', () => ({
  default: {
    type: 'desktop',
    getConfig: vi.fn().mockResolvedValue({ uuid: 'test-uuid-12345' }),
    getPlatform: vi.fn().mockResolvedValue('darwin'),
    getVersion: vi.fn().mockResolvedValue('1.0.0'),
  },
}))

vi.mock('@/packages/navigator', () => ({
  getOS: () => 'macos',
}))

vi.mock('@shared/request/request', () => ({
  createAfetch: () => vi.fn().mockResolvedValue(new Response()),
}))

vi.mock('@/storage', () => ({
  default: {
    setBlob: vi.fn(),
    getBlob: vi.fn(),
  },
}))

vi.mock('@/storage/StoreStorage', () => ({
  StorageKeyGenerator: {
    picture: vi.fn().mockReturnValue('mock-storage-key'),
  },
}))

vi.mock('@/stores/settingActions', () => ({
  getRemoteConfig: vi.fn().mockReturnValue({}),
}))

vi.mock('@/utils/request', () => ({
  apiRequest: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('./sentry', () => {
  class MockRendererSentryAdapter {
    captureException = vi.fn()
    withScope = vi.fn()
  }
  return {
    RendererSentryAdapter: MockRendererSentryAdapter,
  }
})

import { getModel } from '@shared/models'
import type { SessionSettings } from '@shared/types'
import { createModel } from '@/adapters'
import { getOpenRouterPricing } from '@/packages/usage-stats/pricing'
import platform from '@/platform'

function createTestSettings(overrides: SessionSettings = {}): SessionSettings {
  return {
    provider: 'openai',
    modelId: 'gpt-4',
    ...overrides,
  }
}

function getFirstGetModelCall() {
  const callArgs = vi.mocked(getModel).mock.calls.at(0)
  expect(callArgs).toBeDefined()
  if (!callArgs) {
    throw new Error('getModel was not called')
  }
  return callArgs
}

describe('createModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testStore.providers = {}
  })

  it('passes settings through to getModel', async () => {
    const settings = createTestSettings({ temperature: 0.7 })

    await createModel(settings)

    expect(getModel).toHaveBeenCalledWith(settings, expect.any(Object), expect.any(Object), expect.any(Object))
    const callArgs = getFirstGetModelCall()
    expect(callArgs[0]).toBe(settings)
  })

  it('uses manual OpenRouter prices without fetching the catalog', async () => {
    const pricing = { input: 2, output: 10, source: 'manual' as const, updatedAt: 1 }
    testStore.providers = { openrouter: { models: [{ modelId: 'vendor/model', pricing }] } }
    await createModel(createTestSettings({ provider: 'openrouter', modelId: 'vendor/model' }))
    expect(getOpenRouterPricing).not.toHaveBeenCalled()
    expect(getFirstGetModelCall()[1].providers?.openrouter?.models?.[0].pricing).toEqual(pricing)
  })

  it('saves fetched prices while preserving the model metadata', async () => {
    const pricing = { input: 1, output: 5, source: 'openrouter' as const, updatedAt: 2 }
    testStore.providers = {
      openrouter: { models: [{ modelId: 'vendor/model', nickname: 'My model', capabilities: ['tool_use'] }] },
    }
    vi.mocked(getOpenRouterPricing).mockResolvedValueOnce(pricing)
    await createModel(createTestSettings({ provider: 'openrouter', modelId: 'vendor/model' }))
    expect(testStore.providers.openrouter.models?.[0]).toMatchObject({
      nickname: 'My model',
      capabilities: ['tool_use'],
      pricing,
    })
    expect(getFirstGetModelCall()[1].providers?.openrouter?.models?.[0].pricing).toEqual(pricing)
  })

  it('keeps saved prices and creates the model when OpenRouter is offline', async () => {
    const pricing = { input: 1, output: 5, source: 'openrouter' as const, updatedAt: 1 }
    testStore.providers = { openrouter: { models: [{ modelId: 'vendor/model', pricing }] } }
    vi.mocked(getOpenRouterPricing).mockRejectedValueOnce(new Error('offline'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await createModel(createTestSettings({ provider: 'openrouter', modelId: 'vendor/model' }))
      expect(getFirstGetModelCall()[1].providers?.openrouter?.models?.[0].pricing).toEqual(pricing)
    } finally {
      warning.mockRestore()
    }
  })

  it('preserves manual changes made while a catalog request is in flight', async () => {
    testStore.providers = { openrouter: { models: [{ modelId: 'vendor/model' }] } }
    const manual = { input: 2, output: 10, source: 'manual' as const, updatedAt: 3 }
    vi.mocked(getOpenRouterPricing).mockImplementationOnce(async () => {
      testStore.providers = { openrouter: { models: [{ modelId: 'vendor/model', pricing: manual }] } }
      return { input: 1, output: 5, source: 'openrouter', updatedAt: 2 }
    })
    await createModel(createTestSettings({ provider: 'openrouter', modelId: 'vendor/model' }))
    expect(getFirstGetModelCall()[1].providers?.openrouter?.models?.[0].pricing).toEqual(manual)
  })

  it('gets globalSettings from settingsStore', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    expect(getModel).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        language: 'en',
        providers: {},
        theme: 'light',
      }),
      expect.any(Object),
      expect.any(Object)
    )
    const callArgs = getFirstGetModelCall()
    expect(callArgs[1]).toEqual({
      language: 'en',
      providers: {},
      theme: 'light',
    })
  })

  it('gets config from platform', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    expect(platform.getConfig).toHaveBeenCalled()
    expect(getModel).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      { uuid: 'test-uuid-12345' },
      expect.any(Object)
    )
    const callArgs = getFirstGetModelCall()
    expect(callArgs[2]).toEqual({ uuid: 'test-uuid-12345' })
  })

  it('creates dependencies internally', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    const callArgs = getFirstGetModelCall()
    const dependencies = callArgs[3]
    expect(dependencies).toBeDefined()
    expect(typeof dependencies).toBe('object')
    expect(dependencies).toHaveProperty('storage')
    expect(dependencies).toHaveProperty('request')
    expect(dependencies).toHaveProperty('sentry')
    expect(dependencies).toHaveProperty('getRemoteConfig')
  })

  it('returns the model instance from getModel', async () => {
    const settings = createTestSettings()

    const result = await createModel(settings)

    expect(result).toEqual({
      name: 'test-model',
      modelId: 'test-model-id',
      isSupportVision: expect.any(Function),
      isSupportToolUse: expect.any(Function),
      isSupportSystemMessage: expect.any(Function),
      chat: expect.any(Function),
      chatStream: expect.any(Function),
      paint: expect.any(Function),
    })
  })

  it('calls platform.getConfig before passing to getModel', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    expect(platform.getConfig).toHaveBeenCalled()
    expect(getModel).toHaveBeenCalled()
  })

  it('handles async platform.getConfig correctly', async () => {
    const settings = createTestSettings()
    const mockConfig = { uuid: 'async-test-uuid' }
    vi.mocked(platform.getConfig).mockResolvedValueOnce(mockConfig)

    await createModel(settings)

    const callArgs = getFirstGetModelCall()
    expect(callArgs[2]).toEqual(mockConfig)
  })

  it('dependencies storage adapter has correct structure', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    const callArgs = getFirstGetModelCall()
    const dependencies = callArgs[3]
    expect(dependencies.storage).toHaveProperty('saveImage')
    expect(dependencies.storage).toHaveProperty('getImage')
    expect(typeof dependencies.storage.saveImage).toBe('function')
    expect(typeof dependencies.storage.getImage).toBe('function')
  })

  it('dependencies request adapter has correct structure', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    const callArgs = getFirstGetModelCall()
    const dependencies = callArgs[3]
    expect(dependencies.request).toHaveProperty('fetchWithOptions')
    expect(dependencies.request).toHaveProperty('apiRequest')
    expect(typeof dependencies.request.fetchWithOptions).toBe('function')
    expect(typeof dependencies.request.apiRequest).toBe('function')
  })

  it('dependencies sentry adapter is instantiated', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    const callArgs = getFirstGetModelCall()
    const dependencies = callArgs[3]
    expect(dependencies.sentry).toBeDefined()
    expect(dependencies.sentry).toHaveProperty('captureException')
    expect(dependencies.sentry).toHaveProperty('withScope')
  })

  it('dependencies getRemoteConfig is a function', async () => {
    const settings = createTestSettings()

    await createModel(settings)

    const callArgs = getFirstGetModelCall()
    const dependencies = callArgs[3]
    expect(typeof dependencies.getRemoteConfig).toBe('function')
  })
})
