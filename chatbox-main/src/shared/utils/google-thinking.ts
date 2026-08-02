export type GoogleThinkingLevel = 'minimal' | 'low' | 'medium' | 'high'
export type GoogleThinkingMode = 'budget' | 'level' | 'none'

export interface GoogleThinkingConfig {
  thinkingBudget?: number
  thinkingLevel?: GoogleThinkingLevel
  includeThoughts?: boolean
}

const GOOGLE_THINKING_CONFIG_BY_MODEL: Array<{
  pattern: RegExp
  levels: GoogleThinkingLevel[]
  defaultLevel: GoogleThinkingLevel
}> = [
  // Keep the more specific rules first. This mirrors Google's current
  // generateContent thinking-level matrix rather than guessing by provider metadata.
  {
    pattern: /^gemini-3\.1-flash-lite-image/i,
    levels: ['minimal', 'high'],
    defaultLevel: 'minimal',
  },
  {
    pattern: /^gemini-3\.[56]-flash-lite/i,
    levels: ['minimal', 'low', 'medium', 'high'],
    defaultLevel: 'minimal',
  },
  {
    pattern: /^gemini-3\.[56]-flash/i,
    levels: ['minimal', 'low', 'medium', 'high'],
    defaultLevel: 'medium',
  },
  {
    pattern: /^gemini-3\.1-pro(?!-image)/i,
    levels: ['low', 'medium', 'high'],
    defaultLevel: 'high',
  },
  {
    pattern: /^gemini-3-pro(?!-image)/i,
    levels: ['low', 'high'],
    defaultLevel: 'high',
  },
  {
    pattern: /^gemini-3\.1-flash-lite(?!-image)/i,
    levels: ['minimal', 'low', 'medium', 'high'],
    defaultLevel: 'minimal',
  },
  {
    pattern: /^gemini-3(?:\.1)?-flash(?!-(lite|image))/i,
    levels: ['minimal', 'low', 'medium', 'high'],
    defaultLevel: 'high',
  },
]

export function getGoogleThinkingMode(modelId: string): GoogleThinkingMode {
  const id = modelId.toLowerCase()
  if (id.startsWith('gemini-3')) {
    return 'level'
  }

  if (id.startsWith('gemini-2.5')) {
    return 'budget'
  }

  return 'none'
}

export function getSupportedGoogleThinkingLevels(modelId: string): GoogleThinkingLevel[] {
  if (getGoogleThinkingMode(modelId) !== 'level') {
    return []
  }

  const match = GOOGLE_THINKING_CONFIG_BY_MODEL.find(({ pattern }) => pattern.test(modelId))

  return match?.levels || []
}

export function getDefaultGoogleThinkingLevel(modelId: string): GoogleThinkingLevel | undefined {
  return GOOGLE_THINKING_CONFIG_BY_MODEL.find(({ pattern }) => pattern.test(modelId))?.defaultLevel
}

export function normalizeGoogleThinkingConfig(
  modelId: string,
  thinkingConfig?: GoogleThinkingConfig
): GoogleThinkingConfig | undefined {
  const mode = getGoogleThinkingMode(modelId)

  if (!thinkingConfig) {
    if (mode === 'level') {
      const defaultLevel = getDefaultGoogleThinkingLevel(modelId)
      return defaultLevel ? { thinkingLevel: defaultLevel } : undefined
    }
    return undefined
  }

  if (mode === 'budget') {
    return {
      ...(thinkingConfig.thinkingBudget !== undefined ? { thinkingBudget: thinkingConfig.thinkingBudget } : {}),
      ...(thinkingConfig.includeThoughts !== undefined ? { includeThoughts: thinkingConfig.includeThoughts } : {}),
    }
  }

  if (mode === 'level') {
    const supportedLevels = getSupportedGoogleThinkingLevels(modelId)
    const thinkingLevel = thinkingConfig.thinkingLevel

    // Fix: strip thinkingLevel for Gemini 3 models not in the supported list (e.g. image models),
    // so stale levels from a previous model selection are not sent to the API.
    if (supportedLevels.length === 0) {
      return thinkingConfig.includeThoughts !== undefined
        ? { includeThoughts: thinkingConfig.includeThoughts }
        : undefined
    }

    // Use the saved level if valid, otherwise explicitly send the default ("high").
    const effectiveLevel =
      thinkingLevel && supportedLevels.includes(thinkingLevel) ? thinkingLevel : getDefaultGoogleThinkingLevel(modelId)

    return {
      ...(effectiveLevel ? { thinkingLevel: effectiveLevel } : {}),
      ...(thinkingConfig.includeThoughts !== undefined ? { includeThoughts: thinkingConfig.includeThoughts } : {}),
    }
  }

  return thinkingConfig
}
