import { describe, expect, it } from 'vitest'
import {
  getDefaultOpenRouterReasoningEffort,
  getSupportedOpenRouterReasoningEfforts,
  supportsOpenRouterReasoning,
} from './openrouter-reasoning'

describe('openrouter-reasoning utils', () => {
  it('uses the per-model effort list published by OpenRouter', () => {
    const claude = {
      supportedParameters: ['reasoning', 'tools'],
      reasoning: {
        mandatory: false,
        default_enabled: true,
        supported_efforts: ['max', 'xhigh', 'high', 'medium', 'low'],
        default_effort: 'high',
      },
    }

    expect(getSupportedOpenRouterReasoningEfforts(claude)).toEqual(['none', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(getDefaultOpenRouterReasoningEffort(claude)).toBe('high')
  })

  it('does not offer disabling reasoning for mandatory reasoning models', () => {
    const gemini = {
      supportedParameters: ['reasoning'],
      reasoning: {
        mandatory: true,
        default_enabled: true,
        supported_efforts: ['high', 'medium', 'low'],
        default_effort: 'medium',
      },
    }

    expect(getSupportedOpenRouterReasoningEfforts(gemini)).toEqual(['low', 'medium', 'high'])
    expect(getDefaultOpenRouterReasoningEffort(gemini)).toBe('medium')
  })

  it('falls back to generic efforts when the model accepts reasoning without an effort list', () => {
    const optional = { supportedParameters: ['reasoning'], reasoning: { mandatory: false } }
    const enabledByDefault = {
      supportedParameters: ['reasoning'],
      reasoning: { mandatory: false, default_enabled: true },
    }

    expect(getSupportedOpenRouterReasoningEfforts(optional)).toEqual(['none', 'low', 'medium', 'high'])
    expect(getDefaultOpenRouterReasoningEffort(optional)).toBe('none')
    expect(getDefaultOpenRouterReasoningEffort(enabledByDefault)).toBe('medium')
  })

  it('ignores unknown effort names and models without reasoning support', () => {
    expect(
      getSupportedOpenRouterReasoningEfforts({
        supportedParameters: ['reasoning'],
        reasoning: { mandatory: true, supported_efforts: ['turbo', 'high'] },
      })
    ).toEqual(['high'])
    expect(supportsOpenRouterReasoning({ supportedParameters: ['tools'] })).toBe(false)
    expect(getSupportedOpenRouterReasoningEfforts({ supportedParameters: ['tools'] })).toEqual([])
    expect(getDefaultOpenRouterReasoningEffort(undefined)).toBeUndefined()
  })
})
