import { createMessage } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  DETAILED_COMPACTION_PROMPT_ID,
  nameConversation,
  ROLEPLAY_COMPACTION_PROMPT_ID,
  resolveCompactionPrompt,
  summarizeConversation,
} from './prompts'

describe('nameConversation', () => {
  it('asks for a specific title without conflicting length limits', () => {
    const userMessage = createMessage(
      'user',
      `Help me redesign automatic conversation titles for the Android app. ${'Important context. '.repeat(12)}`
    )
    const assistantMessage = createMessage('assistant', 'I will inspect the title generation flow and improve it.')

    const prompt = nameConversation([userMessage, assistantMessage], 'Russian')
    const textPart = prompt[0].contentParts[0]

    expect(textPart.type).toBe('text')
    if (textPart.type !== 'text') return

    expect(textPart.text).toContain('Create a concise, informative title')
    expect(textPart.text).toContain('specific names, projects, characters, technologies, places')
    expect(textPart.text).toContain('stay under 60 characters')
    expect(textPart.text).not.toContain('10 characters or less')
    expect(textPart.text).toContain('[user]')
    expect(textPart.text).toContain('Important context.')
  })
})

describe('compaction prompts', () => {
  it('resolves the detailed built-in prompt in the selected language', () => {
    const prompt = resolveCompactionPrompt(DETAILED_COMPACTION_PROMPT_ID, [], 'Russian')

    expect(prompt).toContain('Write in Russian')
    expect(prompt).toContain('Important facts and constraints')
    expect(prompt).toContain('Latest interaction')
  })

  it('provides a role-play prompt focused on story continuity', () => {
    const prompt = resolveCompactionPrompt(ROLEPLAY_COMPACTION_PROMPT_ID, [], 'Russian')

    expect(prompt).toContain('Current scene')
    expect(prompt).toContain('Story chronology')
    expect(prompt).toContain('Relationships')
    expect(prompt).toContain('World, locations, and factions')
    expect(prompt).toContain('Immediate continuation')
  })

  it('selects a custom prompt and expands its language placeholder', () => {
    const prompt = resolveCompactionPrompt(
      'custom-roleplay',
      [
        {
          id: 'custom-roleplay',
          name: 'My role-play prompt',
          prompt: 'Preserve every named location. Write in {{ language }}.',
        },
      ],
      'Russian'
    )

    expect(prompt).toBe('Preserve every named location. Write in Russian.')
  })

  it('falls back to the detailed prompt when a selected custom prompt no longer exists', () => {
    const prompt = resolveCompactionPrompt('missing-prompt', [], 'English')

    expect(prompt).toContain('loss-minimizing continuity record')
    expect(prompt).toContain('Write in English')
  })

  it('appends the resolved instruction after the conversation', () => {
    const message = createMessage('user', 'The story begins in Minsk.')
    const result = summarizeConversation([message], 'Russian', 'Preserve all locations.')

    expect(result).toHaveLength(2)
    expect(result[0]).toBe(message)
    expect(result[1].role).toBe('user')
    expect(result[1].contentParts).toEqual([{ type: 'text', text: 'Preserve all locations.' }])
  })
})
