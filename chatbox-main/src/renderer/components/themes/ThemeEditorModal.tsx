import { Button, ColorInput, Divider, Flex, Radio, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import type { CustomTheme, ThemeColors, ThemeColorToken, ThemeMode } from '@shared/types'
import { type FC, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { Modal } from '@/components/layout/Overlay'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import {
  getThemeBases,
  themeAlphaTokens,
  themeTokenGroups,
  themeTokenLabels,
  withFallbackColors,
} from '@/lib/theme-presets'
import { getLogger } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'
import ThemePreview from './ThemePreview'

const log = getLogger('theme-editor')

export type ThemeEditorModalProps = {
  opened: boolean
  onClose: () => void
  /** Theme being edited; `undefined` creates a new one. */
  editing?: CustomTheme
  /** Palette the new theme starts from, see `getThemeBases`. */
  defaultBase?: string
  /** Name suggested for a new theme. */
  defaultName?: string
}

export const ThemeEditorModal: FC<ThemeEditorModalProps> = ({
  opened,
  onClose,
  editing,
  defaultBase = 'classic-light',
  defaultName = '',
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const customThemes = useSettingsStore((state) => state.customThemes)
  const setSettings = useSettingsStore((state) => state.setSettings)

  // A theme can be based on another saved theme, but never on itself.
  const bases = useMemo(
    () => getThemeBases(customThemes.filter((theme) => theme.id !== editing?.id)),
    [customThemes, editing?.id]
  )

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [mode, setMode] = useState<ThemeMode>('light')
  const [baseId, setBaseId] = useState(defaultBase)
  const [colors, setColors] = useState<ThemeColors>(() => withFallbackColors(undefined, 'light'))

  // Reset the draft every time the editor is opened.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the draft is seeded once per opening
  useEffect(() => {
    if (!opened) {
      return
    }
    setNameError('')
    if (editing) {
      setName(editing.name)
      setMode(editing.mode)
      setBaseId(editing.basedOn ?? defaultBase)
      setColors(withFallbackColors(editing.colors, editing.mode))
      return
    }
    const base = bases.find((item) => item.value === defaultBase) ?? bases[0]
    setName(defaultName)
    setMode(base.mode)
    setBaseId(base.value)
    setColors({ ...base.colors })
  }, [opened])

  const applyBase = (value: string | null) => {
    const base = bases.find((item) => item.value === value)
    if (!base) {
      return
    }
    setBaseId(base.value)
    setMode(base.mode)
    setColors({ ...base.colors })
  }

  const setToken = (token: ThemeColorToken, value: string) => {
    setColors((prev) => ({ ...prev, [token]: value }))
  }

  const onSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError(String(t('Please enter a theme name')))
      return
    }
    const nameTaken = customThemes.some(
      (theme) => theme.id !== editing?.id && theme.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (nameTaken) {
      setNameError(String(t('A theme with this name already exists')))
      return
    }

    const now = Date.now()
    if (editing) {
      setSettings({
        customThemes: customThemes.map((theme) =>
          theme.id === editing.id
            ? { ...theme, name: trimmedName, mode, colors, basedOn: baseId, updatedAt: now }
            : theme
        ),
      })
    } else {
      const created: CustomTheme = {
        id: `theme-${uuidv4()}`,
        name: trimmedName,
        mode,
        colors,
        basedOn: baseId,
        createdAt: now,
        updatedAt: now,
      }
      // a freshly created theme becomes the active one right away
      setSettings({ customThemes: [...customThemes, created], themePresetId: created.id })
    }
    log.info(
      `${editing ? 'updated' : 'created'} theme ${editing?.id ?? 'new'} mode=${mode} base=${baseId}, ${
        customThemes.length + (editing ? 0 : 1)
      } custom themes stored`
    )
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      fullScreen={isSmallScreen}
      title={editing ? t('Edit Theme') : t('New Theme')}
      transitionProps={{ transition: 'fade-up' }}
    >
      <Stack gap="md" pb="xs">
        <div className="sticky top-0 z-10 bg-chatbox-background-primary pb-xs">
          <ThemePreview colors={colors} size="md" />
        </div>

        <TextInput
          label={t('Theme name')}
          placeholder={String(t('For example: My Night'))}
          value={name}
          error={nameError || undefined}
          onChange={(e) => {
            setName(e.currentTarget.value)
            setNameError('')
          }}
        />

        <Flex gap="md" wrap="wrap" align="flex-start">
          <Select
            className="flex-1"
            miw={220}
            comboboxProps={{ withinPortal: true }}
            label={t('Base palette')}
            description={t('Picking a base replaces every color below')}
            data={bases.map((base) => ({ value: base.value, label: base.builtin ? t(base.label) : base.label }))}
            value={baseId}
            onChange={applyBase}
          />

          <Stack gap="xxs" pt={2}>
            <Text size="sm" fw={600}>
              {t('Color scheme')}
            </Text>
            <Radio.Group value={mode} onChange={(value) => setMode(value as ThemeMode)}>
              <Flex gap="md">
                <Radio label={t('Light Mode')} value="light" />
                <Radio label={t('Dark Mode')} value="dark" />
              </Flex>
            </Radio.Group>
            <Text size="xs" c="chatbox-tertiary">
              {t('Controls which built-in styles the app uses with this theme')}
            </Text>
          </Stack>
        </Flex>

        <Divider />

        {themeTokenGroups.map((group) => (
          <Stack key={group.label} gap="xs">
            <Text size="sm" fw={600}>
              {t(group.label)}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" verticalSpacing="xs">
              {group.tokens.map((token) => (
                <ColorInput
                  key={token}
                  size="xs"
                  label={t(themeTokenLabels[token])}
                  format={themeAlphaTokens.has(token) ? 'rgba' : 'hex'}
                  popoverProps={{ withinPortal: true }}
                  value={colors[token]}
                  onChange={(value) => setToken(token, value)}
                  styles={{ label: { fontWeight: 400 } }}
                />
              ))}
            </SimpleGrid>
          </Stack>
        ))}

        <Flex justify="flex-end" gap="sm" pt="xs">
          <Button variant="light" color="chatbox-gray" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSave}>{t('Save')}</Button>
        </Flex>
      </Stack>
    </Modal>
  )
}

export default ThemeEditorModal
