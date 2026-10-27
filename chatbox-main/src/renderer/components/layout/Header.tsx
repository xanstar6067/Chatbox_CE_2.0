import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Flex, Text, Tooltip } from '@mantine/core'
import type { Session } from '@shared/types'
import { IconLayoutSidebarLeftExpand, IconMenu2, IconPencil } from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import CostDisplay from '@/components/chat/CostDisplay'
import useNeedRoomForWinControls from '@/hooks/useNeedRoomForWinControls'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { getSessionCost } from '@/packages/usage-stats/session-cost'
import { updateSession } from '@/stores/chatStore'
import { scheduleGenerateNameAndThreadName } from '@/stores/sessionActions'
import * as settingActions from '@/stores/settingActions'
import { useUIStore } from '@/stores/uiStore'
import Divider from '../common/Divider'
import { ScalableIcon } from '../common/ScalableIcon'
import Toolbar from './Toolbar'
import WindowControls from './WindowControls'

export default function Header(props: { session: Session }) {
  const { t } = useTranslation()
  const showSidebar = useUIStore((s) => s.showSidebar)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)

  const isSmallScreen = useIsSmallScreen()
  const { needRoomForMacWindowControls } = useNeedRoomForWinControls()

  const { session: currentSession } = props

  useEffect(() => {
    const autoGenerateTitle = settingActions.getAutoGenerateTitle()
    if (!autoGenerateTitle) {
      return
    }

    const hasGeneratingMessage = currentSession.messages.some((msg) => msg.generating)

    if (hasGeneratingMessage || currentSession.messages.length < 2) {
      return
    }

    if (currentSession.name === 'Untitled') {
      scheduleGenerateNameAndThreadName(currentSession.id)
    }
  }, [currentSession])

  const editCurrentSession = () => {
    if (!currentSession) {
      return
    }
    void NiceModal.show('session-settings', { session: currentSession })
  }

  return (
    <>
      <Flex
        h={48}
        align="center"
        px="md"
        className={clsx('flex-none title-bar', isSmallScreen ? 'bg-chatbox-background-primary' : '')}
      >
        {(!showSidebar || isSmallScreen) && (
          <Flex align="center" className={clsx('shrink-0', needRoomForMacWindowControls ? 'pl-20' : '')}>
            <ActionIcon
              className="controls"
              variant="subtle"
              size={isSmallScreen ? 24 : 20}
              color={isSmallScreen ? 'chatbox-secondary' : 'chatbox-tertiary'}
              mr="xs"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {isSmallScreen ? <IconMenu2 /> : <IconLayoutSidebarLeftExpand />}
            </ActionIcon>
          </Flex>
        )}

        <Flex align="center" flex={1} className="min-w-0" {...(isSmallScreen ? { pr: 4 } : {})}>
          <Text
            fw={600}
            size="18px"
            lineClamp={isSmallScreen ? undefined : 1}
            truncate={isSmallScreen ? 'end' : undefined}
            title={currentSession?.name}
            className="min-w-0 flex-1"
          >
            {currentSession?.name}
          </Text>
          <Tooltip label={t('Customize settings for the current conversation')}>
            <ActionIcon
              className="controls"
              variant="subtle"
              color={isSmallScreen ? 'chatbox-secondary' : 'chatbox-tertiary'}
              size={isSmallScreen ? 24 : 16}
              ml={4}
              style={{ flexShrink: 0 }}
              aria-label={String(t('Customize settings for the current conversation'))}
              onClick={editCurrentSession}
            >
              {isSmallScreen ? <IconPencil strokeWidth={1.8} /> : <ScalableIcon icon={IconPencil} size={14} />}
            </ActionIcon>
          </Tooltip>
        </Flex>

        {(currentSession.type === 'chat' || !currentSession.type) && (
          <CostDisplay
            summary={getSessionCost(currentSession)}
            chat
            compact={isSmallScreen}
            resetAt={currentSession.costResetAt}
            onReset={() => updateSession(currentSession.id, { costResetAt: Date.now() })}
          />
        )}
        <Toolbar sessionId={currentSession.id} />

        <WindowControls className="-mr-3 ml-2" />
      </Flex>

      <Divider />
    </>
  )
}
