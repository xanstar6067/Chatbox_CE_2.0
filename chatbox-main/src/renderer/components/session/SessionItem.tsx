import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Flex, Text } from '@mantine/core'
import type { SessionMeta } from '@shared/types'
import { IconArrowsSort, IconCopy, IconDots, IconEdit, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react'
import clsx from 'clsx'
import { memo, type ReactNode, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { getLogger } from '@/lib/utils'
import { router } from '@/router'
import {
  deleteSession as deleteSessionStore,
  getSession,
  updateSession as updateSessionStore,
} from '@/stores/chatStore'
import { copyAndSwitchSession, switchCurrentSession } from '@/stores/sessionActions'
import { useUIStore } from '@/stores/uiStore'
import ActionMenu, { type ActionMenuItemProps } from '../ActionMenu'
import { AssistantAvatar } from '../common/Avatar'
import { ScalableIcon } from '../common/ScalableIcon'

const log = getLogger('session-item')

export interface Props {
  session: SessionMeta
  selected: boolean
  /** Starts the list's reorder mode. When omitted, the "Reorder" menu item is hidden. */
  onStartReorder?: () => void
  /** Reorder mode: the row is not clickable and the menu is replaced by this drag handle. */
  dragHandle?: ReactNode
}

function SessionItem(props: Props) {
  const { session, selected, onStartReorder, dragHandle } = props
  const reordering = dragHandle !== undefined
  const { t } = useTranslation()
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const onClick = () => {
    if (reordering) {
      return
    }
    switchCurrentSession(session.id)
    if (isSmallScreen) {
      setShowSidebar(false)
    }
  }
  const isSmallScreen = useIsSmallScreen()
  // const smallSize = theme.typography.pxToRem(20)

  const [menuOpened, setMenuOpened] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)

  const actionMenuItems = useMemo<ActionMenuItemProps[]>(
    () => [
      {
        text: t('Edit'),
        icon: IconEdit,
        onClick: async () => {
          await NiceModal.show('session-settings', {
            session: await getSession(session.id),
          })
        },
      },
      {
        text: t('Copy'),
        icon: IconCopy,
        onClick: () => {
          copyAndSwitchSession(session)
        },
      },
      {
        text: session.starred ? t('Unstar') : t('Star'),
        icon: session.starred ? IconStarFilled : IconStar,
        onClick: () => {
          void updateSessionStore(session.id, { starred: !session.starred })
        },
      },
      ...(onStartReorder
        ? [
            {
              text: t('Reorder'),
              icon: IconArrowsSort,
              onClick: () => onStartReorder(),
            } satisfies ActionMenuItemProps,
          ]
        : []),
      { divider: true },
      {
        doubleCheck: true,
        text: t('Delete'),
        icon: IconTrash,
        disabled: deleting,
        onClick: async () => {
          if (deletingRef.current) {
            return
          }
          deletingRef.current = true
          setDeleting(true)
          try {
            await deleteSessionStore(session.id)
            // Only navigate if deleting the currently selected session
            if (selected) {
              router.navigate({ to: '/', replace: true })
            }
          } catch (error) {
            log.error(`failed to delete session ${session.id}:`, error)
            deletingRef.current = false
            setDeleting(false)
          }
        },
      },
    ],
    [session, selected, t, deleting, onStartReorder]
  )

  return (
    <Flex
      align="center"
      className={clsx(
        'rounded-sm group/session-item',
        reordering ? 'bg-chatbox-background-gray-secondary' : 'cursor-pointer',
        reordering || isSmallScreen
          ? ''
          : selected
            ? 'bg-chatbox-background-brand-secondary'
            : 'hover:bg-chatbox-background-gray-secondary'
      )}
      mx="xs"
      px="xs"
      py={10}
      gap={10}
      onClick={onClick}
    >
      <AssistantAvatar
        avatarKey={session.assistantAvatarKey}
        picUrl={session.picUrl}
        sessionType={session.type}
        size="sm"
        type="chat"
        c={selected ? 'chatbox-brand' : 'chatbox-primary'}
      />

      <Text span flex={1} lineClamp={1} c={selected ? 'chatbox-brand' : 'chatbox-primary'}>
        {session.name}
      </Text>

      {reordering ? (
        dragHandle
      ) : (
        <ActionMenu
          type="desktop"
          items={actionMenuItems}
          position="bottom-start"
          opened={menuOpened}
          onChange={(opened) => setMenuOpened(opened)}
        >
          <ActionIcon
            variant="transparent"
            size={20}
            color={session.starred ? 'chatbox-brand' : 'chatbox-tertiary'}
            className={
              isSmallScreen || session.starred || menuOpened ? '' : 'group-hover/session-item:visible invisible'
            }
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
            }}
          >
            {session.starred ? (
              <ScalableIcon icon={IconStarFilled} className="text-inherit" size={16} />
            ) : (
              <ScalableIcon icon={IconDots} className="text-inherit" size={16} />
            )}
          </ActionIcon>
        </ActionMenu>
      )}
    </Flex>
  )
}

export default memo(SessionItem)
