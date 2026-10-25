import { Button, NativeSelect, Stack, Text } from '@mantine/core'
import type { Session } from '@shared/types/session'
import { useTranslation } from 'react-i18next'
import { runManualCompactionWithUIState } from '@/packages/context-management/compaction'
import { DETAILED_COMPACTION_PROMPT_ID, ROLEPLAY_COMPACTION_PROMPT_ID } from '@/packages/prompts'
import { useSettingsStore } from '@/stores/settingsStore'
import { AdaptiveModal } from './AdaptiveModal'

interface CompressionModalProps {
  opened: boolean
  onClose: () => void
  session: Session
}

export function CompressionModal({ opened, onClose, session }: CompressionModalProps) {
  const { t } = useTranslation()
  const customPrompts = useSettingsStore((state) => state.compactionPrompts)
  const configuredPromptId = useSettingsStore((state) => state.activeCompactionPromptId)
  const setSettings = useSettingsStore((state) => state.setSettings)
  const promptOptions = [
    { value: DETAILED_COMPACTION_PROMPT_ID, label: t('Detailed continuity') },
    { value: ROLEPLAY_COMPACTION_PROMPT_ID, label: t('Role-play continuity') },
    ...(customPrompts ?? []).map((prompt) => ({ value: prompt.id, label: prompt.name })),
  ]
  const selectedPromptId = promptOptions.some((prompt) => prompt.value === configuredPromptId)
    ? configuredPromptId
    : DETAILED_COMPACTION_PROMPT_ID

  const handleConfirm = () => {
    onClose()
    void runManualCompactionWithUIState(session.id)
  }

  return (
    <AdaptiveModal opened={opened} onClose={onClose} title={t('Compress Conversation')} centered size="md">
      <Stack gap="md">
        <Text>
          {t(
            'This will summarize the current conversation and start a new thread with the compressed context. Continue?'
          )}
        </Text>
        <NativeSelect
          label={t('Compaction Prompt')}
          description={t(
            'Choose what information the model must preserve. The selected prompt is used for both automatic and manual compaction.'
          )}
          data={promptOptions}
          value={selectedPromptId}
          onChange={(event) => setSettings({ activeCompactionPromptId: event.currentTarget.value })}
        />
        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={onClose} />
          <Button onClick={handleConfirm}>{t('Confirm')}</Button>
        </AdaptiveModal.Actions>
      </Stack>
    </AdaptiveModal>
  )
}
