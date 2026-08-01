import { createMessage, type Session } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { getThreadHistoryList } from './threadHistory'

describe('getThreadHistoryList', () => {
  it('restores compacted topics when the session has no legacy threads', () => {
    const system = createMessage('system', 'System prompt')
    const user = createMessage('user', 'Remember project Orion and the Friday deadline')
    const assistant = createMessage('assistant', 'Remembered')
    const summary = createMessage('assistant', 'Conversation summary')
    summary.isSummary = true

    const session: Session = {
      id: 'session-1',
      name: 'Orion',
      messages: [system, user, assistant, summary],
      compactionPoints: [
        {
          summaryMessageId: summary.id,
          boundaryMessageId: assistant.id,
          createdAt: 1_700_000_000_000,
        },
      ],
    }

    const result = getThreadHistoryList(session)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: 'compaction',
      name: 'Remember project Orion and the Friday deadline',
      firstMessageId: user.id,
      messageCount: 3,
      createdAt: 1_700_000_000_000,
    })
  })

  it('keeps every compaction point even when several use the same boundary', () => {
    const system = createMessage('system', 'System prompt')
    const firstSummary = createMessage('assistant', 'First summary')
    firstSummary.isSummary = true
    const secondSummary = createMessage('assistant', 'Second summary')
    secondSummary.isSummary = true

    const session: Session = {
      id: 'session-1',
      name: 'Repeated compaction',
      messages: [system, firstSummary, secondSummary],
      compactionPoints: [
        {
          summaryMessageId: firstSummary.id,
          boundaryMessageId: system.id,
          createdAt: 100,
        },
        {
          summaryMessageId: secondSummary.id,
          boundaryMessageId: system.id,
          createdAt: 200,
        },
      ],
    }

    const result = getThreadHistoryList(session)

    expect(result).toHaveLength(2)
    expect(result.map((item) => item.id)).toEqual([
      `compaction:session-1:${firstSummary.id}`,
      `compaction:session-1:${secondSummary.id}`,
    ])
    expect(result.map((item) => item.messageCount)).toEqual([1, 0])
  })

  it('preserves legacy thread entries and their actions', () => {
    const archivedMessage = createMessage('user', 'Archived topic')
    const currentMessage = createMessage('system', 'Current topic')
    const session: Session = {
      id: 'session-1',
      name: 'Conversation',
      messages: [currentMessage],
      threads: [
        {
          id: 'thread-1',
          name: 'Archived',
          messages: [archivedMessage],
          createdAt: 100,
        },
      ],
    }

    const result = getThreadHistoryList(session)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ kind: 'thread', id: 'thread-1', name: 'Archived' })
    expect(result[1]).toMatchObject({ kind: 'thread', id: 'session-1' })
  })
})
