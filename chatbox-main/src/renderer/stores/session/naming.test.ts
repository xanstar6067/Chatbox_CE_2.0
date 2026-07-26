import type { Session } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }))

vi.mock('../chatStore', () => ({ updateSession }))
vi.mock('@/adapters', () => ({ createModel: vi.fn() }))
vi.mock('@/packages/model-calls', () => ({ generateText: vi.fn() }))
vi.mock('@/packages/prompts', () => ({ nameConversation: vi.fn() }))
vi.mock('../settingsStore', () => ({
  settingsStore: { getState: vi.fn() },
}))

import { modifyNameAndThreadName } from './naming'

describe('modifyNameAndThreadName', () => {
  beforeEach(() => {
    updateSession.mockReset()
  })

  it('automatically names an untouched new conversation', async () => {
    updateSession.mockImplementation(async (_sessionId, updater) => updater({ name: 'Untitled' } as Session))

    await modifyNameAndThreadName('session-1', 'Generated title')

    expect(updateSession).toHaveBeenCalledWith('session-1', expect.any(Function))
    await expect(updateSession.mock.results[0].value).resolves.toEqual({
      name: 'Generated title',
      threadName: 'Generated title',
    })
  })

  it('does not overwrite a title changed by the user while generation was running', async () => {
    updateSession.mockImplementation(async (_sessionId, updater) => updater({ name: 'My title' } as Session))

    await modifyNameAndThreadName('session-1', 'Generated title')

    await expect(updateSession.mock.results[0].value).resolves.toEqual({ name: 'My title' })
  })
})
