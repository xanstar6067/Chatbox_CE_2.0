import { ModelProviderEnum, type ProviderModelInfo } from '@shared/types'
import { normalizeOpenAIApiHostAndPath } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { apiRequest } from '@/utils/request'
import { useProviders } from './useProviders'

export interface VideoModelOption {
  modelId: string
  displayName: string
  durations: number[]
  resolutions: string[]
  aspectRatios: string[]
  supportsImage: boolean
  supportsAudio: boolean
}

export interface VideoModelGroup {
  label: string
  providerId: string
  models: VideoModelOption[]
}

const GOOGLE_VEO_MODELS: VideoModelOption[] = [
  {
    modelId: 'veo-3.1-generate-preview',
    displayName: 'Veo 3.1',
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16'],
    supportsImage: true,
    supportsAudio: true,
  },
  {
    modelId: 'veo-3.1-fast-generate-preview',
    displayName: 'Veo 3.1 Fast',
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16'],
    supportsImage: true,
    supportsAudio: true,
  },
  {
    modelId: 'veo-3.1-lite-generate-preview',
    displayName: 'Veo 3.1 Lite',
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16'],
    supportsImage: true,
    supportsAudio: true,
  },
]

const XAI_FALLBACK_MODELS: VideoModelOption[] = [
  {
    modelId: 'grok-imagine-video-1.5',
    displayName: 'Grok Imagine Video 1.5',
    durations: [4, 6, 8, 10, 15],
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    supportsImage: true,
    supportsAudio: true,
  },
]

const OPENROUTER_FALLBACK_MODELS: VideoModelOption[] = [
  {
    modelId: 'google/veo-3.1-fast',
    displayName: 'Google: Veo 3.1 Fast',
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16'],
    supportsImage: true,
    supportsAudio: true,
  },
  {
    modelId: 'google/veo-3.1-lite',
    displayName: 'Google: Veo 3.1 Lite',
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16'],
    supportsImage: true,
    supportsAudio: true,
  },
]

function manualOption(model: ProviderModelInfo, fallback: VideoModelOption): VideoModelOption {
  return {
    ...fallback,
    modelId: model.modelId,
    displayName: model.nickname || model.modelId,
  }
}

function mergeModels(remote: VideoModelOption[], manual: ProviderModelInfo[], fallback: VideoModelOption) {
  const map = new Map(remote.map((model) => [model.modelId, model]))
  for (const model of manual.filter((item) => item.type === 'video')) {
    map.set(model.modelId, manualOption(model, map.get(model.modelId) || fallback))
  }
  return [...map.values()]
}

function useOpenRouterVideoModels(enabled: boolean) {
  const settings = useSettingsStore((state) => state.providers?.[ModelProviderEnum.OpenRouter])
  const apiHost = (settings?.apiHost || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  return useQuery({
    queryKey: ['openrouter-video-models', apiHost],
    enabled,
    staleTime: 3600 * 1000,
    queryFn: async () => {
      const response = await apiRequest.get(
        `${apiHost}/videos/models`,
        settings?.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
        { retry: 1, useProxy: settings?.useProxy }
      )
      const payload = (await response.json()) as {
        data?: Array<{
          id: string
          name?: string
          supported_durations?: number[]
          supported_resolutions?: string[]
          supported_aspect_ratios?: string[]
          supported_frame_images?: string[] | null
          generate_audio?: boolean
        }>
      }
      return (payload.data || []).map(
        (model): VideoModelOption => ({
          modelId: model.id,
          displayName: model.name || model.id,
          durations: model.supported_durations?.length ? model.supported_durations : [4, 6, 8],
          resolutions: model.supported_resolutions?.length ? model.supported_resolutions : ['720p'],
          aspectRatios: model.supported_aspect_ratios?.length ? model.supported_aspect_ratios : ['16:9'],
          supportsImage: Boolean(model.supported_frame_images?.includes('first_frame')),
          supportsAudio: Boolean(model.generate_audio),
        })
      )
    },
  }).data
}

function useXaiVideoModels(enabled: boolean) {
  const settings = useSettingsStore((state) => state.providers?.[ModelProviderEnum.XAI])
  const apiHost = normalizeOpenAIApiHostAndPath(
    { apiHost: settings?.apiHost },
    { apiHost: 'https://api.x.ai/v1' }
  ).apiHost
  return useQuery({
    queryKey: ['xai-video-models', apiHost],
    enabled,
    staleTime: 3600 * 1000,
    queryFn: async () => {
      const response = await apiRequest.get(
        `${apiHost}/video-generation-models`,
        { Authorization: `Bearer ${settings?.apiKey || ''}` },
        { retry: 1, useProxy: settings?.useProxy }
      )
      const payload = (await response.json()) as {
        models?: Array<{ id: string; name?: string }>
        data?: Array<{ id: string; name?: string }>
      }
      const models = payload.models || payload.data || []
      return models.map((model) => manualOption({ modelId: model.id, nickname: model.name }, XAI_FALLBACK_MODELS[0]))
    },
  }).data
}

export function useVideoModelGroups(): VideoModelGroup[] {
  const { providers } = useProviders()
  const settings = useSettingsStore((state) => state.providers)
  const google = providers.find((provider) => provider.id === ModelProviderEnum.Gemini)
  const xai = providers.find((provider) => provider.id === ModelProviderEnum.XAI)
  const openRouter = providers.find((provider) => provider.id === ModelProviderEnum.OpenRouter)
  const xaiRemote = useXaiVideoModels(Boolean(xai))
  const openRouterRemote = useOpenRouterVideoModels(Boolean(openRouter))

  return useMemo(() => {
    const groups: VideoModelGroup[] = []
    if (google) {
      groups.push({
        label: google.name,
        providerId: google.id,
        models: mergeModels(GOOGLE_VEO_MODELS, settings?.[google.id]?.models || [], GOOGLE_VEO_MODELS[0]),
      })
    }
    if (xai) {
      groups.push({
        label: xai.name,
        providerId: xai.id,
        models: mergeModels(
          xaiRemote?.length ? xaiRemote : XAI_FALLBACK_MODELS,
          settings?.[xai.id]?.models || [],
          XAI_FALLBACK_MODELS[0]
        ),
      })
    }
    if (openRouter) {
      groups.push({
        label: openRouter.name,
        providerId: openRouter.id,
        models: mergeModels(
          openRouterRemote?.length ? openRouterRemote : OPENROUTER_FALLBACK_MODELS,
          settings?.[openRouter.id]?.models || [],
          OPENROUTER_FALLBACK_MODELS[0]
        ),
      })
    }
    return groups
  }, [google, xai, openRouter, xaiRemote, openRouterRemote, settings])
}
