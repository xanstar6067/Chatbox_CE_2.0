import type { CopilotDetail } from '@shared/types'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useMemo } from 'react'
import { deleteCopilotMedia, getRemovedCopilotMediaKeys } from '@/packages/copilot-media'
import * as remote from '@/packages/remote'
import storage, { StorageKey } from '@/storage'
import { useLanguage } from '@/stores/settingsStore'

const myCopilotsAtom = atomWithStorage<CopilotDetail[]>(StorageKey.MyCopilots, [], storage)

export function useMyCopilots() {
  const [copilots, setCopilots] = useAtom(myCopilotsAtom)

  // Sort my copilots: starred first
  const sortedCopilots = useMemo(() => {
    return [...copilots.filter((item) => item.starred), ...copilots.filter((item) => !item.starred)]
  }, [copilots])

  const addOrUpdate = (target: CopilotDetail) => {
    setCopilots(async (prev) => {
      const copilots = await prev
      let found = false
      const newCopilots = copilots.map((c) => {
        if (c.id === target.id) {
          found = true
          return {
            ...c,
            ...target,
            updatedAt: Date.now(),
          }
        }
        return c
      })
      if (!found) {
        newCopilots.unshift({
          ...target,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
      void deleteCopilotMedia(getRemovedCopilotMediaKeys(copilots, newCopilots), storage)
      return newCopilots
    })
  }

  const remove = (id: string) => {
    setCopilots(async (prev) => {
      const copilots = await prev
      const nextCopilots = copilots.filter((c) => c.id !== id)
      void deleteCopilotMedia(getRemovedCopilotMediaKeys(copilots, nextCopilots), storage)
      return nextCopilots
    })
  }

  return {
    copilots: sortedCopilots,
    addOrUpdate,
    remove,
  }
}

export function useRemoteCopilotTags() {
  const language = useLanguage()
  const { data: tags, ...others } = useQuery({
    queryKey: ['remote-copilot-tags', language],
    queryFn: () => remote.listCopilotTags(language),
    initialData: [],
    initialDataUpdatedAt: 0,
    staleTime: 3600 * 1000,
  })
  return { tags, ...others }
}

type RemoteCopilotsByCursorFilters = {
  limit?: number
  tag?: string
  search?: string
}

export function useRemoteCopilotsByCursor(filters?: RemoteCopilotsByCursorFilters) {
  const language = useLanguage()
  const { limit = 12, tag, search } = filters ?? {}

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, ...others } = useInfiniteQuery({
    queryKey: ['remote-copilots-cursor', language, limit, tag, search],
    queryFn: ({ pageParam }) => remote.listCopilotsByCursor(language, { limit, cursor: pageParam, tag, search }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  })

  const copilots = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data])

  return {
    copilots,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    ...others,
  }
}
