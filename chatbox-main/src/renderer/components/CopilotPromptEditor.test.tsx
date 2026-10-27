// @vitest-environment jsdom

import NiceModal from '@ebay/nice-modal-react'
import { MantineProvider } from '@mantine/core'
import { type CopilotDetail, createMessage, type Session } from '@shared/types'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CopilotPromptEditor } from './CopilotPromptEditor'

const { copilots, addOrUpdate } = vi.hoisted(() => ({
  copilots: [
    { id: 'first', name: 'First role', prompt: 'First instruction' },
    { id: 'second', name: 'Second role', prompt: 'Second instruction' },
  ],
  addOrUpdate: vi.fn(),
}))

vi.mock('@/hooks/useCopilots', () => ({ useMyCopilots: () => ({ copilots, addOrUpdate }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@ebay/nice-modal-react', () => ({ default: { show: vi.fn() } }))
vi.mock('./common/AdaptiveModal', () => ({
  AdaptiveModal: ({ opened, children }: { opened: boolean; children: React.ReactNode }) =>
    opened ? <section role="dialog">{children}</section> : null,
}))

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

function Harness() {
  const [session, setSession] = useState<Session>({
    id: 'test',
    name: 'Unchanged name',
    messages: [createMessage('system', copilots[0].prompt)],
    copilotId: 'first',
    copilotPromptModified: false,
  })
  const [prompt, setPrompt] = useState(copilots[0].prompt)
  return (
    <MantineProvider>
      <CopilotPromptEditor
        session={session}
        value={prompt}
        onChange={(value, state) => {
          setPrompt(value)
          setSession((session) => ({ ...session, ...state }))
        }}
      />
      <output>
        {session.copilotId}:{String(session.copilotPromptModified)}
      </output>
    </MantineProvider>
  )
}

function selectSecond() {
  fireEvent.click(screen.getByRole('textbox', { name: 'Copilot role' }))
  fireEvent.click(screen.getByRole('option', { name: 'Second role' }))
}

describe('copilot switching', () => {
  it('switches an unchanged role immediately and clears the modification flag', () => {
    render(<Harness />)
    selectSecond()
    expect((screen.getByRole('textbox', { name: 'Instruction (System Prompt)' }) as HTMLTextAreaElement).value).toBe(
      'Second instruction'
    )
    expect(screen.getByRole('status').textContent).toBe('second:false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('preserves edits on cancel and replaces them only when switching without saving', () => {
    render(<Harness />)
    const prompt = screen.getByRole('textbox', { name: 'Instruction (System Prompt)' }) as HTMLTextAreaElement
    fireEvent.change(prompt, { target: { value: 'Edited instruction' } })
    selectSecond()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(prompt.value).toBe('Edited instruction')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(prompt.value).toBe('Edited instruction')
    expect(screen.getByRole('status').textContent).toBe('first:true')
    selectSecond()
    fireEvent.click(screen.getByRole('button', { name: 'Switch without saving' }))
    expect(prompt.value).toBe('Second instruction')
    expect(screen.getByRole('status').textContent).toBe('second:false')
    expect(addOrUpdate).not.toHaveBeenCalled()
  })

  it('prefills a new independent copilot before switching and leaves the original intact', async () => {
    vi.mocked(NiceModal.show).mockResolvedValueOnce({ id: 'saved', name: 'Saved role', prompt: 'Edited instruction' })
    render(<Harness />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Instruction (System Prompt)' }), {
      target: { value: 'Edited instruction' },
    })
    selectSecond()
    fireEvent.click(screen.getByRole('button', { name: 'Save as new copilot' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('second:false'))
    const options = vi.mocked(NiceModal.show).mock.calls[0][1] as { copilot: CopilotDetail; onSave: unknown }
    expect(options.copilot.prompt).toBe('Edited instruction')
    expect(options.copilot.id).not.toBe('first')
    expect(options.onSave).toBe(addOrUpdate)
    expect(copilots[0].prompt).toBe('First instruction')
  })

  it('does not switch if the new copilot dialog is cancelled', async () => {
    vi.mocked(NiceModal.show).mockResolvedValueOnce(undefined)
    render(<Harness />)
    const prompt = screen.getByRole('textbox', { name: 'Instruction (System Prompt)' }) as HTMLTextAreaElement
    fireEvent.change(prompt, { target: { value: 'Keep this instruction' } })
    selectSecond()
    fireEvent.click(screen.getByRole('button', { name: 'Save as new copilot' }))
    await waitFor(() => expect(NiceModal.show).toHaveBeenCalled())
    expect(prompt.value).toBe('Keep this instruction')
    expect(screen.getByRole('status').textContent).toBe('first:true')
  })
})
