import { ActionIcon, Badge, Box, Button, Flex, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { CLASSIC_THEME_ID, type CustomTheme, Theme } from '@shared/types'
import { IconCheck, IconCopy, IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import clsx from 'clsx'
import { type FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ActionMenu, { type ActionMenuItemProps } from '@/components/ActionMenu'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import ThemeEditorModal from '@/components/themes/ThemeEditorModal'
import ThemePreview from '@/components/themes/ThemePreview'
import { type AppTheme, getAllThemes, resolveThemeColors } from '@/lib/theme-presets'
import { getLogger } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'

const log = getLogger('themes-settings')

export const Route = createFileRoute('/settings/themes')({
  component: RouteComponent,
})

type EditorState =
  | { opened: false }
  | { opened: true; editing?: CustomTheme; defaultBase?: string; defaultName?: string }

export function RouteComponent() {
  const { t } = useTranslation()
  const themePresetId = useSettingsStore((state) => state.themePresetId)
  const customThemes = useSettingsStore((state) => state.customThemes)
  const appTheme = useSettingsStore((state) => state.theme)
  const setSettings = useSettingsStore((state) => state.setSettings)
  const realTheme = useUIStore((state) => state.realTheme)

  const [editor, setEditor] = useState<EditorState>({ opened: false })

  const themes = useMemo(() => getAllThemes(customThemes), [customThemes])
  const activeId = themes.some((theme) => theme.id === themePresetId) ? themePresetId : CLASSIC_THEME_ID

  const selectTheme = (id: string) => {
    log.info(`selected theme ${id}`)
    setSettings({ themePresetId: id })
  }

  const deleteTheme = (id: string) => {
    log.info(`deleted theme ${id}${activeId === id ? ', reverting to the classic theme' : ''}`)
    setSettings({
      customThemes: customThemes.filter((theme) => theme.id !== id),
      ...(activeId === id ? { themePresetId: CLASSIC_THEME_ID } : {}),
    })
  }

  /** Palette a copy of the given theme should start from. */
  const baseOf = (theme: AppTheme) => {
    if (!theme.builtin) {
      return theme.id
    }
    if (theme.id === CLASSIC_THEME_ID) {
      return realTheme === 'dark' ? 'classic-dark' : 'classic-light'
    }
    return theme.id
  }

  const duplicateTheme = (theme: AppTheme) => {
    const name = theme.builtin ? t(theme.name) : theme.name
    setEditor({ opened: true, defaultBase: baseOf(theme), defaultName: String(t('{{name}} (copy)', { name })) })
  }

  return (
    <Stack p="md" gap="lg">
      <Flex gap="md" align="flex-start" wrap="wrap">
        <Stack gap="xxs" flex={1} miw={220}>
          <Title order={5}>{t('Appearance Themes')}</Title>
          <Text c="chatbox-tertiary">{t('Choose a color theme for the whole app, or design your own.')}</Text>
        </Stack>
        <Button
          leftSection={<ScalableIcon icon={IconPlus} size={16} />}
          onClick={() =>
            setEditor({ opened: true, defaultBase: realTheme === 'dark' ? 'classic-dark' : 'classic-light' })
          }
        >
          {t('Create Theme')}
        </Button>
      </Flex>

      {activeId === CLASSIC_THEME_ID && (
        <AdaptiveSelect
          maw={320}
          comboboxProps={{ withinPortal: true, withArrow: true }}
          label={t('Theme')}
          description={t('The Classic theme follows this setting')}
          styles={{ label: { fontWeight: 400 } }}
          data={[
            { value: `${Theme.System}`, label: t('Follow System') },
            { value: `${Theme.Light}`, label: t('Light Mode') },
            { value: `${Theme.Dark}`, label: t('Dark Mode') },
          ]}
          value={`${appTheme}`}
          onChange={(value) => {
            if (value) {
              setSettings({ theme: parseInt(value) })
            }
          }}
        />
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            active={theme.id === activeId}
            realTheme={realTheme}
            onSelect={() => selectTheme(theme.id)}
            onEdit={
              theme.builtin
                ? undefined
                : () => {
                    const editing = customThemes.find((item) => item.id === theme.id)
                    if (editing) {
                      setEditor({ opened: true, editing })
                    }
                  }
            }
            onDuplicate={() => duplicateTheme(theme)}
            onDelete={theme.builtin ? undefined : () => deleteTheme(theme.id)}
          />
        ))}
      </SimpleGrid>

      <ThemeEditorModal
        opened={editor.opened}
        onClose={() => setEditor({ opened: false })}
        editing={editor.opened ? editor.editing : undefined}
        defaultBase={editor.opened ? editor.defaultBase : undefined}
        defaultName={editor.opened ? editor.defaultName : undefined}
      />
    </Stack>
  )
}

const ThemeCard: FC<{
  theme: AppTheme
  active: boolean
  realTheme: 'light' | 'dark'
  onSelect: () => void
  onEdit?: () => void
  onDuplicate: () => void
  onDelete?: () => void
}> = ({ theme, active, realTheme, onSelect, onEdit, onDuplicate, onDelete }) => {
  const { t } = useTranslation()
  const colors = useMemo(() => resolveThemeColors(theme, realTheme), [theme, realTheme])

  const menuItems: ActionMenuItemProps[] = [
    ...(onEdit ? [{ text: t('Edit'), icon: IconPencil, onClick: onEdit }] : []),
    { text: t('Duplicate'), icon: IconCopy, onClick: onDuplicate },
    ...(onDelete
      ? ([
          { divider: true },
          { text: t('Delete'), icon: IconTrash, color: 'chatbox-error', doubleCheck: true, onClick: onDelete },
        ] as ActionMenuItemProps[])
      : []),
  ]

  return (
    <Paper
      shadow="xs"
      radius="md"
      withBorder
      p="sm"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={clsx(
        'cursor-pointer select-none transition-all duration-150 hover:shadow-md',
        active ? '!border-chatbox-border-brand' : ''
      )}
    >
      <ThemePreview colors={colors} />

      <Flex mt="xs" gap="xs" align="flex-start">
        <Box flex={1} miw={0}>
          <Flex gap="xxs" align="center">
            <Text size="sm" fw={600} lineClamp={1}>
              {theme.builtin ? t(theme.name) : theme.name}
            </Text>
            {active && <ScalableIcon icon={IconCheck} size={16} className="!text-chatbox-tint-brand" />}
          </Flex>
          <Text size="xs" c="chatbox-tertiary" lineClamp={2} mt={2}>
            {theme.description ? t(theme.description) : t('Created in the theme editor')}
          </Text>
        </Box>

        <Flex gap="xxs" align="center" className="flex-shrink-0">
          <Badge size="xs" variant="light" color={theme.builtin ? 'gray' : 'chatbox-brand'} radius="sm">
            {theme.builtin ? t('Built-in') : t('My theme')}
          </Badge>
          <ActionMenu
            items={menuItems}
            position="bottom-end"
            title={theme.builtin ? String(t(theme.name)) : theme.name}
          >
            {/*
              The menu opens itself: on a narrow screen ActionMenu is a vaul drawer
              whose trigger skips its own handler once this one calls
              preventDefault(), which left Edit/Duplicate/Delete unreachable on
              Android. stopPropagation() alone still keeps the card from being
              selected by a tap on the menu button.
            */}
            <ActionIcon
              variant="transparent"
              size="sm"
              color="chatbox-tertiary"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <ScalableIcon icon={IconDots} size={14} />
            </ActionIcon>
          </ActionMenu>
        </Flex>
      </Flex>
    </Paper>
  )
}
