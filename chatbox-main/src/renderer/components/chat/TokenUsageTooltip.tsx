import { Box, Flex, Stack, Text } from '@mantine/core'
import type { Message } from '@shared/types'
import { useTranslation } from 'react-i18next'

export interface TokenUsageBreakdown {
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  totalTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  uncachedTokens?: number
  /** Share of input tokens read from the prompt cache (0..1); undefined when the provider reported no cache data. */
  cacheHitRatio?: number
}

export function getTokenUsageBreakdown(usage: Message['usage'], fallbackTotalTokens?: number): TokenUsageBreakdown {
  const details = usage?.inputTokenDetails
  // `cachedInputTokens` is the deprecated AI SDK field kept by messages saved before `inputTokenDetails`.
  const cacheReadTokens = details?.cacheReadTokens ?? usage?.cachedInputTokens
  const cacheWriteTokens = details?.cacheWriteTokens
  const inputTokens = usage?.inputTokens
  const hasCacheData = cacheReadTokens !== undefined || cacheWriteTokens !== undefined

  let uncachedTokens = details?.noCacheTokens
  if (uncachedTokens === undefined && hasCacheData && inputTokens !== undefined) {
    const rest = inputTokens - (cacheReadTokens ?? 0) - (cacheWriteTokens ?? 0)
    uncachedTokens = rest >= 0 ? rest : undefined
  }

  return {
    inputTokens,
    outputTokens: usage?.outputTokens,
    reasoningTokens: usage?.reasoningTokens,
    totalTokens: usage?.totalTokens || fallbackTotalTokens,
    cacheReadTokens,
    cacheWriteTokens,
    uncachedTokens,
    cacheHitRatio: hasCacheData && inputTokens ? Math.min(1, (cacheReadTokens ?? 0) / inputTokens) : undefined,
  }
}

const numberFormat = new Intl.NumberFormat()

const CACHE_SEGMENT_STYLE = {
  read: { background: 'var(--mantine-primary-color-filled)' },
  write: { background: 'var(--mantine-primary-color-filled)', opacity: 0.45 },
  rest: { background: 'currentColor', opacity: 0.2 },
} as const

const TABULAR_NUMS = { fontVariantNumeric: 'tabular-nums' } as const

function UsageRow(props: {
  label: string
  value?: number
  indent?: boolean
  strong?: boolean
  marker?: keyof typeof CACHE_SEGMENT_STYLE
}) {
  if (props.value === undefined) {
    return null
  }
  return (
    <Flex justify="space-between" align="center" gap="lg" pl={props.indent ? 12 : 0}>
      <Flex align="center" gap={6}>
        {/* Indented rows keep the marker slot so their labels stay aligned. */}
        {props.indent && (
          <Box
            w={6}
            h={6}
            style={{ ...(props.marker && CACHE_SEGMENT_STYLE[props.marker]), borderRadius: 2, flexShrink: 0 }}
          />
        )}
        <Text size="11px" c="inherit" fw={props.strong ? 600 : 400} opacity={props.indent ? 0.75 : 1}>
          {props.label}
        </Text>
      </Flex>
      <Text
        size="11px"
        c="inherit"
        fw={props.strong ? 600 : 400}
        opacity={props.indent ? 0.75 : 1}
        style={TABULAR_NUMS}
      >
        {numberFormat.format(props.value)}
      </Text>
    </Flex>
  )
}

function CacheBar({ breakdown }: { breakdown: TokenUsageBreakdown }) {
  const input = breakdown.inputTokens || 0
  const share = (value?: number) => (input > 0 && value ? `${Math.min(100, (value / input) * 100)}%` : '0%')
  return (
    <Box pos="relative" h={6} style={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box pos="absolute" inset={0} style={CACHE_SEGMENT_STYLE.rest} />
      <Flex pos="relative" h="100%">
        <Box h="100%" w={share(breakdown.cacheReadTokens)} style={CACHE_SEGMENT_STYLE.read} />
        <Box h="100%" w={share(breakdown.cacheWriteTokens)} style={CACHE_SEGMENT_STYLE.write} />
      </Flex>
    </Box>
  )
}

export function TokenUsageTooltipContent({ breakdown }: { breakdown: TokenUsageBreakdown }) {
  const { t } = useTranslation()
  const percent = breakdown.cacheHitRatio !== undefined ? Math.round(breakdown.cacheHitRatio * 100) : undefined
  const savedForNextTurn = !breakdown.cacheReadTokens && !!breakdown.cacheWriteTokens

  return (
    <Stack gap={6} miw={210} py={2}>
      <Flex justify="space-between" align="baseline" gap="lg">
        <Text size="xs" c="inherit" fw={600}>
          {t('Token usage')}
        </Text>
        {percent !== undefined && (
          <Text size="xs" c="inherit" fw={600} style={TABULAR_NUMS}>
            {t('{{percent}}% from cache', { percent })}
          </Text>
        )}
      </Flex>

      {percent !== undefined ? (
        <CacheBar breakdown={breakdown} />
      ) : (
        <Text size="11px" c="inherit" opacity={0.7} maw={240} style={{ whiteSpace: 'normal' }}>
          {t('The provider did not report prompt cache usage')}
        </Text>
      )}
      {savedForNextTurn && (
        <Text size="11px" c="inherit" opacity={0.7} maw={240} style={{ whiteSpace: 'normal' }}>
          {t('The prompt was cached for the next messages')}
        </Text>
      )}

      <Stack gap={2} mt={2}>
        <UsageRow label={t('Input tokens')} value={breakdown.inputTokens} />
        <UsageRow
          label={t('Read from cache')}
          value={breakdown.cacheReadTokens}
          indent
          marker={percent !== undefined ? 'read' : undefined}
        />
        <UsageRow label={t('Written to cache')} value={breakdown.cacheWriteTokens || undefined} indent marker="write" />
        <UsageRow label={t('Not cached')} value={breakdown.uncachedTokens} indent marker="rest" />
        <UsageRow label={t('Output tokens')} value={breakdown.outputTokens} />
        <UsageRow label={t('Reasoning tokens')} value={breakdown.reasoningTokens || undefined} indent />
        <Box my={2} h={1} style={{ background: 'currentColor', opacity: 0.2 }} />
        <UsageRow label={t('Total tokens')} value={breakdown.totalTokens} strong />
      </Stack>
    </Stack>
  )
}
