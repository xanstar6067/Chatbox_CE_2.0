import NiceModal from '@ebay/nice-modal-react'
import { Button, Flex, Select, Stack, Text, Textarea } from '@mantine/core'
import type { CopilotDetail, Session } from '@shared/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { useMyCopilots } from '@/hooks/useCopilots'
import { isCopilotPromptModified } from '@/packages/copilot-prompt'
import { AdaptiveModal } from './common/AdaptiveModal'

type CopilotPromptState = Pick<Session, 'copilotId' | 'copilotPromptModified'>

export function CopilotPromptEditor({
  session,
  value,
  onChange,
}: {
  session: Session
  value: string
  onChange: (prompt: string, state: CopilotPromptState) => void
}) {
  const { t } = useTranslation()
  const { copilots, addOrUpdate } = useMyCopilots()
  const [pendingCopilot, setPendingCopilot] = useState<CopilotDetail | null>(null)
  const modified = isCopilotPromptModified(session, value, copilots)
  const selectedCopilot = copilots.find((copilot) => copilot.id === session.copilotId)

  useEffect(() => {
    if (session.copilotPromptModified === undefined) {
      onChange(value, { copilotId: session.copilotId, copilotPromptModified: modified })
    }
  }, [session.copilotId, session.copilotPromptModified, value, modified, onChange])

  const applyCopilot = (copilot: CopilotDetail) => {
    onChange(copilot.prompt, { copilotId: copilot.id, copilotPromptModified: false })
    setPendingCopilot(null)
  }

  const saveAndSwitch = async () => {
    if (!pendingCopilot) return
    const target = pendingCopilot
    const saved = await NiceModal.show<CopilotDetail | undefined>('copilot-settings', {
      mode: 'create',
      copilot: { id: uuidv4(), name: '', prompt: value.trim() },
      onSave: addOrUpdate,
    })
    if (saved) applyCopilot(target)
  }

  return (
    <Stack gap="xs">
      <Select
        label={t('Copilot role')}
        placeholder={t('Select a copilot') || ''}
        searchable
        allowDeselect={false}
        data={copilots.map((copilot) => ({ value: copilot.id, label: copilot.name }))}
        value={selectedCopilot?.id ?? null}
        nothingFoundMessage={t('No copilots found')}
        comboboxProps={{ withinPortal: false }}
        onChange={(id) => {
          const copilot = copilots.find((item) => item.id === id)
          if (!copilot || (copilot.id === session.copilotId && !modified)) return
          if (modified && value.trim()) setPendingCopilot(copilot)
          else applyCopilot(copilot)
        }}
      />
      {modified && (
        <Text size="xs" c="dimmed">
          {t('Role instruction modified')}
        </Text>
      )}
      <Textarea
        label={t('Instruction (System Prompt)')}
        placeholder={t('Copilot Prompt Demo') || ''}
        autosize
        minRows={2}
        maxRows={12}
        value={value}
        onChange={(event) => {
          const prompt = event.target.value
          onChange(prompt, {
            copilotId: session.copilotId,
            copilotPromptModified: selectedCopilot ? prompt.trim() !== selectedCopilot.prompt.trim() : true,
          })
        }}
        classNames={{ input: '!text-chatbox-tint-primary' }}
        styles={{ input: { touchAction: 'manipulation' } }}
      />
      <AdaptiveModal
        opened={!!pendingCopilot}
        onClose={() => setPendingCopilot(null)}
        title={t('Save current role?')}
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">{t('The current instruction has changes. Save it as a new copilot before switching?')}</Text>
          <Flex gap="xs" justify="flex-end" wrap="wrap">
            <Button variant="default" onClick={() => setPendingCopilot(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="outline" onClick={() => pendingCopilot && applyCopilot(pendingCopilot)}>
              {t('Switch without saving')}
            </Button>
            <Button onClick={() => void saveAndSwitch()}>{t('Save as new copilot')}</Button>
          </Flex>
        </Stack>
      </AdaptiveModal>
    </Stack>
  )
}
