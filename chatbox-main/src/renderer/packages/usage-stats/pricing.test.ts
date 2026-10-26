import type { ModelDependencies } from '@shared/types/adapters'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOpenRouterPricing } from './pricing'

afterEach(() => vi.useRealTimers())

function dependencies(apiRequest: ReturnType<typeof vi.fn>) {
  return { request: { apiRequest } } as unknown as ModelDependencies
}

const response = () =>
  new Response(
    JSON.stringify({
      data: [{ id: 'vendor/model', pricing: { prompt: '0.000002', completion: '0.00001', input_cache_read: '0' } }],
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )

describe('OpenRouter price catalog', () => {
  it('loads exact model IDs without credentials and shares cached requests', async () => {
    const apiRequest = vi.fn().mockImplementation(async () => response())
    const deps = dependencies(apiRequest)
    const [a, b] = await Promise.all([
      getOpenRouterPricing('vendor/model', deps),
      getOpenRouterPricing('vendor/model', deps),
    ])
    expect(a).toMatchObject({ input: 2, output: 10, cacheRead: 0, source: 'openrouter' })
    expect(b).toEqual(a)
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest.mock.calls[0][0]).toMatchObject({
      url: 'https://openrouter.ai/api/v1/models',
      headers: {},
      retry: 0,
    })
    expect(await getOpenRouterPricing('model', deps)).toBeUndefined()
    await getOpenRouterPricing('vendor/model', deps, true)
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it('rejects failed responses and retries after a short failure cache', async () => {
    vi.useFakeTimers()
    const apiRequest = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockImplementation(async () => response())
    const deps = dependencies(apiRequest)
    await expect(getOpenRouterPricing('vendor/model', deps, true)).rejects.toThrow()
    await expect(getOpenRouterPricing('vendor/model', deps)).rejects.toThrow()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_001)
    expect(await getOpenRouterPricing('vendor/model', deps)).toMatchObject({ input: 2 })
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })
})
