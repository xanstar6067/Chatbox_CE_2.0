export interface CorrectionDiffPart {
  value: string
  changed: boolean
}

type DiffOperation = {
  type: 'equal' | 'insert' | 'delete'
  value: string
}

const MAX_PRECISE_DIFF_TOKENS = 4000

function tokenize(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{M}\p{N}_]+|[^\s]/gu) ?? []
}

function getMapValue(map: Map<number, number>, key: number): number {
  return map.get(key) ?? Number.NEGATIVE_INFINITY
}

function backtrackDiff(trace: Map<number, number>[], original: string[], corrected: string[]): DiffOperation[] {
  let x = original.length
  let y = corrected.length
  const operations: DiffOperation[] = []

  for (let distance = trace.length - 1; distance >= 0; distance--) {
    const frontier = trace[distance]
    const diagonal = x - y
    const previousDiagonal =
      diagonal === -distance ||
      (diagonal !== distance && getMapValue(frontier, diagonal - 1) < getMapValue(frontier, diagonal + 1))
        ? diagonal + 1
        : diagonal - 1
    const previousX = frontier.get(previousDiagonal) ?? 0
    const previousY = previousX - previousDiagonal

    while (x > previousX && y > previousY) {
      operations.push({ type: 'equal', value: corrected[y - 1] })
      x -= 1
      y -= 1
    }

    if (distance === 0) break

    if (x === previousX) {
      operations.push({ type: 'insert', value: corrected[y - 1] })
      y -= 1
    } else {
      operations.push({ type: 'delete', value: original[x - 1] })
      x -= 1
    }
  }

  return operations.reverse()
}

function calculateTokenDiff(original: string[], corrected: string[]): DiffOperation[] {
  const maximumDistance = original.length + corrected.length
  const frontier = new Map<number, number>([[1, 0]])
  const trace: Map<number, number>[] = []

  for (let distance = 0; distance <= maximumDistance; distance++) {
    trace.push(new Map(frontier))

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let x =
        diagonal === -distance ||
        (diagonal !== distance && getMapValue(frontier, diagonal - 1) < getMapValue(frontier, diagonal + 1))
          ? (frontier.get(diagonal + 1) ?? 0)
          : (frontier.get(diagonal - 1) ?? 0) + 1
      let y = x - diagonal

      while (x < original.length && y < corrected.length && original[x] === corrected[y]) {
        x += 1
        y += 1
      }
      frontier.set(diagonal, x)

      if (x >= original.length && y >= corrected.length) {
        return backtrackDiff(trace, original, corrected)
      }
    }
  }

  return []
}

function mergeParts(parts: CorrectionDiffPart[]): CorrectionDiffPart[] {
  const merged: CorrectionDiffPart[] = []
  for (const part of parts) {
    const previous = merged.at(-1)
    if (previous?.changed === part.changed) {
      previous.value += part.value
    } else if (part.value) {
      merged.push({ ...part })
    }
  }
  return merged
}

function fallbackDiff(original: string, corrected: string): CorrectionDiffPart[] {
  let prefixLength = 0
  const sharedLength = Math.min(original.length, corrected.length)
  while (prefixLength < sharedLength && original[prefixLength] === corrected[prefixLength]) {
    prefixLength += 1
  }

  let suffixLength = 0
  while (
    suffixLength < sharedLength - prefixLength &&
    original[original.length - suffixLength - 1] === corrected[corrected.length - suffixLength - 1]
  ) {
    suffixLength += 1
  }

  return mergeParts([
    { value: corrected.slice(0, prefixLength), changed: false },
    { value: corrected.slice(prefixLength, corrected.length - suffixLength), changed: true },
    { value: suffixLength ? corrected.slice(-suffixLength) : '', changed: false },
  ])
}

export function getCorrectionDiffParts(original: string, corrected: string): CorrectionDiffPart[] {
  if (!corrected) return []
  if (original === corrected) return [{ value: corrected, changed: false }]

  const originalTokens = tokenize(original)
  const correctedTokens = tokenize(corrected)
  if (originalTokens.length + correctedTokens.length > MAX_PRECISE_DIFF_TOKENS) {
    return fallbackDiff(original, corrected)
  }

  const operations = calculateTokenDiff(originalTokens, correctedTokens)
  const parts: CorrectionDiffPart[] = []
  let hasPendingDeletion = false

  for (const operation of operations) {
    if (operation.type === 'delete') {
      hasPendingDeletion = true
      continue
    }

    parts.push({
      value: operation.value,
      changed: operation.type === 'insert' || hasPendingDeletion,
    })
    hasPendingDeletion = false
  }

  if (hasPendingDeletion && parts.length > 0) {
    parts[parts.length - 1].changed = true
  }

  return mergeParts(parts)
}
