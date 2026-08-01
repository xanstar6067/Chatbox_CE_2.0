import type { CompactionPoint, Message, Session, SessionThreadBrief } from '@shared/types'
import { getMessageText } from '@shared/utils/message'

const TOPIC_NAME_MAX_LENGTH = 80

export type ThreadHistoryListItem = SessionThreadBrief & {
  kind: 'thread' | 'compaction'
}

function getTopicName(messages: Message[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user')
  if (!firstUserMessage) {
    return ''
  }

  const text = getMessageText(firstUserMessage).replace(/\s+/g, ' ').trim()
  if (text.length <= TOPIC_NAME_MAX_LENGTH) {
    return text
  }
  return `${text.slice(0, TOPIC_NAME_MAX_LENGTH - 3)}...`
}

function getCompactionHistoryItems(
  ownerId: string,
  messages: Message[],
  compactionPoints?: CompactionPoint[]
): ThreadHistoryListItem[] {
  if (!compactionPoints?.length || messages.length === 0) {
    return []
  }

  const messageIndexById = new Map(messages.map((message, index) => [message.id, index]))
  const validPoints = compactionPoints
    .map((point, sequence) => ({
      point,
      sequence,
      boundaryIndex: messageIndexById.get(point.boundaryMessageId),
    }))
    .filter((entry): entry is typeof entry & { boundaryIndex: number } => entry.boundaryIndex !== undefined)
    .sort(
      (a, b) => a.boundaryIndex - b.boundaryIndex || a.point.createdAt - b.point.createdAt || a.sequence - b.sequence
    )

  let previousBoundaryIndex = -1
  return validPoints.map(({ point, boundaryIndex }) => {
    const topicMessages = messages
      .slice(previousBoundaryIndex + 1, boundaryIndex + 1)
      .filter((message) => !message.isSummary)
    previousBoundaryIndex = boundaryIndex

    const firstUserMessage = topicMessages.find((message) => message.role === 'user')
    const summaryMessageExists = messageIndexById.has(point.summaryMessageId)
    const firstMessageId =
      firstUserMessage?.id ??
      topicMessages[0]?.id ??
      (summaryMessageExists ? point.summaryMessageId : point.boundaryMessageId)

    return {
      kind: 'compaction',
      id: `compaction:${ownerId}:${point.summaryMessageId}`,
      name: getTopicName(topicMessages),
      createdAt: point.createdAt,
      createdAtLabel: new Date(point.createdAt).toLocaleString(),
      firstMessageId,
      messageCount: topicMessages.length,
    }
  })
}

export function getThreadHistoryList(session: Session): ThreadHistoryListItem[] {
  const items: Array<ThreadHistoryListItem & { sequence: number }> = []
  let sequence = 0

  if (session.threads) {
    for (const thread of session.threads) {
      if (!thread.messages.length) {
        continue
      }
      items.push({
        kind: 'thread',
        id: thread.id,
        name: thread.name,
        createdAt: thread.createdAt,
        createdAtLabel: new Date(thread.createdAt).toLocaleString(),
        firstMessageId: thread.messages[0].id,
        messageCount: thread.messages.length,
        sequence: sequence++,
      })
      for (const item of getCompactionHistoryItems(thread.id, thread.messages, thread.compactionPoints)) {
        items.push({ ...item, sequence: sequence++ })
      }
    }

    if (session.messages.length > 0) {
      items.push({
        kind: 'thread',
        id: session.id,
        name: session.threadName || '',
        firstMessageId: session.messages[0].id,
        messageCount: session.messages.length,
        sequence: sequence++,
      })
    }
  }

  for (const item of getCompactionHistoryItems(session.id, session.messages, session.compactionPoints)) {
    items.push({ ...item, sequence: sequence++ })
  }

  return items
    .sort(
      (a, b) =>
        (a.createdAt ?? Number.MAX_SAFE_INTEGER) - (b.createdAt ?? Number.MAX_SAFE_INTEGER) || a.sequence - b.sequence
    )
    .map(({ sequence: _sequence, ...item }) => item)
}
