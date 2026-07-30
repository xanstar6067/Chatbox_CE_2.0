import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Alert, Button, Flex, Stack, Text, Textarea } from '@mantine/core'
import type { Message } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { IconAlertCircle, IconCheck, IconChevronDown, IconPlayerPlay, IconRefresh } from '@tabler/icons-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import ProviderImageIcon from '@/components/icons/ProviderImageIcon'
import ModelSelector from '@/components/ModelSelector'
import { useProviders } from '@/hooks/useProviders'
import { cn } from '@/lib/utils'
import { type MessageRefinementKind, refineMessageText, replaceMessageTextParts } from '@/services/messageRefinement'
import * as chatStore from '@/stores/chatStore'
import { modifyMessage } from '@/stores/sessionActions'

const MessageRefinement = NiceModal.create(
  (props: { sessionId: string; msg: Message; kind: MessageRefinementKind }) => {
    const modal = useModal()

    if (!props.msg) {
      return null
    }

    return (
      <MessageRefinementModal
        key={`${props.msg.id}-${props.kind}-${modal.visible}`}
        {...props}
        opened={modal.visible}
        onClose={() => {
          modal.resolve()
          modal.hide()
        }}
      />
    )
  }
)

export default MessageRefinement

function MessageRefinementModal({
  sessionId,
  msg,
  kind,
  opened,
  onClose,
}: {
  sessionId: string
  msg: Message
  kind: MessageRefinementKind
  opened: boolean
  onClose(): void
}) {
  const { t } = useTranslation()
  const { sessionSettings } = chatStore.useSessionSettings(sessionId)
  const { providers } = useProviders()
  const savedModel = sessionSettings.messageRefinementModels?.[kind]
  const [selectedModel, setSelectedModel] = useState(() => ({
    provider: savedModel?.provider ?? sessionSettings.provider ?? '',
    modelId: savedModel?.modelId ?? sessionSettings.modelId ?? '',
  }))
  const [userInstruction, setUserInstruction] = useState('')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const selectedProvider = providers.find((provider) => provider.id === selectedModel.provider)
  const selectedModelInfo = (selectedProvider?.models || selectedProvider?.defaultSettings?.models)?.find(
    (model) => model.modelId === selectedModel.modelId
  )
  const selectedModelLabel =
    selectedModelInfo?.nickname || selectedModelInfo?.modelId || selectedModel.modelId || t('Please select a model')

  const title = kind === 'cleanup' ? t('Clean up text') : t('Proofread text')
  const sourceText = useMemo(() => getMessageText(msg, false, false).trim(), [msg])
  const canRun = !!sourceText && !!selectedModel.provider && !!selectedModel.modelId && !isRunning

  const persistSelectedModel = useCallback(
    async (provider: string, modelId: string) => {
      setSelectedModel({ provider, modelId })
      const session = await chatStore.getSession(sessionId)
      if (!session) return

      await chatStore.updateSession(sessionId, {
        settings: {
          ...session.settings,
          messageRefinementModels: {
            ...session.settings?.messageRefinementModels,
            [kind]: { provider, modelId },
          },
        },
      })
    },
    [kind, sessionId]
  )

  const handleRun = useCallback(async () => {
    if (!canRun) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsRunning(true)
    setError('')
    setPreview('')

    try {
      const result = await refineMessageText({
        sessionId,
        message: msg,
        kind,
        userInstruction,
        modelSelection: selectedModel,
        sessionSettings,
        signal: controller.signal,
        onTextChange: (text) => {
          if (!controller.signal.aborted) {
            setPreview(text)
          }
        },
      })
      if (!controller.signal.aborted) {
        setPreview(result)
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
        setIsRunning(false)
      }
    }
  }, [canRun, sessionId, msg, kind, userInstruction, selectedModel, sessionSettings])

  const handleClose = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    onClose()
  }, [onClose])

  const handleApply = useCallback(async () => {
    const replacement = preview.trim()
    if (!replacement || isRunning) return

    await modifyMessage(
      sessionId,
      {
        ...msg,
        contentParts: replaceMessageTextParts(msg.contentParts, replacement),
      },
      true
    )
    onClose()
  }, [preview, isRunning, sessionId, msg, onClose])

  return (
    <AdaptiveModal opened={opened} centered size="lg" onClose={handleClose} title={title} keepMounted={false}>
      <Stack gap="md">
        <Stack gap={6}>
          <Text size="sm" fw={600}>
            {t('Editing model')}
          </Text>
          <ModelSelector
            selectedProviderId={selectedModel.provider}
            selectedModelId={selectedModel.modelId}
            position="bottom-start"
            width={420}
            searchPosition="top"
            onSelect={(provider, modelId) => {
              if (provider && modelId) {
                void persistSelectedModel(provider, modelId).catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause))
                })
              }
            }}
          >
            <Flex
              component="button"
              type="button"
              align="center"
              gap="xs"
              px="sm"
              py={9}
              w="100%"
              className={cn(
                'border-solid border border-chatbox-border-primary rounded-md cursor-pointer',
                'bg-transparent text-chatbox-tint-secondary hover:bg-chatbox-background-secondary'
              )}
            >
              {!!selectedModel.provider && <ProviderImageIcon size={20} provider={selectedModel.provider} />}
              <Text span size="sm" flex={1} ta="left" truncate>
                {selectedModelLabel}
              </Text>
              <ScalableIcon icon={IconChevronDown} size={16} className="text-chatbox-tint-tertiary" />
            </Flex>
          </ModelSelector>
          <Text size="xs" c="chatbox-tertiary">
            {t('This choice is saved for this tool in this chat and does not change the chat model.')}
          </Text>
        </Stack>

        <Textarea
          label={t('Optional editing instruction')}
          description={t('For example: “replace Ritsko with Ritsuko” or “make Misato’s car blue”.')}
          placeholder={t('Leave empty for automatic correction') || ''}
          value={userInstruction}
          onChange={(event) => setUserInstruction(event.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={5}
          disabled={isRunning}
        />

        <Textarea
          label={t('Result preview')}
          description={t('Only this message is sent to the selected model; chat history is not included.')}
          placeholder={
            isRunning
              ? t('The model is correcting the text…') || ''
              : t('Run the correction to see and edit the result here.') || ''
          }
          value={preview}
          onChange={(event) => setPreview(event.currentTarget.value)}
          autosize
          minRows={7}
          maxRows={16}
          readOnly={!preview || isRunning}
        />

        {!!error && (
          <Alert color="red" icon={<ScalableIcon icon={IconAlertCircle} size={18} />} title={t('Correction failed')}>
            {error}
          </Alert>
        )}

        <AdaptiveModal.Actions>
          <Button color="chatbox-gray" variant="light" onClick={handleClose}>
            {t('Cancel')}
          </Button>
          <Button
            variant="light"
            leftSection={<ScalableIcon icon={preview ? IconRefresh : IconPlayerPlay} size={16} />}
            loading={isRunning}
            disabled={!canRun}
            onClick={() => void handleRun()}
          >
            {preview ? t('Try again') : t('Run correction')}
          </Button>
          <Button
            leftSection={<ScalableIcon icon={IconCheck} size={16} />}
            disabled={!preview.trim() || isRunning}
            onClick={() => void handleApply()}
          >
            {t('Apply')}
          </Button>
        </AdaptiveModal.Actions>
      </Stack>
    </AdaptiveModal>
  )
}
