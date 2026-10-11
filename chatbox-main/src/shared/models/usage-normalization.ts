import type { LanguageModelV3Middleware, LanguageModelV3Usage } from '@ai-sdk/provider'

function readNumber(source: unknown, ...path: string[]): number | undefined {
  let value: unknown = source
  for (const key of path) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return typeof value === 'number' ? value : undefined
}

/**
 * xAI reports `completion_tokens` without reasoning tokens (`total_tokens` = prompt + completion + reasoning),
 * while OpenAI-compatible SDK parsers assume completion already includes them. Without this, Grok replies
 * lose all reasoning tokens from output/total and get a negative text token count.
 *
 * The raw totals decide: usage is only rewritten when the provider's own `total_tokens` proves the reasoning
 * tokens were reported on top of the completion, so providers that follow the OpenAI convention are untouched.
 */
export function addSeparatelyReportedReasoningTokens(usage: LanguageModelV3Usage): LanguageModelV3Usage {
  const raw = usage.raw
  const inputTokens = readNumber(raw, 'prompt_tokens') ?? readNumber(raw, 'input_tokens')
  const outputTokens = readNumber(raw, 'completion_tokens') ?? readNumber(raw, 'output_tokens')
  const reasoningTokens =
    readNumber(raw, 'completion_tokens_details', 'reasoning_tokens') ??
    readNumber(raw, 'output_tokens_details', 'reasoning_tokens')
  const totalTokens = readNumber(raw, 'total_tokens')

  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    totalTokens === undefined ||
    !reasoningTokens ||
    totalTokens !== inputTokens + outputTokens + reasoningTokens
  ) {
    return usage
  }

  return {
    ...usage,
    outputTokens: {
      total: outputTokens + reasoningTokens,
      text: outputTokens,
      reasoning: reasoningTokens,
    },
  }
}

export const separateReasoningUsageMiddleware: LanguageModelV3Middleware = {
  specificationVersion: 'v3',
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate()
    return { ...result, usage: addSeparatelyReportedReasoningTokens(result.usage) }
  },
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream()
    return {
      ...rest,
      stream: stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            controller.enqueue(
              part.type === 'finish' ? { ...part, usage: addSeparatelyReportedReasoningTokens(part.usage) } : part
            )
          },
        })
      ),
    }
  },
}
