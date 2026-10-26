import { Box, Button, Flex, Loader, SimpleGrid, Stack, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import type { SessionMeta } from '@shared/types'
import { formatCost } from '@shared/utils/cost'
import { IconChevronRight, IconCoins, IconSearch } from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import AutomaticPricingSettings from '@/components/settings/AutomaticPricingSettings'
import { daysInMonth, monthKey, previousMonthKey } from '@/packages/usage-stats/aggregate'
import {
  type ChatSpending,
  emptySpending,
  emptySpendingMonth,
  type SpendingCounters,
} from '@/packages/usage-stats/spending'
import { importSpendingHistory, refreshSpendingStats, useSpendingStats } from '@/packages/usage-stats/spending-store'
import { listAllSessionsMeta } from '@/stores/chatStore'

export const Route = createFileRoute('/settings/costs')({ component: RouteComponent })

const PRIMARY = 'var(--mantine-primary-color-filled)'

function CostAmount({ counters, large }: { counters: SpendingCounters; large?: boolean }) {
  const { t } = useTranslation()
  const unknown = counters.unknownRequests > 0
  return (
    <Text fw={large ? 700 : 600} fz={large ? 26 : 'sm'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {unknown && counters.pricedRequests === 0
        ? t('Cost unknown')
        : `${formatCost(counters.usd)}${unknown ? ' +' : ''}`}
    </Text>
  )
}

function RouteComponent() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const stats = useSpendingStats((state) => state.stats)
  const importing = useSpendingStats((state) => state.importing)
  const error = useSpendingStats((state) => state.error)
  const [now, setNow] = useState(() => new Date())
  const [selected, setSelected] = useState<'current' | 'previous'>('current')
  const [search, setSearch] = useState('')
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionsError, setSessionsError] = useState(false)

  useEffect(() => {
    void importSpendingHistory()
    const update = () => {
      setNow(new Date())
      void refreshSpendingStats()
    }
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])

  useEffect(() => {
    let active = true
    void listAllSessionsMeta()
      .then((sessions) => {
        if (active) {
          setSessions(sessions)
          setSessionsLoaded(true)
        }
      })
      .catch(() => {
        if (active) setSessionsError(true)
      })
    return () => {
      active = false
    }
  }, [])

  const number = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }),
    [i18n.language]
  )
  const currentKey = monthKey(now)
  const previousKey = previousMonthKey(now)
  const selectedKey = selected === 'current' ? currentKey : previousKey
  const month = stats?.months[selectedKey] ?? emptySpendingMonth()
  const names = useMemo(() => new Map(sessions.map((session) => [session.id, session.name])), [sessions])
  const allChats = Object.values(month.chats).filter((chat) => chat.sessionId)
  const chatName = (chat: ChatSpending) => names.get(chat.sessionId ?? '') ?? chat.name ?? t('Untitled')
  const chats = allChats
    .filter((chat) => String(chatName(chat)).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => b.usd - a.usd || b.requests - a.requests || b.lastRequestAt - a.lastRequestAt)
  const other = Object.values(month.chats).find((chat) => !chat.sessionId)

  return (
    <Stack p="md" gap="xl">
      <Stack gap={6}>
        <Flex align="center" gap="xs">
          <ScalableIcon icon={IconCoins} size={20} />
          <Title order={5}>{t('Spending Statistics')}</Title>
        </Flex>
        <Text size="xs" c="chatbox-tertiary">
          {t('Estimated spending in USD, stored only on this device.')}
        </Text>
        <Text size="xs" c="chatbox-tertiary">
          {t('Only this month and last month are kept. When a new month starts, the oldest month is deleted in full.')}
        </Text>
        {importing && (
          <Flex gap="xs" align="center">
            <Loader size={12} />
            <Text size="xs" c="chatbox-tertiary">
              {t('Importing saved chat costs…')}
            </Text>
          </Flex>
        )}
        {error && (
          <Stack gap="xs">
            <Text size="xs" c="chatbox-error">
              {t('Could not load all spending data. Please try again.')}
            </Text>
            <Button variant="light" size="xs" onClick={() => void importSpendingHistory()}>
              {t('Retry')}
            </Button>
          </Stack>
        )}
      </Stack>

      <AutomaticPricingSettings />

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        {(['current', 'previous'] as const).map((period) => {
          const key = period === 'current' ? currentKey : previousKey
          const [year, month] = key.split('-').map(Number)
          const counters = stats?.months[key]?.totals ?? emptySpending()
          return (
            <UnstyledButton
              key={period}
              onClick={() => setSelected(period)}
              p="md"
              className="rounded-lg border border-solid border-chatbox-border-primary transition-colors"
              style={
                selected === period
                  ? { borderColor: PRIMARY, background: 'var(--mantine-primary-color-light)' }
                  : undefined
              }
            >
              <Stack gap={6}>
                <Flex justify="space-between" gap="xs">
                  <Text size="sm" fw={600}>
                    {t(period === 'current' ? 'This month' : 'Last month')}
                  </Text>
                  <Text size="xs" c="chatbox-tertiary">
                    {monthFormat.format(new Date(year, month - 1, 1))}
                  </Text>
                </Flex>
                <CostAmount counters={counters} large />
                <Text size="xs" c="chatbox-tertiary">
                  {t('requests: {{value}}', { value: number.format(counters.requests) })} · {t('Tokens')}:{' '}
                  {number.format(counters.totalTokens)}
                </Text>
                {!!counters.unknownRequests && (
                  <Text size="xs" c="chatbox-tertiary">
                    {t('Without a cost estimate: {{count}}', { count: counters.unknownRequests })}
                  </Text>
                )}
              </Stack>
            </UnstyledButton>
          )
        })}
      </SimpleGrid>

      <Stack gap="sm">
        <Text fw={600}>{t('Spending by day')}</Text>
        <SpendingChart key={selectedKey} month={selectedKey} days={month.days} />
      </Stack>

      <Stack gap="sm">
        <Flex justify="space-between" align="center">
          <Text fw={600}>{t('By chat')}</Text>
          <Text size="xs" c="chatbox-tertiary">
            {allChats.length}
          </Text>
        </Flex>
        <TextInput
          aria-label={String(t('Search chats'))}
          placeholder={String(t('Search chats'))}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          leftSection={<ScalableIcon icon={IconSearch} size={16} />}
        />
        {sessionsError && (
          <Text size="xs" c="chatbox-tertiary">
            {t('Chat names could not be refreshed. Saved names are shown.')}
          </Text>
        )}
        {chats.length === 0 && (
          <Text size="sm" c="chatbox-tertiary">
            {search ? t('No matching chats') : t('No chat expenses for this month yet')}
          </Text>
        )}
        {chats.map((chat) => {
          const exists = !!chat.sessionId && names.has(chat.sessionId)
          const open = () => {
            if (exists && chat.sessionId)
              void navigate({ to: '/session/$sessionId', params: { sessionId: chat.sessionId } })
          }
          return (
            <UnstyledButton
              key={chat.sessionId}
              onClick={open}
              disabled={!exists}
              py="sm"
              className="border-0 border-b border-solid border-chatbox-border-primary"
            >
              <Flex justify="space-between" align="center" gap="sm">
                <Stack gap={3} miw={0} flex={1}>
                  <Text size="sm" fw={500} lineClamp={2}>
                    {chatName(chat)}
                  </Text>
                  <Text size="xs" c="chatbox-tertiary">
                    {t('requests: {{value}}', { value: number.format(chat.requests) })} ·{' '}
                    {number.format(chat.totalTokens)} {t('Tokens')}
                  </Text>
                  {!!chat.unknownRequests && (
                    <Text size="xs" c="chatbox-tertiary">
                      {t('Without a cost estimate: {{count}}', { count: chat.unknownRequests })}
                    </Text>
                  )}
                  {sessionsLoaded && !exists && (
                    <Text size="xs" c="chatbox-tertiary">
                      {t('Chat deleted. Its recorded spending is kept until the month expires.')}
                    </Text>
                  )}
                </Stack>
                <Stack gap={0} align="flex-end" style={{ flexShrink: 0 }}>
                  <CostAmount counters={chat} />
                  {exists && <ScalableIcon icon={IconChevronRight} size={14} />}
                </Stack>
              </Flex>
            </UnstyledButton>
          )
        })}
        {other && (
          <Box p="sm" className="rounded-lg bg-chatbox-background-secondary">
            <Flex justify="space-between" align="center" gap="sm">
              <Stack gap={2}>
                <Text size="sm">{t('Service requests and unassigned usage')}</Text>
                <Text size="xs" c="chatbox-tertiary">
                  {t('requests: {{value}}', { value: number.format(other.requests) })}
                </Text>
              </Stack>
              <CostAmount counters={other} />
            </Flex>
          </Box>
        )}
      </Stack>
      <Text size="xs" c="chatbox-tertiary">
        {!!month.totals.unknownRequests && (
          <>{t('Some requests have no price or usage data. The total is incomplete.')} </>
        )}
        {t(
          'Estimated from saved token usage and prices at request time. Tools, media and provider-specific surcharges may be billed separately.'
        )}
      </Text>
    </Stack>
  )
}

function SpendingChart({ month, days }: { month: string; days: Record<string, SpendingCounters> }) {
  const { t, i18n } = useTranslation()
  const [picked, setPicked] = useState<number | null>(null)
  const entries = Array.from({ length: daysInMonth(month) }, (_, i) => ({
    day: i + 1,
    counters: days[String(i + 1)] ?? emptySpending(),
  }))
  const max = Math.max(0.000001, ...entries.map(({ counters }) => counters.usd))
  const selected =
    picked ??
    entries.reduce<number | undefined>((last, entry) => (entry.counters.requests > 0 ? entry.day : last), undefined)
  const counters = selected ? (days[String(selected)] ?? emptySpending()) : undefined
  const [year, monthNumber] = month.split('-').map(Number)
  return (
    <Stack gap={6}>
      <Flex align="flex-end" gap={2} h={100}>
        {entries.map(({ day, counters }) => (
          <UnstyledButton
            key={day}
            aria-label={new Date(year, monthNumber - 1, day).toLocaleDateString(i18n.language)}
            onClick={() => setPicked(day)}
            onMouseEnter={() => setPicked(day)}
            h="100%"
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end' }}
          >
            <Box
              w="100%"
              h={counters.usd > 0 ? `${Math.max(3, (counters.usd / max) * 100)}%` : 3}
              style={{
                borderRadius: 2,
                background: counters.requests > 0 ? PRIMARY : 'currentColor',
                opacity: counters.requests > 0 ? (selected === day ? 1 : 0.6) : 0.12,
              }}
            />
          </UnstyledButton>
        ))}
      </Flex>
      <Flex justify="space-between">
        {[1, 10, 20, entries.length].map((day) => (
          <Text key={day} size="10px" c="chatbox-tertiary">
            {day}
          </Text>
        ))}
      </Flex>
      <Flex justify="space-between" gap="xs" align="center" mih={24}>
        <Text size="xs" c="chatbox-tertiary">
          {selected
            ? new Date(year, monthNumber - 1, selected).toLocaleDateString(i18n.language, {
                day: 'numeric',
                month: 'long',
              })
            : t('No requests yet')}
        </Text>
        {counters && <CostAmount counters={counters} />}
      </Flex>
    </Stack>
  )
}
