export type XAIReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh'

interface XAIReasoningConfigByModel {
  pattern: RegExp
  levels: XAIReasoningEffort[]
  defaultLevel: XAIReasoningEffort
}

const XAI_REASONING_CONFIG_BY_MODEL: XAIReasoningConfigByModel[] = [
  // Keep the more specific rules first. The matrix follows the xAI model pages
  // and reasoning docs instead of assuming one provider-wide effort list.
  {
    pattern: /^grok-4\.20-multi-agent(?:-|$)/i,
    levels: ['low', 'medium', 'high', 'xhigh'],
    defaultLevel: 'low',
  },
  {
    pattern: /^grok-4\.7(?:-|$)/i,
    levels: ['low', 'medium', 'high', 'xhigh'],
    defaultLevel: 'high',
  },
  {
    pattern: /^grok-4\.6(?:-|$)/i,
    levels: ['low', 'medium', 'high', 'xhigh'],
    defaultLevel: 'high',
  },
  {
    pattern: /^(grok-4\.5(?:-|$)|grok-build-latest$)/i,
    levels: ['low', 'medium', 'high'],
    defaultLevel: 'high',
  },
  {
    pattern: /^grok-4\.3(?:-|$)/i,
    levels: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultLevel: 'low',
  },
]

export function getSupportedXAIReasoningEfforts(modelId: string): XAIReasoningEffort[] {
  return XAI_REASONING_CONFIG_BY_MODEL.find(({ pattern }) => pattern.test(modelId))?.levels || []
}

export function getDefaultXAIReasoningEffort(modelId: string): XAIReasoningEffort | undefined {
  return XAI_REASONING_CONFIG_BY_MODEL.find(({ pattern }) => pattern.test(modelId))?.defaultLevel
}

export function normalizeXAIReasoningEffort(
  modelId: string,
  reasoningEffort?: XAIReasoningEffort
): XAIReasoningEffort | undefined {
  const supportedLevels = getSupportedXAIReasoningEfforts(modelId)
  if (supportedLevels.length === 0) {
    return undefined
  }

  if (reasoningEffort && supportedLevels.includes(reasoningEffort)) {
    return reasoningEffort
  }

  return getDefaultXAIReasoningEffort(modelId)
}
