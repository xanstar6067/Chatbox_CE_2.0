import type { Session } from '@shared/types'
import { type RequestCost, summarizeCosts } from '@shared/utils/cost'

/** Include saved threads and regenerated branches; a message may occur in several lists. */
export function getSessionCost(session: Session) {
  const messages = [
    ...session.messages,
    ...(session.threads ?? []).flatMap((thread) => thread.messages),
    ...Object.values(session.messageForksHash ?? {}).flatMap((fork) => fork.lists.flatMap((list) => list.messages)),
  ]
  const seen = new Set<string>()
  const costs: RequestCost[] = []
  let untracked = 0
  const resetAt = session.costResetAt
  for (const message of messages) {
    if (message.role !== 'assistant' || seen.has(message.id)) continue
    seen.add(message.id)
    costs.push(
      ...[...(message.costs ?? []), ...(message.previousCosts ?? [])].filter(
        (cost) => resetAt === undefined || cost.timestamp > resetAt
      )
    )
    if (
      !message.generating &&
      !message.costs?.length &&
      (resetAt === undefined || (message.timestamp ?? 0) > resetAt)
    ) {
      untracked++
    }
  }
  const summary = summarizeCosts(costs)
  return { ...summary, unknown: summary.unknown + untracked }
}
