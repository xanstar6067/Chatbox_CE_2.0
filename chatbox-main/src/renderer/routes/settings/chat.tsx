import {
  Box,
  Button,
  FileButton,
  Flex,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { chatSessionSettings, getDefaultPrompt } from '@shared/defaults'
import type { CompactionPrompt } from '@shared/types'
import { IconInfoCircle } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { AssistantAvatar, UserAvatar } from '@/components/common/Avatar'
import { Divider } from '@/components/common/Divider'
import MaxContextMessageCountSlider from '@/components/common/MaxContextMessageCountSlider'
import { MessageLayoutSelector } from '@/components/common/MessageLayoutPreview'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import SliderWithInput from '@/components/common/SliderWithInput'
import { handleImageInputAndSave, ImageInStorage } from '@/components/Image'
import { languageNameMap } from '@/i18n/locales'
import {
  DETAILED_COMPACTION_PROMPT_ID,
  ROLEPLAY_COMPACTION_PROMPT_ID,
  resolveCompactionPrompt,
} from '@/packages/prompts'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { useSettingsStore } from '@/stores/settingsStore'
import { add as addToast } from '@/stores/toastActions'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

export const Route = createFileRoute('/settings/chat')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const { setSettings, ...settings } = useSettingsStore((state) => state)

  return (
    <Stack gap="xxl" p="md">
      <Title order={5}>{t('Chat Settings')}</Title>

      {/* Avatars */}
      <Stack gap="md">
        <Stack gap="xxs">
          <Text fw="600">{t('Edit Avatars')}</Text>
          <Text size="xs" c="chatbox-tertiary">
            {t('Support jpg or png file smaller than 5MB')}
          </Text>
        </Stack>

        {/* User Avatar' */}
        <Stack>
          <Text size="xs" c="chatbox-secondary">
            {t('User Avatar')}
          </Text>
          <Flex align="center" gap="xs">
            <UserAvatar size={56} avatarKey={settings.userAvatarKey} />
            <FileButton
              onChange={(file) => {
                if (file) {
                  if (file.size > MAX_IMAGE_SIZE) {
                    addToast(t('Support jpg or png file smaller than 5MB'))
                    return
                  }
                  const key = StorageKeyGenerator.picture('user-avatar')
                  handleImageInputAndSave(
                    file,
                    key,
                    () => setSettings({ userAvatarKey: key }),
                    (k, v) => storage.setBlob(k, v)
                  )
                }
              }}
              accept="image/png,image/jpeg"
            >
              {(props) => (
                <Button {...props} variant="outline" size="xs">
                  {t('Upload Image')}
                </Button>
              )}
            </FileButton>
            {!!settings.userAvatarKey && (
              <Button color="chatbox-gray" size="xs" onClick={() => setSettings({ userAvatarKey: undefined })}>
                {t('Delete')}
              </Button>
            )}
          </Flex>
        </Stack>

        {/* Default Assistant Avatar */}
        <Stack>
          <Text size="xs" c="chatbox-secondary">
            {t('Default Assistant Avatar')}
          </Text>
          <Flex align="center" gap="xs">
            <AssistantAvatar avatarKey={settings.defaultAssistantAvatarKey} size={56} />
            <FileButton
              onChange={(file) => {
                if (file) {
                  if (file.size > MAX_IMAGE_SIZE) {
                    addToast(t('Support jpg or png file smaller than 5MB'))
                    return
                  }
                  const key = StorageKeyGenerator.picture('default-assistant-avatar')
                  handleImageInputAndSave(
                    file,
                    key,
                    () => setSettings({ defaultAssistantAvatarKey: key }),
                    (k, v) => storage.setBlob(k, v)
                  )
                }
              }}
              accept="image/png,image/jpeg"
            >
              {(props) => (
                <Button {...props} variant="outline" size="xs">
                  {t('Upload Image')}
                </Button>
              )}
            </FileButton>
            {!!settings.defaultAssistantAvatarKey && (
              <Button
                color="chatbox-gray"
                size="xs"
                onClick={() => setSettings({ defaultAssistantAvatarKey: undefined })}
              >
                {t('Delete')}
              </Button>
            )}
          </Flex>
        </Stack>
      </Stack>

      <Divider />

      {/* Default Settings */}
      <Stack gap="md">
        <Text fw="600">{t('Default Settings for New Conversation')}</Text>
        <Stack gap="xxs">
          <Text fw="500">{t('Prompt')}</Text>
          <Textarea
            value={settings.defaultPrompt || ''}
            autosize
            minRows={1}
            maxRows={12}
            onChange={(e) =>
              setSettings({
                defaultPrompt: e.currentTarget.value,
              })
            }
          />
          <Button
            variant="subtle"
            color="chatbox-gray"
            onClick={() => {
              setSettings({
                defaultPrompt: getDefaultPrompt(),
              })
            }}
            px={3}
            py={6}
            className=" self-start"
          >
            {t('Reset to Default')}
          </Button>
        </Stack>

        {/* Max Context Message Count */}
        <MaxContextMessageCountSlider
          wrapperProps={{ gap: 'xxs' }}
          labelProps={{ fw: undefined }}
          value={settings?.maxContextMessageCount ?? chatSessionSettings().maxContextMessageCount ?? 20}
          onChange={(v) => setSettings({ maxContextMessageCount: v })}
        />

        {/* Temperature */}
        <Stack gap="xxs">
          <Flex align="center" gap="xs">
            <Text size="sm">{t('Temperature')}</Text>
            <Tooltip
              label={t(
                'Modify the creativity of AI responses; the higher the value, the more random and intriguing the answers become, while a lower value ensures greater stability and reliability.'
              )}
              withArrow={true}
              maw={320}
              className="!whitespace-normal"
              zIndex={3000}
              events={{ hover: true, focus: true, touch: true }}
            >
              <ScalableIcon icon={IconInfoCircle} size={20} className="text-chatbox-tint-tertiary" />
            </Tooltip>
          </Flex>

          <SliderWithInput value={settings?.temperature} onChange={(v) => setSettings({ temperature: v })} max={2} />
        </Stack>

        {/* Top P */}
        <Stack gap="xxs">
          <Flex align="center" gap="xs">
            <Text size="sm">Top P</Text>
            <Tooltip
              label={t(
                'The topP parameter controls the diversity of AI responses: lower values make the output more focused and predictable, while higher values allow for more varied and creative replies.'
              )}
              withArrow={true}
              maw={320}
              className="!whitespace-normal"
              zIndex={3000}
              events={{ hover: true, focus: true, touch: true }}
            >
              <ScalableIcon icon={IconInfoCircle} size={20} className="text-chatbox-tint-tertiary" />
            </Tooltip>
          </Flex>

          <SliderWithInput value={settings?.topP} onChange={(v) => setSettings({ topP: v })} max={1} />
        </Stack>

        {/* Background Image */}
        <Stack gap="xs">
          <Text>{t('Background Image')}</Text>
          <Flex align="center" gap="sm" wrap="wrap">
            {settings.backgroundImageKey ? (
              <Box w={160} h={90} className="overflow-hidden rounded bg-chatbox-tertiary/20 flex-shrink-0">
                <ImageInStorage storageKey={settings.backgroundImageKey} className="object-cover w-full h-full" />
              </Box>
            ) : null}
            <Flex gap="xs" align="center">
              <FileButton
                onChange={(file) => {
                  if (file) {
                    if (file.size > MAX_IMAGE_SIZE) {
                      addToast(t('Support jpg or png file smaller than 5MB'))
                      return
                    }
                    const key = StorageKeyGenerator.picture('background-image')
                    handleImageInputAndSave(
                      file,
                      key,
                      () => setSettings({ backgroundImageKey: key }),
                      (k, v) => storage.setBlob(k, v)
                    )
                  }
                }}
                accept="image/png,image/jpeg"
              >
                {(props) => (
                  <Button {...props} variant="outline" size="xs">
                    {t('Upload Image')}
                  </Button>
                )}
              </FileButton>
              {!!settings.backgroundImageKey && (
                <Button color="chatbox-gray" size="xs" onClick={() => setSettings({ backgroundImageKey: undefined })}>
                  {t('Remove')}
                </Button>
              )}
            </Flex>
          </Flex>
        </Stack>

        {/* Stream output */}
        <Stack gap="xxs">
          <Flex align="center" gap="xs" justify="space-between">
            <Text size="sm">{t('Stream output')}</Text>
            <Switch
              // label={t('Stream output')}
              checked={settings?.stream ?? true}
              onChange={(v) => setSettings({ stream: v.target.checked })}
            />
          </Flex>
        </Stack>
      </Stack>
      <Divider />

      {/* Conversation Settings */}
      <Stack gap="md">
        <Text fw="600">{t('Conversation Settings')}</Text>

        {/* Display */}
        <Stack gap="sm">
          <Text c="chatbox-tertiary">{t('Display')}</Text>

          <MessageLayoutSelector
            value={settings.messageLayout ?? 'left'}
            onValueChange={(val) => setSettings({ messageLayout: val })}
          />

          <Switch
            label={t('Show Avatar')}
            checked={settings.showAvatar ?? true}
            onChange={() =>
              setSettings((draft) => {
                draft.showAvatar = !(draft.showAvatar ?? true)
              })
            }
          />

          <Switch
            label={t('show message word count')}
            checked={settings.showWordCount}
            onChange={() =>
              setSettings((draft) => {
                draft.showWordCount = !draft.showWordCount
              })
            }
          />

          {/* <Switch
            label={t('show message token count')}
            checked={settings.showTokenCount}
            onChange={() =>
              setSettings({
                showTokenCount: !settings.showTokenCount,
              })
            }
          /> */}

          <Switch
            label={t('show message token usage')}
            checked={settings.showTokenUsed}
            onChange={() =>
              setSettings({
                showTokenUsed: !settings.showTokenUsed,
              })
            }
          />

          <Switch
            label={t('show model name')}
            checked={settings.showModelName}
            onChange={() =>
              setSettings({
                showModelName: !settings.showModelName,
              })
            }
          />

          <Switch
            label={t('show message timestamp')}
            checked={settings.showMessageTimestamp}
            onChange={() =>
              setSettings({
                showMessageTimestamp: !settings.showMessageTimestamp,
              })
            }
          />

          <Switch
            label={t('show first token latency')}
            checked={settings.showFirstTokenLatency}
            onChange={() =>
              setSettings({
                showFirstTokenLatency: !settings.showFirstTokenLatency,
              })
            }
          />
        </Stack>

        {/* Function */}
        <Stack gap="sm">
          <Text c="chatbox-tertiary">{t('Function')}</Text>

          <Switch
            label={t('Auto-collapse code blocks')}
            checked={settings.autoCollapseCodeBlock}
            onChange={() =>
              setSettings({
                autoCollapseCodeBlock: !settings.autoCollapseCodeBlock,
              })
            }
          />
          <Switch
            label={t('Auto-Generate Chat Titles')}
            checked={settings.autoGenerateTitle}
            onChange={() =>
              setSettings({
                ...settings,
                autoGenerateTitle: !settings.autoGenerateTitle,
              })
            }
          />
          <Switch
            label={t('Spell Check')}
            checked={settings.spellCheck}
            onChange={() =>
              setSettings({
                ...settings,
                spellCheck: !settings.spellCheck,
              })
            }
          />
          <Switch
            label={t('Markdown Rendering')}
            checked={settings.enableMarkdownRendering}
            onChange={() =>
              setSettings({
                ...settings,
                enableMarkdownRendering: !settings.enableMarkdownRendering,
              })
            }
          />
          <Switch
            label={t('LaTeX Rendering (Requires Markdown)')}
            checked={settings.enableLaTeXRendering}
            onChange={() =>
              setSettings({
                ...settings,
                enableLaTeXRendering: !settings.enableLaTeXRendering,
              })
            }
          />
          <Switch
            label={t('Mermaid Diagrams & Charts Rendering')}
            checked={settings.enableMermaidRendering}
            onChange={() =>
              setSettings({
                ...settings,
                enableMermaidRendering: !settings.enableMermaidRendering,
              })
            }
          />
          <Switch
            label={t('Inject default metadata')}
            checked={settings.injectDefaultMetadata}
            description={t('e.g., Model Name, Current Date')}
            onChange={() =>
              setSettings({
                ...settings,
                injectDefaultMetadata: !settings.injectDefaultMetadata,
              })
            }
          />
          <Switch
            label={t('Auto-preview artifacts')}
            checked={settings.autoPreviewArtifacts}
            description={t('Automatically render generated artifacts (e.g., HTML with CSS, JS, Tailwind)')}
            onChange={() =>
              setSettings({
                ...settings,
                autoPreviewArtifacts: !settings.autoPreviewArtifacts,
              })
            }
          />
          <Switch
            label={t('Paste long text as a file')}
            checked={settings.pasteLongTextAsAFile}
            description={t(
              'Pasting long text will automatically insert it as a file, keeping chats clean and reducing token usage with prompt caching.'
            )}
            onChange={() =>
              setSettings({
                ...settings,
                pasteLongTextAsAFile: !settings.pasteLongTextAsAFile,
              })
            }
          />
        </Stack>
      </Stack>

      <Divider />

      {/* Context Management */}
      <ContextManagementSection />
    </Stack>
  )
}

function ContextManagementSection() {
  const { t } = useTranslation()
  const { setSettings, ...settings } = useSettingsStore((state) => state)

  // Get strategy hint based on threshold value
  const strategyHint = useMemo(() => {
    const threshold = settings.compactionThreshold ?? 0.6
    if (threshold <= 0.5) {
      return t('Cost Priority: Compacts early to save tokens, may lose some context')
    }
    if (threshold >= 0.8) {
      return t('Context Priority: Preserves more context, uses more tokens')
    }
    return t('Balanced: Good balance between cost and context preservation')
  }, [settings.compactionThreshold, t])

  return (
    <Stack gap="xl">
      <Text fw="600">{t('Context Management')}</Text>

      {/* Auto Compaction Toggle */}
      <Stack gap="sm">
        <Flex align="center" gap="xs" justify="space-between">
          <Flex align="center" gap="xs">
            <Text size="sm">{t('Auto Compaction')}</Text>
            <Tooltip
              label={t(
                'Automatically summarize and compact conversation history when context size exceeds the threshold, preserving key information while reducing token usage.'
              )}
              withArrow={true}
              maw={320}
              className="!whitespace-normal"
              zIndex={3000}
              events={{ hover: true, focus: true, touch: true }}
            >
              <ScalableIcon icon={IconInfoCircle} size={20} className="text-chatbox-tint-tertiary" />
            </Tooltip>
          </Flex>
          <Switch
            checked={settings.autoCompaction ?? true}
            onChange={() =>
              setSettings({
                autoCompaction: !(settings.autoCompaction ?? true),
              })
            }
          />
        </Flex>
        <Text c="chatbox-tertiary" size="xs">
          {t('When enabled, conversations will be automatically summarized to manage context window usage.')}
        </Text>
      </Stack>

      <CompactionPromptManager />

      {/* Compaction Threshold Slider */}
      <Stack gap="sm">
        <Flex align="center" gap="xs">
          <Text size="sm">{t('Compaction Threshold')}</Text>
          <Tooltip
            label={t(
              'The percentage of context window usage that triggers automatic compaction. Lower values save tokens but may lose context earlier.'
            )}
            withArrow={true}
            maw={320}
            className="!whitespace-normal"
            zIndex={3000}
            events={{ hover: true, focus: true, touch: true }}
          >
            <ScalableIcon icon={IconInfoCircle} size={20} className="text-chatbox-tint-tertiary" />
          </Tooltip>
        </Flex>

        <Stack gap="xs" mt="xs">
          <Slider
            min={0.4}
            max={0.9}
            step={0.05}
            value={settings.compactionThreshold ?? 0.6}
            onChange={(v) => setSettings({ compactionThreshold: v })}
            label={(v) => `${Math.round(v * 100)}%`}
            disabled={!(settings.autoCompaction ?? true)}
          />
          <Flex justify="space-between" px={2}>
            <Text size="xs" c="chatbox-tertiary">
              {t('Cost')}
            </Text>
            <Text size="xs" c="chatbox-tertiary">
              {t('Context')}
            </Text>
          </Flex>
        </Stack>

        <Text c="chatbox-tertiary" size="xs">
          {strategyHint}
        </Text>
      </Stack>
    </Stack>
  )
}

interface CompactionPromptEditorState {
  id?: string
  name: string
  prompt: string
}

function CompactionPromptManager() {
  const { t } = useTranslation()
  const { setSettings, ...settings } = useSettingsStore((state) => state)
  const [editor, setEditor] = useState<CompactionPromptEditorState | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const customPrompts = settings.compactionPrompts ?? []
  const configuredPromptId = settings.activeCompactionPromptId ?? DETAILED_COMPACTION_PROMPT_ID
  const selectedCustomPrompt = customPrompts.find((item) => item.id === configuredPromptId)
  const selectedPromptId =
    configuredPromptId === DETAILED_COMPACTION_PROMPT_ID ||
    configuredPromptId === ROLEPLAY_COMPACTION_PROMPT_ID ||
    selectedCustomPrompt
      ? configuredPromptId
      : DETAILED_COMPACTION_PROMPT_ID

  const selectedPrompt = resolveCompactionPrompt(selectedPromptId, customPrompts, languageNameMap[settings.language])

  const promptOptions = [
    { value: DETAILED_COMPACTION_PROMPT_ID, label: t('Detailed continuity') },
    { value: ROLEPLAY_COMPACTION_PROMPT_ID, label: t('Role-play continuity') },
    ...customPrompts.map((item) => ({ value: item.id, label: item.name })),
  ]

  const selectedPromptDescription =
    selectedPromptId === DETAILED_COMPACTION_PROMPT_ID
      ? t('Preserves goals, facts, decisions, completed work, constraints, and next actions.')
      : selectedPromptId === ROLEPLAY_COMPACTION_PROMPT_ID
        ? t('Preserves events, locations, characters, relationships, lore, and unresolved story threads.')
        : t('Custom compaction prompt')

  const openCreateEditor = () => {
    setEditor({
      name: '',
      prompt: resolveCompactionPrompt(selectedPromptId, customPrompts, '{{language}}'),
    })
  }

  const openEditEditor = () => {
    if (!selectedCustomPrompt) return
    setEditor({
      id: selectedCustomPrompt.id,
      name: selectedCustomPrompt.name,
      prompt: selectedCustomPrompt.prompt,
    })
  }

  const savePrompt = () => {
    if (!editor?.name.trim() || !editor.prompt.trim()) return

    const savedPrompt: CompactionPrompt = {
      id: editor.id ?? uuidv4(),
      name: editor.name.trim(),
      prompt: editor.prompt.trim(),
    }
    const nextPrompts = editor.id
      ? customPrompts.map((item) => (item.id === editor.id ? savedPrompt : item))
      : [...customPrompts, savedPrompt]

    setSettings({
      compactionPrompts: nextPrompts,
      activeCompactionPromptId: savedPrompt.id,
    })
    setEditor(null)
  }

  const deleteSelectedPrompt = () => {
    if (!selectedCustomPrompt) return
    setSettings({
      compactionPrompts: customPrompts.filter((item) => item.id !== selectedCustomPrompt.id),
      activeCompactionPromptId: DETAILED_COMPACTION_PROMPT_ID,
    })
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <Stack gap="sm">
        <Stack gap="xxs">
          <Text size="sm">{t('Compaction Prompt')}</Text>
          <Text c="chatbox-tertiary" size="xs">
            {t(
              'Choose what information the model must preserve. The selected prompt is used for both automatic and manual compaction.'
            )}
          </Text>
        </Stack>

        <Select
          value={selectedPromptId}
          data={promptOptions}
          onChange={(value) => {
            if (value) {
              setSettings({ activeCompactionPromptId: value })
            }
          }}
          allowDeselect={false}
        />

        <Text c="chatbox-tertiary" size="xs">
          {selectedPromptDescription}
        </Text>

        <Textarea value={selectedPrompt} readOnly autosize minRows={5} maxRows={12} label={t('Prompt Preview')} />

        <Flex gap="xs" wrap="wrap">
          <Button variant="outline" size="xs" onClick={openCreateEditor}>
            {t('Create Custom Prompt')}
          </Button>
          {selectedCustomPrompt && (
            <>
              <Button variant="light" color="chatbox-gray" size="xs" onClick={openEditEditor}>
                {t('Edit')}
              </Button>
              <Button variant="light" color="red" size="xs" onClick={() => setShowDeleteConfirm(true)}>
                {t('Delete')}
              </Button>
            </>
          )}
        </Flex>
      </Stack>

      <AdaptiveModal
        opened={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.id ? t('Edit Compaction Prompt') : t('Create Compaction Prompt')}
        centered
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label={t('Name')}
            value={editor?.name ?? ''}
            onChange={(event) =>
              setEditor((current) => (current ? { ...current, name: event.currentTarget.value } : null))
            }
            autoFocus
          />
          <Textarea
            label={t('Prompt')}
            description={t('Use the {{placeholder}} placeholder where the selected app language should be inserted.', {
              placeholder: '{{language}}',
            })}
            value={editor?.prompt ?? ''}
            onChange={(event) =>
              setEditor((current) => (current ? { ...current, prompt: event.currentTarget.value } : null))
            }
            autosize
            minRows={10}
            maxRows={20}
          />
          <AdaptiveModal.Actions>
            <AdaptiveModal.CloseButton onClick={() => setEditor(null)} />
            <Button disabled={!editor?.name.trim() || !editor.prompt.trim()} onClick={savePrompt}>
              {t('Save')}
            </Button>
          </AdaptiveModal.Actions>
        </Stack>
      </AdaptiveModal>

      <AdaptiveModal
        opened={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('Delete Compaction Prompt')}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{t('Delete this custom compaction prompt? This cannot be undone.')}</Text>
          <AdaptiveModal.Actions>
            <AdaptiveModal.CloseButton onClick={() => setShowDeleteConfirm(false)} />
            <Button color="red" onClick={deleteSelectedPrompt}>
              {t('Delete')}
            </Button>
          </AdaptiveModal.Actions>
        </Stack>
      </AdaptiveModal>
    </>
  )
}
