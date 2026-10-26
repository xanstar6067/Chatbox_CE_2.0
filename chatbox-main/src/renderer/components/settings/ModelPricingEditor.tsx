import { Button, Checkbox, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import type { ModelPricing } from '@shared/utils/cost'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createModelDependencies } from '@/adapters'
import { getOpenRouterPricing } from '@/packages/usage-stats/pricing'

export default function ModelPricingEditor(props: {
  modelId: string
  providerId?: string
  value?: ModelPricing
  onChange: (value?: ModelPricing) => void
}) {
  const { t } = useTranslation()
  const [openRouterId, setOpenRouterId] = useState(props.value?.modelId ?? props.modelId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const updateRate = (key: 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'requestUSD', value: string | number) => {
    if (!props.value) return
    props.onChange({
      ...props.value,
      [key]: typeof value === 'number' ? value : key === 'input' || key === 'output' ? 0 : undefined,
      source: 'manual',
      updatedAt: Date.now(),
    })
  }
  const importPricing = async () => {
    setLoading(true)
    setError(undefined)
    try {
      const pricing = await getOpenRouterPricing(
        openRouterId.trim() || props.modelId,
        await createModelDependencies(),
        true,
        props.providerId ?? 'custom'
      )
      if (!pricing) {
        setError(String(t('No OpenRouter pricing found. Enter the exact OpenRouter model ID.')))
      } else {
        props.onChange(pricing)
        setOpenRouterId(pricing.modelId ?? openRouterId)
      }
    } catch {
      setError(String(t('Could not load OpenRouter pricing. Your saved rates have been kept.')))
    } finally {
      setLoading(false)
    }
  }
  return (
    <Stack gap="xs">
      <Text fw={600}>{t('Model pricing')}</Text>
      <Text size="xs" c="dimmed">
        {t('USD per 1M tokens. Estimates exclude tools, media and provider-specific surcharges.')}
      </Text>
      <Checkbox
        label={t('Set token prices')}
        checked={!!props.value}
        onChange={(event) =>
          props.onChange(
            event.currentTarget.checked ? { input: 0, output: 0, source: 'manual', updatedAt: Date.now() } : undefined
          )
        }
      />
      {props.value && (
        <>
          <Group grow align="start">
            <NumberInput
              label={t('Input price')}
              min={0}
              value={props.value.input}
              onChange={(value) => updateRate('input', value)}
            />
            <NumberInput
              label={t('Output price')}
              min={0}
              value={props.value.output}
              onChange={(value) => updateRate('output', value)}
            />
          </Group>
          <Group grow align="start">
            <NumberInput
              label={t('Cache read price')}
              placeholder={String(t('Unknown'))}
              min={0}
              value={props.value.cacheRead ?? ''}
              onChange={(value) => updateRate('cacheRead', value)}
            />
            <NumberInput
              label={t('Cache write price')}
              placeholder={String(t('Unknown'))}
              min={0}
              value={props.value.cacheWrite ?? ''}
              onChange={(value) => updateRate('cacheWrite', value)}
            />
          </Group>
          <NumberInput
            label={t('Per-request fee (USD)')}
            min={0}
            value={props.value.requestUSD ?? ''}
            onChange={(value) => updateRate('requestUSD', value)}
          />
          <Text size="xs" c="dimmed">
            {t('Price source')}: {props.value.source === 'openrouter' ? 'OpenRouter' : t('Manual')} ·{' '}
            {new Date(props.value.updatedAt).toLocaleDateString()}
          </Text>
        </>
      )}
      <TextInput
        label={t('OpenRouter model ID')}
        description={t(
          'OpenRouter uses IDs like google/gemini-3.8-flash. Native provider IDs are matched automatically and kept unchanged.'
        )}
        placeholder={props.modelId || 'provider/model'}
        value={openRouterId}
        onChange={(event) => setOpenRouterId(event.currentTarget.value)}
      />
      <Button
        variant="light"
        loading={loading}
        disabled={!openRouterId.trim() && !props.modelId}
        onClick={importPricing}
      >
        {t('Load prices from OpenRouter')}
      </Button>
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {t(
          'Automatic lookup for connected providers is controlled in Spending Statistics. Manual prices take priority.'
        )}
      </Text>
    </Stack>
  )
}
