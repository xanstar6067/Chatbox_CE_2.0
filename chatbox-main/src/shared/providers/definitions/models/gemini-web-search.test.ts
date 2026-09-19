import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, jsonSchema, tool } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { getGeminiNativeWebSearch } from './gemini-web-search'

function createFetch() {
  return vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  )
}

const localTool = tool({
  description: 'Reads a local file',
  inputSchema: jsonSchema<{ path: string }>({ type: 'object', properties: { path: { type: 'string' } } }),
  execute: async () => 'contents',
})

describe('Gemini native web search', () => {
  it('keeps Chatbox function tools when Gemini 3 combines them with built-in tools', async () => {
    const fetch = createFetch()
    const provider = createGoogleGenerativeAI({ apiKey: 'test', fetch })
    const nativeSearch = getGeminiNativeWebSearch(
      provider,
      { modelId: 'gemini-3.8-flash', capabilities: ['tool_use'] },
      { hasCustomTools: true }
    )

    await generateText({
      model: provider.chat('gemini-3.8-flash'),
      prompt: 'Search and read',
      tools: { ...nativeSearch?.tools, read_file: localTool },
    })

    const body = JSON.parse(fetch.mock.calls[0][1]?.body as string)
    expect(body.tools).toEqual(
      expect.arrayContaining([
        { googleSearch: {} },
        { urlContext: {} },
        { functionDeclarations: [expect.objectContaining({ name: 'read_file' })] },
      ])
    )
    expect(body.toolConfig).toMatchObject({ includeServerSideToolInvocations: true })
  })

  it('falls back to the configured search provider for Gemini 2.5 with function tools', () => {
    const provider = createGoogleGenerativeAI({ apiKey: 'test' })

    expect(getGeminiNativeWebSearch(provider, { modelId: 'gemini-2.5-flash' }, { hasCustomTools: true })).toBeNull()
    expect(getGeminiNativeWebSearch(provider, { modelId: 'gemini-2.5-flash' })?.tools).toHaveProperty('url_context')
  })
})
