export type OpenRouterReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// Ordered from least to most reasoning, matching OpenRouter's unified `reasoning.effort` values.
export const OPENROUTER_REASONING_EFFORTS: OpenRouterReasoningEffort[] = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]

// Used when a model accepts `reasoning` but OpenRouter does not publish its effort list.
// OpenRouter maps these onto the underlying provider's reasoning controls.
const GENERIC_REASONING_EFFORTS: OpenRouterReasoningEffort[] = ['low', 'medium', 'high']

/**
 * The `supported_parameters` entries that mark a model as reasoning-capable in
 * OpenRouter's `/models` catalog. Models expose the control under different names
 * depending on the upstream provider, so all three have to be recognised.
 */
export const OPENROUTER_REASONING_PARAMETERS = ['reasoning', 'include_reasoning', 'reasoning_effort']

/** The `reasoning` object and `supported_parameters` from OpenRouter's `/models` catalog. */
export interface OpenRouterModelReasoningInfo {
  supportedParameters?: string[]
  reasoning?: {
    mandatory?: boolean
    default_enabled?: boolean
    supported_efforts?: string[]
    default_effort?: string
  } | null
}

function isOpenRouterReasoningEffort(value: unknown): value is OpenRouterReasoningEffort {
  return typeof value === 'string' && (OPENROUTER_REASONING_EFFORTS as string[]).includes(value)
}

export function supportsOpenRouterReasoning(info: OpenRouterModelReasoningInfo | undefined): boolean {
  if (!info) return false
  return Boolean(
    info.supportedParameters?.some((parameter) => OPENROUTER_REASONING_PARAMETERS.includes(parameter)) ||
      info.reasoning?.supported_efforts?.length
  )
}

export function getSupportedOpenRouterReasoningEfforts(
  info: OpenRouterModelReasoningInfo | undefined
): OpenRouterReasoningEffort[] {
  if (!info || !supportsOpenRouterReasoning(info)) return []

  const published = (info.reasoning?.supported_efforts || []).filter(isOpenRouterReasoningEffort)
  const levels = new Set<OpenRouterReasoningEffort>(published.length > 0 ? published : GENERIC_REASONING_EFFORTS)
  if (info.reasoning?.mandatory) {
    levels.delete('none')
  } else {
    levels.add('none')
  }

  return OPENROUTER_REASONING_EFFORTS.filter((level) => levels.has(level))
}

export function getDefaultOpenRouterReasoningEffort(
  info: OpenRouterModelReasoningInfo | undefined
): OpenRouterReasoningEffort | undefined {
  const levels = getSupportedOpenRouterReasoningEfforts(info)
  if (levels.length === 0) return undefined

  const defaultEffort = info?.reasoning?.default_effort
  if (isOpenRouterReasoningEffort(defaultEffort) && levels.includes(defaultEffort)) {
    return defaultEffort
  }
  if (!info?.reasoning?.mandatory && info?.reasoning?.default_enabled !== true && levels.includes('none')) {
    return 'none'
  }
  if (levels.includes('medium')) return 'medium'
  return levels.find((level) => level !== 'none') ?? levels[0]
}
