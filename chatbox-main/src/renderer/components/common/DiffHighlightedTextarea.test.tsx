// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DiffHighlightedTextarea } from './DiffHighlightedTextarea'

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe('DiffHighlightedTextarea', () => {
  it('underlines changed text while keeping plain text in the textarea', () => {
    const corrected = 'Машина была бордовая.'
    const { container } = render(
      <MantineProvider>
        <DiffHighlightedTextarea
          label="Предпросмотр результата"
          description="Описание"
          placeholder="Запустите исправление"
          originalText="Машина была бардовая."
          value={corrected}
          readOnly={false}
          showChanges
          onChange={() => undefined}
        />
      </MantineProvider>
    )

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(corrected)
    expect(Array.from(container.querySelectorAll('.underline')).map((element) => element.textContent)).toEqual([
      'бордовая',
    ])
  })

  it('returns only the edited plain text', () => {
    const onChange = vi.fn()
    render(
      <MantineProvider>
        <DiffHighlightedTextarea
          label="Предпросмотр результата"
          description="Описание"
          placeholder="Запустите исправление"
          originalText="Привет мир"
          value="Привет, мир!"
          readOnly={false}
          showChanges
          onChange={onChange}
        />
      </MantineProvider>
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Привет, новый мир!' } })
    expect(onChange).toHaveBeenCalledWith('Привет, новый мир!')
  })
})
