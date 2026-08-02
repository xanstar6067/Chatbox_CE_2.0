import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Image,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import type { VideoGeneration } from '@shared/types'
import {
  IconArrowUp,
  IconDownload,
  IconHistory,
  IconMovie,
  IconPhotoPlus,
  IconPlayerStop,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconVideoPlus,
  IconX,
} from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageModelSelect } from '@/components/ImageModelSelect'
import Page from '@/components/layout/Page'
import { useBlob } from '@/hooks/useBlob'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { useVideoModelGroups, type VideoModelOption } from '@/hooks/useVideoModelGroups'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as toastActions from '@/stores/toastActions'
import {
  cancelVideoGeneration,
  createAndGenerateVideo,
  deleteVideoGeneration,
  resumeVideoGeneration,
  retryVideoGeneration,
} from '@/stores/videoGenerationActions'
import {
  useCurrentVideoGeneratingId,
  useCurrentVideoRecordId,
  useVideoGenerationHistory,
  useVideoGenerationRecord,
  videoGenerationStore,
} from '@/stores/videoGenerationStore'

export const Route = createFileRoute('/video-creator/')({ component: VideoCreatorPage })

const STATUS_COLORS: Record<VideoGeneration['status'], string> = {
  pending: 'yellow',
  in_progress: 'blue',
  downloading: 'cyan',
  completed: 'green',
  failed: 'red',
  cancelled: 'gray',
  expired: 'orange',
}

function videoStatusLabel(status: VideoGeneration['status']) {
  const labels: Record<VideoGeneration['status'], string> = {
    pending: 'Queued',
    in_progress: 'Generating',
    downloading: 'Saving video',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  }
  return labels[status]
}

function StoredImage({ storageKey }: { storageKey: string }) {
  const { data } = useBlob(storageKey)
  return data ? <Image src={data} w={72} h={72} fit="cover" radius="md" /> : <Skeleton w={72} h={72} radius="md" />
}

function VideoResult({ record }: { record: VideoGeneration }) {
  const { t } = useTranslation()
  const { data: video } = useBlob(record.generatedVideo)
  const handleDownload = useCallback(async () => {
    if (!video) return
    const response = await fetch(video)
    await platform.exporter.exportBlob(`chatbox-video-${record.id.slice(0, 8)}.mp4`, await response.blob())
  }, [record.id, video])

  if (!record.generatedVideo) return null
  if (!video) return <Skeleton maw={800} mx="auto" w="100%" className="aspect-video" radius="lg" />
  return (
    <Stack gap="sm" align="center">
      <video
        src={video}
        controls
        playsInline
        preload="metadata"
        className="max-w-full max-h-[62vh] rounded-lg bg-black shadow-lg"
      />
      <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => void handleDownload()}>
        {t('Download Video')}
      </Button>
    </Stack>
  )
}

function HistoryContent({
  records,
  currentId,
  onSelect,
  onDelete,
}: {
  records: VideoGeneration[]
  currentId: string | null
  onSelect: (record: VideoGeneration) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  if (!records.length) {
    return (
      <Stack align="center" py="xl" c="dimmed">
        <IconHistory size={28} />
        <Text size="sm">{t('No video history yet')}</Text>
      </Stack>
    )
  }
  return (
    <Stack gap="xs" p="xs">
      {records.map((record) => (
        <UnstyledButton
          key={record.id}
          onClick={() => onSelect(record)}
          className={`rounded-md border border-solid p-2 text-left transition-colors ${
            currentId === record.id
              ? 'border-[var(--chatbox-tint-brand)] bg-[var(--chatbox-background-brand-secondary)]'
              : 'border-[var(--chatbox-border-primary)] hover:bg-[var(--chatbox-background-secondary)]'
          }`}
        >
          <Flex gap="xs" align="center">
            <Flex
              w={54}
              h={54}
              align="center"
              justify="center"
              className="rounded-md bg-[var(--chatbox-background-tertiary)] shrink-0"
            >
              <IconMovie size={24} className="opacity-50" />
            </Flex>
            <Stack gap={2} flex={1} className="overflow-hidden">
              <Text size="sm" fw={500} lineClamp={2}>
                {record.prompt}
              </Text>
              <Flex gap={4} align="center">
                <Badge size="xs" color={STATUS_COLORS[record.status]} variant="light">
                  {t(videoStatusLabel(record.status))}
                </Badge>
                <Text size="xs" c="dimmed">
                  {record.duration}s
                </Text>
              </Flex>
            </Stack>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                if (window.confirm(t('Delete this record?') || '')) onDelete(record.id)
              }}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </Flex>
        </UnstyledButton>
      ))}
    </Stack>
  )
}

function VideoCreatorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isSmallScreen = useIsSmallScreen()
  const modelGroups = useVideoModelGroups()
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [duration, setDuration] = useState(8)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState('720p')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [referenceImage, setReferenceImage] = useState<string>()
  const [referenceIsTemporary, setReferenceIsTemporary] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [showMobileHistory, setShowMobileHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentRecordId = useCurrentVideoRecordId()
  const currentGeneratingId = useCurrentVideoGeneratingId()
  const { data: currentRecord } = useVideoGenerationRecord(currentRecordId)
  const { data: history = [] } = useVideoGenerationHistory()
  const selectedOption = useMemo(
    () =>
      modelGroups
        .find((group) => group.providerId === selectedProvider)
        ?.models.find((model) => model.modelId === selectedModel),
    [modelGroups, selectedModel, selectedProvider]
  )

  const applyModelDefaults = useCallback((model: VideoModelOption) => {
    setDuration((value) => (model.durations.includes(value) ? value : model.durations[0]))
    setResolution((value) => (model.resolutions.includes(value) ? value : model.resolutions[0]))
    setAspectRatio((value) => (model.aspectRatios.includes(value) ? value : model.aspectRatios[0]))
    setGenerateAudio((value) => value && model.supportsAudio)
  }, [])

  useEffect(() => {
    if (selectedOption) return
    const firstGroup = modelGroups.find((group) => group.models.length)
    const firstModel = firstGroup?.models[0]
    if (!firstGroup || !firstModel) return
    setSelectedProvider(firstGroup.providerId)
    setSelectedModel(firstModel.modelId)
    applyModelDefaults(firstModel)
  }, [applyModelDefaults, modelGroups, selectedOption])

  const deleteTemporaryReference = useCallback(async () => {
    if (referenceImage && referenceIsTemporary) await storage.delBlob(referenceImage).catch(() => undefined)
  }, [referenceImage, referenceIsTemporary])

  useEffect(() => {
    return () => {
      if (referenceImage && referenceIsTemporary) void storage.delBlob(referenceImage)
    }
  }, [referenceImage, referenceIsTemporary])

  const handleModelSelect = useCallback(
    (provider: string, modelId: string) => {
      const option = modelGroups
        .find((group) => group.providerId === provider)
        ?.models.find((m) => m.modelId === modelId)
      setSelectedProvider(provider)
      setSelectedModel(modelId)
      if (option) applyModelDefaults(option)
    },
    [applyModelDefaults, modelGroups]
  )

  const handleUpload = useCallback(
    (file?: File) => {
      if (!file?.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = async () => {
        await deleteTemporaryReference()
        const key = StorageKeyGenerator.picture('video-creator-ref')
        await storage.setBlob(key, String(reader.result))
        setReferenceImage(key)
        setReferenceIsTemporary(true)
      }
      reader.readAsDataURL(file)
    },
    [deleteTemporaryReference]
  )

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || !selectedModel || currentGeneratingId) return
    try {
      await createAndGenerateVideo({
        prompt: prompt.trim(),
        referenceImage,
        model: { provider: selectedProvider, modelId: selectedModel },
        duration,
        aspectRatio,
        resolution,
        generateAudio: selectedOption?.supportsAudio ? generateAudio : undefined,
      })
      setReferenceIsTemporary(false)
      setReferenceImage(undefined)
      setPrompt('')
    } catch (error) {
      toastActions.add(error instanceof Error ? error.message : String(error))
    }
  }, [
    prompt,
    selectedModel,
    currentGeneratingId,
    referenceImage,
    selectedProvider,
    duration,
    aspectRatio,
    resolution,
    selectedOption,
    generateAudio,
  ])

  const handleHistorySelect = useCallback((record: VideoGeneration) => {
    videoGenerationStore.getState().setCurrentRecordId(record.id)
    setShowMobileHistory(false)
  }, [])

  const handleNew = useCallback(() => {
    void deleteTemporaryReference()
    setReferenceImage(undefined)
    setReferenceIsTemporary(false)
    setPrompt('')
    videoGenerationStore.getState().setCurrentRecordId(null)
  }, [deleteTemporaryReference])

  const modelDisplayName = selectedOption?.displayName || t('Select video model')
  const isGenerating = currentGeneratingId !== null
  const right = (
    <ActionIcon
      variant="subtle"
      color="gray"
      onClick={() => (isSmallScreen ? setShowMobileHistory(true) : setShowHistory((v) => !v))}
    >
      <IconHistory size={20} />
    </ActionIcon>
  )

  return (
    <Page title={t('Video Creator')} right={right}>
      <Flex h="100%" className="overflow-hidden">
        <Flex direction="column" flex={1} className="overflow-hidden">
          <ScrollArea flex={1} type="auto">
            <Box maw={960} mx="auto" px="md" py="xl" className="min-h-full">
              {!currentRecord ? (
                <Stack align="center" justify="center" mih={360} gap="md" ta="center">
                  <Flex
                    w={72}
                    h={72}
                    align="center"
                    justify="center"
                    className="rounded-full bg-[var(--chatbox-background-brand-secondary)]"
                  >
                    <IconVideoPlus size={34} className="text-[var(--chatbox-tint-brand)]" />
                  </Flex>
                  <Text size="xl" fw={650}>
                    {t('Create a video from text or an image')}
                  </Text>
                  <Text c="dimmed" maw={540}>
                    {t('Describe the scene, choose a model, and optionally add a starting frame.')}
                  </Text>
                  {modelGroups.length === 0 && (
                    <Button variant="light" onClick={() => navigate({ to: '/settings/provider' })}>
                      {t('Configure Google, xAI, or OpenRouter')}
                    </Button>
                  )}
                </Stack>
              ) : (
                <Stack gap="lg">
                  <VideoResult record={currentRecord} />
                  {!currentRecord.generatedVideo && (
                    <Paper withBorder radius="lg" p="xl" maw={800} mx="auto" w="100%">
                      <Stack align="center" gap="md">
                        <IconMovie size={42} className="text-[var(--chatbox-tint-tertiary)]" />
                        <Badge color={STATUS_COLORS[currentRecord.status]} variant="light">
                          {t(videoStatusLabel(currentRecord.status))}
                        </Badge>
                        {(currentRecord.status === 'pending' ||
                          currentRecord.status === 'in_progress' ||
                          currentRecord.status === 'downloading') && (
                          <Progress value={currentRecord.progress ?? 30} animated w="100%" />
                        )}
                        {currentRecord.error && (
                          <Text c="red" size="sm" ta="center">
                            {currentRecord.error}
                          </Text>
                        )}
                        <Flex gap="sm" wrap="wrap" justify="center">
                          {isGenerating && currentGeneratingId === currentRecord.id && (
                            <Button
                              variant="light"
                              color="gray"
                              leftSection={<IconPlayerStop size={16} />}
                              onClick={cancelVideoGeneration}
                            >
                              {t('Stop Waiting')}
                            </Button>
                          )}
                          {!isGenerating &&
                            currentRecord.taskId &&
                            ['pending', 'in_progress'].includes(currentRecord.status) && (
                              <Button
                                variant="light"
                                leftSection={<IconRefresh size={16} />}
                                onClick={() => void resumeVideoGeneration(currentRecord.id)}
                              >
                                {t('Resume Generation')}
                              </Button>
                            )}
                          {!isGenerating && ['failed', 'expired', 'cancelled'].includes(currentRecord.status) && (
                            <Button
                              variant="light"
                              leftSection={<IconRefresh size={16} />}
                              onClick={() => void retryVideoGeneration(currentRecord.id)}
                            >
                              {t('Retry')}
                            </Button>
                          )}
                        </Flex>
                      </Stack>
                    </Paper>
                  )}
                  <Paper withBorder radius="md" p="md" maw={800} mx="auto" w="100%">
                    <Stack gap={4}>
                      <Text>{currentRecord.prompt}</Text>
                      <Text size="xs" c="dimmed">
                        {currentRecord.model.modelId} · {currentRecord.duration}s · {currentRecord.resolution} ·{' '}
                        {currentRecord.aspectRatio}
                      </Text>
                    </Stack>
                  </Paper>
                </Stack>
              )}
            </Box>
          </ScrollArea>

          <Box px="sm" py="md">
            <Stack maw={820} mx="auto" gap="xs">
              {referenceImage && (
                <Flex align="center" gap="xs">
                  <StoredImage storageKey={referenceImage} />
                  <ActionIcon
                    variant="light"
                    color="gray"
                    onClick={() => {
                      void deleteTemporaryReference()
                      setReferenceImage(undefined)
                      setReferenceIsTemporary(false)
                    }}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Flex>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => handleUpload(event.currentTarget.files?.[0])}
              />
              <Box className="rounded-md bg-[var(--chatbox-background-secondary)] p-2 border border-solid border-[var(--chatbox-border-primary)]">
                <Stack gap="xs">
                  <Flex align="flex-end" gap="xs">
                    <Textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.currentTarget.value)}
                      placeholder={t('Describe the video you want to create...') || ''}
                      autosize
                      minRows={2}
                      maxRows={6}
                      className="flex-1"
                      styles={{ input: { border: 'none', backgroundColor: 'transparent' } }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void handleSubmit()
                        }
                      }}
                    />
                    <ActionIcon
                      size={34}
                      variant="filled"
                      color={isGenerating ? 'dark' : 'chatbox-brand'}
                      disabled={!prompt.trim() || !selectedModel}
                      onClick={isGenerating ? cancelVideoGeneration : () => void handleSubmit()}
                    >
                      {isGenerating ? <IconPlayerStop size={18} /> : <IconArrowUp size={18} />}
                    </ActionIcon>
                  </Flex>
                  <Flex gap="xs" align="center" wrap="wrap">
                    <ImageModelSelect modelGroups={modelGroups} onSelect={handleModelSelect}>
                      <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconMovie size={15} />}>
                        {modelDisplayName}
                      </Button>
                    </ImageModelSelect>
                    <Select
                      size="xs"
                      w={88}
                      allowDeselect={false}
                      value={String(duration)}
                      onChange={(value) => setDuration(Number(value))}
                      data={(selectedOption?.durations || [8]).map((value) => ({
                        value: String(value),
                        label: `${value}s`,
                      }))}
                    />
                    <Select
                      size="xs"
                      w={100}
                      allowDeselect={false}
                      value={aspectRatio}
                      onChange={(value) => value && setAspectRatio(value)}
                      data={selectedOption?.aspectRatios || ['16:9']}
                    />
                    <Select
                      size="xs"
                      w={100}
                      allowDeselect={false}
                      value={resolution}
                      onChange={(value) => value && setResolution(value)}
                      data={selectedOption?.resolutions || ['720p']}
                    />
                    <Tooltip
                      label={
                        selectedOption?.supportsImage
                          ? t('Add starting frame')
                          : t('This model does not support a starting frame')
                      }
                    >
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-sm"
                        disabled={!selectedOption?.supportsImage}
                        leftSection={<IconPhotoPlus size={16} />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {t('Start frame')}
                      </Button>
                    </Tooltip>
                    {selectedOption?.supportsAudio && (
                      <Checkbox
                        size="xs"
                        label={t('Audio')}
                        checked={generateAudio}
                        onChange={(event) => setGenerateAudio(event.currentTarget.checked)}
                      />
                    )}
                    <ActionIcon variant="subtle" color="gray" ml="auto" onClick={handleNew}>
                      <IconPlus size={18} />
                    </ActionIcon>
                  </Flex>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Flex>

        {!isSmallScreen && (
          <Box
            w={showHistory ? 250 : 0}
            className="shrink-0 overflow-hidden border-0 border-l border-solid border-[var(--chatbox-border-primary)] transition-all"
          >
            <Flex direction="column" w={250} h="100%">
              <Flex align="center" justify="space-between" px="sm" py="xs">
                <Text size="sm" fw={600}>
                  {t('Video History')}
                </Text>
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleNew}>
                  <IconPlus size={15} />
                </ActionIcon>
              </Flex>
              <ScrollArea flex={1}>
                <HistoryContent
                  records={history}
                  currentId={currentRecordId}
                  onSelect={handleHistorySelect}
                  onDelete={(id) => void deleteVideoGeneration(id)}
                />
              </ScrollArea>
            </Flex>
          </Box>
        )}
      </Flex>

      <SwipeableDrawer
        anchor="right"
        open={showMobileHistory}
        onOpen={() => setShowMobileHistory(true)}
        onClose={() => setShowMobileHistory(false)}
        PaperProps={{ sx: { width: '86vw', maxWidth: 380, backgroundImage: 'none' } }}
      >
        <Flex direction="column" h="100%" pt="var(--mobile-safe-area-inset-top, 0px)">
          <Flex align="center" justify="space-between" p="sm">
            <Text fw={600}>{t('Video History')}</Text>
            <ActionIcon variant="subtle" color="gray" onClick={() => setShowMobileHistory(false)}>
              <IconX size={18} />
            </ActionIcon>
          </Flex>
          <ScrollArea flex={1}>
            <HistoryContent
              records={history}
              currentId={currentRecordId}
              onSelect={handleHistorySelect}
              onDelete={(id) => void deleteVideoGeneration(id)}
            />
          </ScrollArea>
        </Flex>
      </SwipeableDrawer>
    </Page>
  )
}
