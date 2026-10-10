import {
  Box,
  Button,
  Flex,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { SystemProviders } from '@shared/defaults'
import { IconMessages, IconSettingsAutomation } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Divider } from '@/components/common/Divider'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import {
  cacheShare,
  importUsageHistory,
  monthKey,
  previousMonthKey,
  resetUsageStats,
  summarizeMonth,
  type UsageCounters,
  type UsageMonthSummary,
  useUsageStats,
} from '@/packages/usage-stats'
import { useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/usage')({
  component: RouteComponent,
})

type Metric = 'tokens' | 'requests'

const PRIMARY = 'var(--mantine-primary-color-filled)'

function useFormatters() {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const full = new Intl.NumberFormat(i18n.language)
    const compact = new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 })
    const month = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' })
    const day = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' })
    return {
      full: (value: number) => full.format(value),
      compact: (value: number) => compact.format(value),
      percent: (ratio: number) => `${Math.round(ratio * 100)}%`,
      month: (key: string) => {
        const [year, monthNumber] = key.split('-').map(Number)
        const label = month.format(new Date(year, monthNumber - 1, 1))
        return label.charAt(0).toUpperCase() + label.slice(1)
      },
      day: (key: string, dayNumber: number) => {
        const [year, monthNumber] = key.split('-').map(Number)
        return day.format(new Date(year, monthNumber - 1, dayNumber))
      },
    }
  }, [i18n.language])
}

function useProviderNames() {
  const customProviders = useSettingsStore((state) => state.customProviders)
  return useMemo(() => {
    const names = new Map<string, string>()
    for (const provider of [...SystemProviders(), ...(customProviders || [])]) {
      names.set(provider.id, provider.name)
    }
    return (id: string) => names.get(id) || id
  }, [customProviders])
}

export function RouteComponent() {
  const { t } = useTranslation()
  const format = useFormatters()
  const stats = useUsageStats((state) => state.stats)
  const importing = useUsageStats((state) => state.importing)
  const [selected, setSelected] = useState<'current' | 'previous'>('current')
  const [metric, setMetric] = useState<Metric>('tokens')

  useEffect(() => {
    void importUsageHistory()
  }, [])

  const now = new Date()
  const currentKey = monthKey(now)
  const previousKey = previousMonthKey(now)
  const current = useMemo(() => summarizeMonth(currentKey, stats?.months[currentKey]), [stats, currentKey])
  const previous = useMemo(() => summarizeMonth(previousKey, stats?.months[previousKey]), [stats, previousKey])
  const summary = selected === 'current' ? current : previous
  // The current month is still running, so compare it with the same days of the previous month.
  const previousSamePeriodTokens = previous.byDay
    .slice(0, now.getDate())
    .reduce((sum, counters) => sum + counters.totalTokens, 0)

  return (
    <Stack gap="xxl" p="md">
      <Stack gap="xxs">
        <Title order={5}>{t('Usage Statistics')}</Title>
        <Text size="xs" c="chatbox-tertiary">
          {t('Requests and tokens for the current and previous month. The data is stored only on this device.')}
        </Text>
        {importing && (
          <Flex align="center" gap="xs">
            <Loader size={12} />
            <Text size="xs" c="chatbox-tertiary">
              {t('Importing usage from chat history…')}
            </Text>
          </Flex>
        )}
      </Stack>

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <MonthCard
          title={t('This month')}
          month={format.month(currentKey)}
          summary={current}
          comparison={{ current: current.totals.totalTokens, previous: previousSamePeriodTokens }}
          active={selected === 'current'}
          onClick={() => setSelected('current')}
        />
        <MonthCard
          title={t('Last month')}
          month={format.month(previousKey)}
          summary={previous}
          active={selected === 'previous'}
          onClick={() => setSelected('previous')}
        />
      </SimpleGrid>

      <Stack gap="sm">
        <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
          <Text fw={600}>{t('By day')}</Text>
          <SegmentedControl
            size="xs"
            value={metric}
            onChange={(value) => setMetric(value as Metric)}
            data={[
              { value: 'tokens', label: t('Tokens') },
              { value: 'requests', label: t('Requests') },
            ]}
          />
        </Flex>
        <DailyChart key={summary.month} summary={summary} metric={metric} isCurrentMonth={selected === 'current'} />
      </Stack>

      <Stack gap="sm">
        <Text fw={600}>{t('Request types')}</Text>
        <PurposeRow
          icon={<ScalableIcon icon={IconMessages} size={18} />}
          title={t('Chat replies')}
          counters={summary.byPurpose.chat}
          total={summary.totals}
        />
        <PurposeRow
          icon={<ScalableIcon icon={IconSettingsAutomation} size={18} />}
          title={t('Service requests')}
          description={t('Chat titles, context compaction, search queries, model tests and similar') as string}
          counters={summary.byPurpose.other}
          total={summary.totals}
        />
      </Stack>

      <ModelBreakdown summary={summary} />

      <Divider />

      <ResetButton />
    </Stack>
  )
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const { t } = useTranslation()
  if (previous <= 0) {
    return null
  }
  const change = (current - previous) / previous
  const sign = change > 0 ? '+' : ''
  return (
    <Text size="xs" c="chatbox-tertiary">
      {t('{{change}} vs the same days last month', { change: `${sign}${Math.round(change * 100)}%` })}
    </Text>
  )
}

function MonthCard(props: {
  title: string
  month: string
  summary: UsageMonthSummary
  comparison?: { current: number; previous: number }
  active: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { totals } = props.summary
  return (
    <UnstyledButton
      onClick={props.onClick}
      p="md"
      className="rounded-lg border border-solid border-chatbox-border-primary transition-colors"
      style={props.active ? { borderColor: PRIMARY, background: 'var(--mantine-primary-color-light)' } : undefined}
    >
      <Stack gap={6}>
        <Flex justify="space-between" align="baseline" gap="xs">
          <Text size="sm" fw={600}>
            {props.title}
          </Text>
          <Text size="xs" c="chatbox-tertiary">
            {props.month}
          </Text>
        </Flex>
        <Flex align="baseline" gap={6}>
          <Text fz={26} fw={700} lh={1.1} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {format.compact(totals.totalTokens)}
          </Text>
          <Text size="sm" c="chatbox-secondary">
            {t('tokens used')}
          </Text>
        </Flex>
        {props.comparison && <Delta current={props.comparison.current} previous={props.comparison.previous} />}
        <Flex gap="lg" mt={4}>
          <Stat label={t('Requests')} value={format.full(totals.requests)} />
          <Stat label={t('From cache')} value={format.percent(cacheShare(totals))} />
          <Stat label={t('Output')} value={format.compact(totals.outputTokens)} />
        </Flex>
      </Stack>
    </UnstyledButton>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
      <Text size="xs" c="chatbox-tertiary">
        {label}
      </Text>
    </Stack>
  )
}

function DailyChart(props: { summary: UsageMonthSummary; metric: Metric; isCurrentMonth: boolean }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { byDay, month } = props.summary
  const today = new Date().getDate()
  const lastDayWithData = byDay.reduce((last, counters, index) => (counters.requests > 0 ? index : last), -1)
  const [pickedDay, setSelectedDay] = useState<number | null>(null)
  // Until a day is picked, follow the latest day with data (it can appear after the history import).
  const selectedDay = pickedDay ?? (lastDayWithData >= 0 ? lastDayWithData : null)
  const value = (counters: UsageCounters) => (props.metric === 'tokens' ? counters.totalTokens : counters.requests)
  const max = Math.max(1, ...byDay.map(value))
  const selected = selectedDay === null ? null : byDay[selectedDay]

  return (
    <Stack gap={6}>
      <Flex align="flex-end" gap={2} h={120}>
        {byDay.map((counters, index) => {
          const isFuture = props.isCurrentMonth && index + 1 > today
          const height = value(counters) > 0 ? Math.max(3, (value(counters) / max) * 100) : 0
          const cachedPart =
            props.metric === 'tokens' && counters.totalTokens > 0 ? counters.cacheReadTokens / counters.totalTokens : 0
          return (
            <UnstyledButton
              // biome-ignore lint/suspicious/noArrayIndexKey: days are a fixed positional list
              key={index}
              aria-label={format.day(month, index + 1)}
              onClick={() => setSelectedDay(index)}
              onMouseEnter={() => setSelectedDay(index)}
              h="100%"
              style={{ flex: 1, display: 'flex', alignItems: 'flex-end', minWidth: 0 }}
            >
              <Box
                w="100%"
                h={height > 0 ? `${height}%` : 2}
                style={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  background: height > 0 ? PRIMARY : 'currentColor',
                  opacity: height > 0 ? (selectedDay === index ? 1 : 0.8) : isFuture ? 0.05 : 0.15,
                  outline: selectedDay === index ? `1px solid ${PRIMARY}` : undefined,
                  outlineOffset: 1,
                }}
              >
                {cachedPart > 0 && (
                  <Box
                    mt="auto"
                    h={`${cachedPart * 100}%`}
                    style={{ background: 'var(--mantine-color-white)', opacity: 0.35 }}
                  />
                )}
              </Box>
            </UnstyledButton>
          )
        })}
      </Flex>
      <Flex justify="space-between">
        {[1, 10, 20, byDay.length].map((day) => (
          <Text key={day} size="10px" c="chatbox-tertiary">
            {day}
          </Text>
        ))}
      </Flex>
      <Text size="xs" c="chatbox-secondary" mih={18}>
        {selected && selectedDay !== null
          ? t('{{day}} · requests: {{requests}} · tokens: {{tokens}} · from cache: {{cache}}', {
              day: format.day(month, selectedDay + 1),
              requests: format.full(selected.requests),
              tokens: format.full(selected.totalTokens),
              cache: format.percent(cacheShare(selected)),
            })
          : t('No requests yet')}
      </Text>
      {props.metric === 'tokens' && (
        <Flex align="center" gap="md">
          <Legend color={PRIMARY} label={t('Tokens')} />
          <Legend color={PRIMARY} light label={t('Read from cache')} />
        </Flex>
      )}
    </Stack>
  )
}

function Legend({ color, light, label }: { color: string; light?: boolean; label: string }) {
  return (
    <Flex align="center" gap={6}>
      <Box w={8} h={8} pos="relative" style={{ borderRadius: 2, background: color, overflow: 'hidden' }}>
        {light && <Box pos="absolute" inset={0} style={{ background: 'var(--mantine-color-white)', opacity: 0.35 }} />}
      </Box>
      <Text size="xs" c="chatbox-tertiary">
        {label}
      </Text>
    </Flex>
  )
}

function ShareBar({ ratio }: { ratio: number }) {
  return (
    <Box h={4} pos="relative" style={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box pos="absolute" inset={0} style={{ background: 'currentColor', opacity: 0.12 }} />
      <Box pos="relative" h="100%" w={`${Math.min(100, ratio * 100)}%`} style={{ background: PRIMARY }} />
    </Box>
  )
}

function PurposeRow(props: {
  icon: ReactNode
  title: string
  description?: string
  counters: UsageCounters
  total: UsageCounters
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const share = props.total.totalTokens > 0 ? props.counters.totalTokens / props.total.totalTokens : 0
  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="flex-start" gap="md">
        <Flex gap="xs" align="flex-start" miw={0}>
          <Box c="chatbox-secondary" mt={2}>
            {props.icon}
          </Box>
          <Stack gap={0} miw={0}>
            <Text size="sm">{props.title}</Text>
            {props.description && (
              <Text size="xs" c="chatbox-tertiary">
                {props.description}
              </Text>
            )}
          </Stack>
        </Flex>
        <Stack gap={0} align="flex-end" style={{ flexShrink: 0 }}>
          <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {format.compact(props.counters.totalTokens)}
          </Text>
          <Text size="xs" c="chatbox-tertiary">
            {t('requests: {{value}}', { value: format.full(props.counters.requests) })}
          </Text>
        </Stack>
      </Flex>
      <ShareBar ratio={share} />
    </Stack>
  )
}

function ModelBreakdown({ summary }: { summary: UsageMonthSummary }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const providerName = useProviderNames()
  const top = summary.byModel[0]?.totalTokens || 1

  return (
    <Stack gap="sm">
      <Text fw={600}>{t('By provider and model')}</Text>
      {summary.byModel.length === 0 ? (
        <Text size="sm" c="chatbox-tertiary">
          {t('No requests yet')}
        </Text>
      ) : (
        summary.byModel.map((row) => (
          <Stack key={`${row.provider}|${row.model}`} gap={6}>
            <Flex justify="space-between" align="flex-start" gap="md">
              <Stack gap={0} miw={0}>
                <Text size="sm" fw={500} className="break-words">
                  {row.model}
                </Text>
                <Text size="xs" c="chatbox-tertiary">
                  {providerName(row.provider)}
                </Text>
              </Stack>
              <Stack gap={0} align="flex-end" style={{ flexShrink: 0 }}>
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {format.compact(row.totalTokens)}
                </Text>
                <Text size="xs" c="chatbox-tertiary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t('requests: {{requests}} · cache: {{cache}}', {
                    requests: format.full(row.requests),
                    cache: format.percent(cacheShare(row)),
                  })}
                </Text>
              </Stack>
            </Flex>
            <ShareBar ratio={row.totalTokens / top} />
          </Stack>
        ))
      )}
    </Stack>
  )
}

function ResetButton() {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])

  return (
    <Flex>
      <Button
        variant={confirming ? 'filled' : 'light'}
        color={confirming ? 'chatbox-error' : 'chatbox-gray'}
        size="xs"
        onClick={() => {
          if (confirming) {
            void resetUsageStats()
            setConfirming(false)
          } else {
            setConfirming(true)
          }
        }}
      >
        {confirming ? t('Tap again to clear the statistics') : t('Clear statistics')}
      </Button>
    </Flex>
  )
}
