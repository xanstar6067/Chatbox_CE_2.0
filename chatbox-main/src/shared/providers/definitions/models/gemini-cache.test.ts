import { MessageSchema } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import type { SentryScope } from '@shared/utils/sentry_adapter'
import type { ModelMessage } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CustomGemini from './custom-gemini'
import Gemini from './gemini'

function createDependencies(): ModelDependencies {
  return {
    request: { apiRequest: vi.fn(), fetchWithOptions: vi.fn() },
    storage: { saveImage: vi.fn(), getImage: vi.fn() },
    sentry: {
      captureException: vi.fn(),
      withScope: vi.fn((callback: (scope: SentryScope) => void) => callback({ setTag: vi.fn(), setExtra: vi.fn() })),
    },
    getRemoteConfig: vi.fn(),
    platformType: 'mobile',
    recordUsage: vi.fn(),
  }
}

function createModel(provider: 'gemini' | 'custom', modelId: string, stream: boolean, dependencies: ModelDependencies) {
  const options = { model: { modelId, capabilities: ['reasoning' as const] }, stream }
  return provider === 'gemini'
    ? new Gemini(
        { ...options, geminiAPIKey: 'test', geminiAPIHost: 'https://generativelanguage.googleapis.com' },
        dependencies
      )
    : new CustomGemini(
        { ...options, apiKey: 'test', apiHost: 'https://generativelanguage.googleapis.com' },
        dependencies
      )
}

function mockGoogleResponse(cachedTokens?: number) {
  const response = {
    candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
    usageMetadata: {
      promptTokenCount: 10_000,
      candidatesTokenCount: 10,
      thoughtsTokenCount: 20,
      totalTokenCount: 10_030,
      ...(cachedTokens === undefined ? {} : { cachedContentTokenCount: cachedTokens }),
    },
  }
  // Google may send usage in a final event without any candidate content.
  const events = [{ candidates: response.candidates }, { usageMetadata: response.usageMetadata }]
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
    String(input).includes(':streamGenerateContent')
      ? new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
          headers: { 'Content-Type': 'text/event-stream' },
        })
      : new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } })
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe.each(['gemini', 'custom'] as const)('%s prompt cache', (provider) => {
  describe.each(['gemini-2.5-pro', 'gemini-3.1-pro-preview'])('%s', (modelId) => {
    it.each([true, false])('preserves cache hits in message storage and statistics with stream=%s', async (stream) => {
      mockGoogleResponse(8_192)
      const dependencies = createDependencies()
      const model = createModel(provider, modelId, stream, dependencies)
      const chunks = []
      for await (const chunk of model.chatStream([{ role: 'user', content: 'test' }], { usagePurpose: 'chat' })) {
        chunks.push(chunk)
      }

      const finish = chunks.find((chunk) => chunk.type === 'finish')
      expect(finish?.type).toBe('finish')
      if (finish?.type !== 'finish') throw new Error('Missing finish event')
      const savedMessage = MessageSchema.parse({
        id: 'reply',
        role: 'assistant',
        contentParts: [{ type: 'text', text: 'ok' }],
        usage: finish.totalUsage,
      })
      expect(savedMessage.usage).toMatchObject({
        inputTokens: 10_000,
        outputTokens: 30,
        totalTokens: 10_030,
        inputTokenDetails: { cacheReadTokens: 8_192, noCacheTokens: 1_808 },
      })
      expect(dependencies.recordUsage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ modelId, inputTokens: 10_000, cacheReadTokens: 8_192 })
      )
    })

    it('reports zero cache reads when Google omits cachedContentTokenCount', async () => {
      mockGoogleResponse()
      const dependencies = createDependencies()
      const result = await createModel(provider, modelId, true, dependencies).chat(
        [{ role: 'user', content: 'test' }],
        { usagePurpose: 'chat' }
      )
      expect(result.usage?.inputTokenDetails?.cacheReadTokens).toBe(0)
      expect(dependencies.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ cacheReadTokens: 0 }))
    })

    it('keeps the system and earlier contents unchanged when a conversation grows', async () => {
      const fetch = mockGoogleResponse(8_192)
      const model = createModel(provider, modelId, true, createDependencies())
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Shared instructions' },
        { role: 'user', content: 'Shared document' },
      ]
      await model.chat(messages, {})
      await model.chat(
        [...messages, { role: 'assistant', content: 'ok' }, { role: 'user', content: 'Next question' }],
        {}
      )
      const requests = fetch.mock.calls.map(([, init]) => JSON.parse(init?.body as string))
      expect(requests[1].systemInstruction).toEqual(requests[0].systemInstruction)
      expect(requests[1].contents.slice(0, requests[0].contents.length)).toEqual(requests[0].contents)
      expect(requests[0].cachedContent).toBeUndefined()
    })
  })
})
