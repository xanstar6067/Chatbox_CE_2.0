// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DiffHighlightedTextarea } from './DiffHighlightedTextarea'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

afterEach(cleanup)

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

const corrected = 'Машина была бордовая.\n\nПривет, мир!\n'
const defaults = {
  label: 'Предпросмотр результата',
  description: 'Описание',
  placeholder: 'Запустите исправление',
  originalText: 'Машина была бардовая.\n\nПривет, мир!\n',
  value: corrected,
  readOnly: false,
  showChanges: true,
  onChange: () => undefined,
}

describe('DiffHighlightedTextarea', () => {
  it('decorates the visible text itself, preserving paragraphs without an overlay', () => {
    const { container } = render(
      <MantineProvider>
        <DiffHighlightedTextarea {...defaults} />
      </MantineProvider>
    )

    expect(screen.getByRole('region').textContent).toBe(corrected)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(Array.from(container.querySelectorAll('.underline')).map((element) => element.textContent)).toEqual([
      'бордовая',
    ])
    expect(container.querySelector('[aria-hidden]')).toBeNull()
  })

  it('keeps edits and applied text plain when switching back to highlighted preview', () => {
    const apply = vi.fn()
    function Harness() {
      const [value, setValue] = useState(corrected)
      return (
        <MantineProvider>
          <DiffHighlightedTextarea {...defaults} value={value} onChange={setValue} />
          <button type="button" onClick={() => apply(value)}>
            Apply
          </button>
        </MantineProvider>
      )
    }
    const { container } = render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(editor.value).toBe(corrected)
    expect(document.activeElement).toBe(editor)
    expect(screen.queryByRole('region')).toBeNull()
    const edited = 'Привет, новый мир!\n\n<u>Это текст, а не HTML</u>\n'
    fireEvent.change(editor, { target: { value: edited } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(apply).toHaveBeenLastCalledWith(edited)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('region').textContent).toBe(edited)
    expect(container.querySelector('u')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(apply).toHaveBeenLastCalledWith(edited)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(edited)
  })

  it('leaves editing when generation starts and previews the new result', () => {
    const view = (readOnly: boolean, value: string) => (
      <MantineProvider>
        <DiffHighlightedTextarea {...defaults} readOnly={readOnly} showChanges={!readOnly} value={value} />
      </MantineProvider>
    )
    const { rerender, container } = render(view(false, corrected))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    rerender(view(true, ''))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('region').textContent).toBe(defaults.placeholder)
    rerender(view(true, 'Новый текст'))
    expect(screen.getByRole('region').textContent).toBe('Новый текст')
    expect(container.querySelector('.underline')).toBeNull()
    rerender(view(false, 'Новый текст'))
    expect(screen.getByRole('region').textContent).toBe('Новый текст')
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })
})
