import { describe, expect, it } from 'vitest'
import { getCorrectionDiffParts } from './messageRefinementDiff'

function changedText(original: string, corrected: string): string[] {
  return getCorrectionDiffParts(original, corrected)
    .filter((part) => part.changed)
    .map((part) => part.value)
}

describe('messageRefinementDiff', () => {
  it('does not mark unchanged text', () => {
    expect(getCorrectionDiffParts('Текст без ошибок.', 'Текст без ошибок.')).toEqual([
      { value: 'Текст без ошибок.', changed: false },
    ])
  })

  it('marks a replaced word in the corrected text', () => {
    expect(changedText('Машина была бардовая.', 'Машина была бордовая.')).toEqual(['бордовая'])
  })

  it('marks inserted punctuation', () => {
    expect(changedText('Привет мир', 'Привет, мир!')).toEqual([',', '!'])
  })

  it('marks the visible location next to a deletion', () => {
    const parts = getCorrectionDiffParts('Это это пример.', 'Это пример.')

    expect(parts.map((part) => part.value).join('')).toBe('Это пример.')
    expect(parts.some((part) => part.changed)).toBe(true)
  })

  it('keeps every corrected character without diff markup', () => {
    const corrected = 'Рицуко сказала: «Всё хорошо».\nНовая строка.'
    expect(
      getCorrectionDiffParts('Рицко сказала все хорошо', corrected)
        .map((part) => part.value)
        .join('')
    ).toBe(corrected)
  })
})
