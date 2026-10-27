import { createMessage, type Session } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { getSessionCost } from './session-cost'

describe('session cost', () => {
  it('includes saved branches and prior attempts without counting shared messages twice', () => {
    const first = { ...createMessage('assistant', 'first'), costs: [{ modelId: 'test', timestamp: 1, usd: 0.1 }] }
    const retry = {
      ...createMessage('assistant', 'retry'),
      costs: [{ modelId: 'other', timestamp: 2, usd: 0.2 }],
      previousCosts: [{ modelId: 'test', timestamp: 0, usd: 0.05 }],
    }
    const session = {
      messages: [first],
      threads: [{ messages: [first, retry] }],
      messageForksHash: { branch: { lists: [{ messages: [first, retry] }] } },
    } as unknown as Session
    const summary = getSessionCost(session)
    expect(summary.usd).toBeCloseTo(0.35)
    expect(summary.known).toBe(3)
    expect(summary.unknown).toBe(0)
  })

  it('marks old and unpriced replies as incomplete while keeping free requests visible', () => {
    const session = {
      messages: [
        createMessage('user', 'hello'),
        createMessage('assistant', 'old'),
        { ...createMessage('assistant', ''), generating: true },
        { ...createMessage('assistant', 'unknown'), costs: [{ modelId: 'test', timestamp: 1 }] },
        { ...createMessage('assistant', 'free'), costs: [{ modelId: 'test', timestamp: 2, usd: 0 }] },
      ],
    } as Session
    expect(getSessionCost(session)).toEqual({ usd: 0, known: 1, unknown: 2 })
  })

  it('resets old costs and untracked replies across current messages, threads and forks', () => {
    const old = {
      ...createMessage('assistant', 'old'),
      timestamp: 1,
      costs: [{ modelId: 'test', timestamp: 2, usd: 1 }],
    }
    const session = {
      messages: [old, { ...createMessage('assistant', 'legacy'), timestamp: undefined }],
      threads: [{ messages: [{ ...old, id: 'thread' }] }],
      messageForksHash: { branch: { lists: [{ messages: [{ ...old, id: 'fork' }] }] } },
      costResetAt: 2,
    } as unknown as Session
    expect(getSessionCost(session)).toEqual({ usd: 0, known: 0, unknown: 0 })
    expect(session.messages[0].costs?.[0].usd).toBe(1)
  })

  it('counts new attempts on existing replies and excludes earlier attempts after repeated resets', () => {
    const session = {
      messages: [
        {
          ...createMessage('assistant', 'retry'),
          timestamp: 1,
          previousCosts: [
            { modelId: 'test', timestamp: 1, usd: 1 },
            { modelId: 'test', timestamp: 3, usd: 0.2 },
          ],
          costs: [
            { modelId: 'test', timestamp: 5, usd: 0.3 },
            { modelId: 'test', timestamp: 6 },
          ],
        },
      ],
      costResetAt: 2,
    } as Session
    expect(getSessionCost(session)).toEqual({ usd: 0.5, known: 2, unknown: 1 })
    expect(getSessionCost({ ...session, costResetAt: 4 })).toEqual({ usd: 0.3, known: 1, unknown: 1 })
    expect(getSessionCost({ ...session, costResetAt: 6 })).toEqual({ usd: 0, known: 0, unknown: 0 })
  })

  it('still marks new replies without usage as unknown after reset', () => {
    const session = {
      messages: [{ ...createMessage('assistant', 'new unknown'), timestamp: 3 }],
      costResetAt: 2,
    } as Session
    expect(getSessionCost(session)).toEqual({ usd: 0, known: 0, unknown: 1 })
  })
})
