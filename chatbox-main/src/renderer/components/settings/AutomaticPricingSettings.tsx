import { Button, Checkbox, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { createModelDependencies } from '@/adapters'
import { priceSearchStore, updateConnectedPrices, usePriceSearch } from '@/packages/usage-stats/connected-pricing'
import { useSettingsStore } from '@/stores/settingsStore'

export default function AutomaticPricingSettings() {
  const { t } = useTranslation()
  const enabled = useSettingsStore((state) => state.autoOpenRouterPricing !== false)
  const setSettings = useSettingsStore((state) => state.setSettings)
  const { loading, error, result } = usePriceSearch((state) => state)
  const update = async () => {
    try {
      await updateConnectedPrices(await createModelDependencies())
    } catch {
      priceSearchStore.setState({ error: true })
    }
  }
  return (
    <Stack gap="sm">
      <Checkbox
        label={t('Automatically find prices on OpenRouter')}
        checked={enabled}
        onChange={(event) => setSettings({ autoOpenRouterPricing: event.currentTarget.checked })}
      />
      <Text size="xs" c="chatbox-tertiary">
        {t(
          'Finds prices for connected models from Google and other providers too. New models are checked automatically. Manual prices take priority.'
        )}
      </Text>
      <Button variant="light" loading={loading} onClick={update}>
        {t('Find and update prices')}
      </Button>
      {error && (
        <Text size="xs" c="chatbox-error">
          {t('Could not load OpenRouter pricing. Your saved rates have been kept.')}
        </Text>
      )}
      {result && !error && (
        <>
          <Text size="xs" c="chatbox-tertiary">
            {t('Prices found: {{matched}}. Manual prices kept: {{manual}}. Not found: {{missing}}.', {
              matched: result.matched,
              manual: result.manual,
              missing: result.missing.length,
            })}
          </Text>
          {result.missing.length > 0 && (
            <details>
              <Text component="summary" size="xs" c="chatbox-tertiary" style={{ cursor: 'pointer' }}>
                {t('Models without a matching price')}
              </Text>
              <Text size="xs" c="chatbox-tertiary" style={{ overflowWrap: 'anywhere' }}>
                {result.missing.join(' · ')}
              </Text>
            </details>
          )}
        </>
      )}
      <Text size="xs" c="chatbox-tertiary">
        {t(
          'OpenRouter prices for direct providers are reference estimates and may differ from their actual rates. Saved chat history is not repriced.'
        )}
      </Text>
    </Stack>
  )
}
