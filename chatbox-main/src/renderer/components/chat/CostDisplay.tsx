import { ActionIcon, Button, Popover, Stack, Text, UnstyledButton } from '@mantine/core'
import { formatCost, type RequestCost, summarizeCosts } from '@shared/utils/cost'
import { IconCurrencyDollar } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function CostDisplay(props: {
  costs?: RequestCost[]
  summary?: ReturnType<typeof summarizeCosts>
  chat?: boolean
  compact?: boolean
  resetAt?: number
  onReset?: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [resetting, setResetting] = useState(false)
  const [resetFailed, setResetFailed] = useState(false)
  const summary = props.summary ?? summarizeCosts(props.costs ?? [])
  const showAmount = summary.known > 0 || summary.unknown === 0
  if (summary.known === 0 && summary.unknown === 0 && props.resetAt === undefined) return null
  return (
    <Popover position="bottom" withArrow shadow="md" withinPortal>
      <Popover.Target>
        {props.compact ? (
          <ActionIcon
            className="controls shrink-0"
            variant="subtle"
            size={24}
            color="chatbox-secondary"
            aria-label={String(t(props.chat ? 'Chat cost' : 'Response cost'))}
            title={showAmount ? formatCost(summary.usd) : String(t('Cost unknown'))}
          >
            <IconCurrencyDollar strokeWidth={1.8} />
          </ActionIcon>
        ) : (
          <UnstyledButton
            className="controls"
            aria-label={t(props.chat ? 'Chat cost' : 'Response cost')}
            style={{ flexShrink: 0 }}
          >
            <Text component="span" size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {showAmount ? `${formatCost(summary.usd)}${summary.unknown ? ' +' : ''}` : t('Cost unknown')}
            </Text>
          </UnstyledButton>
        )}
      </Popover.Target>
      <Popover.Dropdown maw={300}>
        <Stack gap="xs" mah={360} style={{ overflowY: 'auto' }}>
          <Text size="sm" fw={600}>
            {t(props.chat ? 'Chat cost' : 'Response cost')}
          </Text>
          <Text size="sm">{showAmount ? formatCost(summary.usd) : t('Cost unknown')}</Text>
          <Text size="xs">{t('Priced requests: {{count}}', { count: summary.known })}</Text>
          {!!summary.unknown && (
            <Text size="xs">{t('Some requests have no price or usage data. The total is incomplete.')}</Text>
          )}
          <Text size="xs" c="dimmed">
            {t(
              'Estimated from saved token usage and prices at request time. Tools, media and provider-specific surcharges may be billed separately.'
            )}
          </Text>
          {props.chat && (
            <Text size="xs" c="dimmed">
              {t(
                'Includes saved threads and regenerated replies. Deleted messages and background requests are excluded.'
              )}
            </Text>
          )}
          {props.resetAt !== undefined && (
            <Text size="xs" c="dimmed">
              {t('Counting since {{date}}', { date: new Date(props.resetAt).toLocaleString() })}
            </Text>
          )}
          {props.chat && props.onReset && (
            <>
              <Text size="xs" c="dimmed">
                {t('Start this chat total from zero. Saved response costs and spending statistics are kept.')}
              </Text>
              <Button
                variant="outline"
                size="xs"
                loading={resetting}
                onClick={async () => {
                  setResetting(true)
                  setResetFailed(false)
                  try {
                    await props.onReset?.()
                  } catch {
                    setResetFailed(true)
                  } finally {
                    setResetting(false)
                  }
                }}
              >
                {t('Restart cost counting')}
              </Button>
              {resetFailed && (
                <Text size="xs" c="red">
                  {t('Could not reset chat cost. Please try again.')}
                </Text>
              )}
            </>
          )}
          {props.costs?.map((cost, index) => (
            <Stack key={`${cost.timestamp}-${index}`} gap={2}>
              <Text size="xs" fw={600}>
                {cost.modelId} · {cost.usd === undefined ? t('Cost unknown') : formatCost(cost.usd)}
              </Text>
              <Text size="xs" c="dimmed">
                {cost.pricing?.source === 'openrouter' ? 'OpenRouter' : cost.pricing ? t('Manual') : t('Unknown')}
                {cost.usageEstimated ? ` · ${t('Estimated tokens')}` : ''}
              </Text>
              <Text size="xs" c="dimmed">
                {t('Input tokens')}: {cost.inputTokens ?? '—'} · {cost.pricing ? `$${cost.pricing.input}/1M` : '—'}
              </Text>
              <Text size="xs" c="dimmed">
                {t('Output tokens')}: {cost.outputTokens ?? '—'} · {cost.pricing ? `$${cost.pricing.output}/1M` : '—'}
              </Text>
              {!!cost.cacheReadTokens && (
                <Text size="xs" c="dimmed">
                  {t('Read from cache')}: {cost.cacheReadTokens} ·{' '}
                  {cost.pricing?.cacheRead === undefined ? '—' : `$${cost.pricing.cacheRead}/1M`}
                </Text>
              )}
              {!!cost.cacheWriteTokens && (
                <Text size="xs" c="dimmed">
                  {t('Written to cache')}: {cost.cacheWriteTokens} ·{' '}
                  {cost.pricing?.cacheWrite === undefined ? '—' : `$${cost.pricing.cacheWrite}/1M`}
                </Text>
              )}
              {!!cost.pricing?.requestUSD && (
                <Text size="xs" c="dimmed">
                  {t('Per-request fee (USD)')}: ${cost.pricing.requestUSD}
                </Text>
              )}
            </Stack>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
