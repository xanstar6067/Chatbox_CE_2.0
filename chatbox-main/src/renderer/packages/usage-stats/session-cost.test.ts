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
})
