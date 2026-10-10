import type { ModelDependencies } from '@shared/types/adapters'
import type { ModelMessage } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Bedrock, { isBedrockCacheModel } from './bedrock'

function createDependencies(): ModelDependencies {
  return {
    request: { apiRequest: vi.fn(), fetchWithOptions: vi.fn() },
    storage: { saveImage: vi.fn(), getImage: vi.fn() },
    sentry: { captureException: vi.fn(), withScope: vi.fn() },
    getRemoteConfig: vi.fn(),
    platformType: 'desktop',
  }
}

async function captureConverseRequest(modelId: string) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
          stopReason: 'end_turn',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  )
  vi.stubGlobal('fetch', fetch)
  const model = new Bedrock(
    {
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
      region: 'us-east-1',
      model: { modelId },
    },
    createDependencies()
  )
  const messages: ModelMessage[] = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: [{ type: 'text', text: 'first' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'response' }] },
    { role: 'user', content: [{ type: 'text', text: 'second' }] },
  ]
  await model.chat(messages, {})
  return JSON.parse(fetch.mock.calls[0][1]?.body as string)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Bedrock prompt caching', () => {
  it('enables cache checkpoints for current Claude models only', () => {
    expect(isBedrockCacheModel('anthropic.claude-sonnet-5')).toBe(true)
    expect(isBedrockCacheModel('us.anthropic.claude-opus-4-5-20251101-v1:0')).toBe(true)
    expect(isBedrockCacheModel('anthropic.claude-3-7-sonnet-20250219-v1:0')).toBe(true)
    expect(isBedrockCacheModel('anthropic.claude-3-haiku-20240307-v1:0')).toBe(false)
    expect(isBedrockCacheModel('anthropic.claude-3-5-sonnet-20240620-v1:0')).toBe(false)
    expect(isBedrockCacheModel('meta.llama3-70b-instruct-v1:0')).toBe(false)
  })

  it('sends cachePoint blocks for Claude models', async () => {
    const request = await captureConverseRequest('anthropic.claude-sonnet-5')
    const cachePoint = { cachePoint: { type: 'default' } }

    expect(request.system).toEqual([{ text: 'You are helpful.' }, cachePoint])
    expect(request.messages[0].content).toEqual([{ text: 'first' }, cachePoint])
    expect(request.messages[1].content).not.toContainEqual(cachePoint)
    expect(request.messages[2].content).toEqual([{ text: 'second' }, cachePoint])
  })

  it('does not send cachePoint blocks for other models', async () => {
    const request = await captureConverseRequest('meta.llama3-70b-instruct-v1:0')

    expect(JSON.stringify(request)).not.toContain('cachePoint')
  })
})
