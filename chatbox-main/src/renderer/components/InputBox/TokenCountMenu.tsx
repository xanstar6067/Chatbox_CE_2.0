import { Box, Flex, Menu, Text } from '@mantine/core'
import { formatNumber } from '@shared/utils'
import { IconFileZip } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import MaxContextMessageCountSlider from '../common/MaxContextMessageCountSlider'
import { ScalableIcon } from '../common/ScalableIcon'

type Props = {
  currentInputTokens: number
  contextTokens: number
  totalTokens: number
  isCalculating?: boolean
  pendingTasks?: number
  totalContextMessages?: number
  contextWindow?: number
  currentMessageCount?: number
  maxContextMessageCount?: number
  children?: React.ReactNode
  onCompressClick?: () => void
  onMaxContextMessageCountChange?: (value: number) => void
}

const TokenCountMenu: FC<Props> = ({
  currentInputTokens,
  contextTokens,
  totalTokens,
  isCalculating = false,
  pendingTasks,
  totalContextMessages,
  contextWindow,
  currentMessageCount,
  maxContextMessageCount,
  children,
  onCompressClick,
  onMaxContextMessageCountChange,
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  const maxContextMessageCountControl = maxContextMessageCount !== undefined &&
    onMaxContextMessageCountChange !== undefined && (
      <Box px="sm" py="xs" onClick={(event) => event.stopPropagation()}>
        <MaxContextMessageCountSlider
          value={maxContextMessageCount}
          onChange={onMaxContextMessageCountChange}
          wrapperProps={{ gap: 'xxs' }}
          labelProps={{ fw: 500 }}
        />
      </Box>
    )

  return (
    <Menu
      trigger={isSmallScreen ? 'click' : 'hover'}
      openDelay={100}
      closeDelay={100}
      position="top"
      shadow="md"
      keepMounted
      transitionProps={{
        transition: 'pop',
        duration: 200,
      }}
    >
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown w={isSmallScreen ? 'calc(100vw - 32px)' : 400} maw="calc(100vw - 16px)">
        <Flex justify="space-between" align="center" px="xs" pt="xs" pb="4">
          <Text size="sm" fw={600}>
            {t('Estimated Token Usage')}
          </Text>
        </Flex>

        <Menu.Item disabled style={{ cursor: 'default' }}>
          <Flex justify="space-between" align="center" gap="xs">
            <Text size="sm">{t('Current input')}:</Text>
            <Text size="sm" fw={500}>
              {formatNumber(currentInputTokens)}
            </Text>
          </Flex>
        </Menu.Item>

        <Menu.Item disabled style={{ cursor: 'default' }}>
          <Flex justify="space-between" align="center" gap="xs">
            <Text size="sm">{t('Context')}:</Text>
            <Flex align="center" gap="xs">
              <Text size="sm" fw={500}>
                {isCalculating ? '~' : ''}
                {formatNumber(contextTokens)}
              </Text>
              {isCalculating &&
                pendingTasks !== undefined &&
                totalContextMessages !== undefined &&
                totalContextMessages > 0 && (
                  <Text size="xs" c="dimmed">
                    ({Math.max(0, totalContextMessages - pendingTasks)}/{totalContextMessages})
                  </Text>
                )}
            </Flex>
          </Flex>
        </Menu.Item>

        {maxContextMessageCount !== undefined && currentMessageCount !== undefined && (
          <Menu.Item disabled style={{ cursor: 'default' }}>
            <Flex justify="space-between" align="center" gap="xs">
              <Text size="sm">{t('Context messages')}:</Text>
              <Text size="sm" fw={500}>
                {maxContextMessageCount === Number.MAX_SAFE_INTEGER
                  ? currentMessageCount
                  : `${currentMessageCount} / ${maxContextMessageCount}`}
              </Text>
            </Flex>
          </Menu.Item>
        )}

        <Menu.Divider />

        <Menu.Item disabled style={{ cursor: 'default' }}>
          <Flex justify="space-between" align="center" gap="xs">
            <Text size="sm" fw={600}>
              {t('Total')}:
            </Text>
            <Text size="sm" fw={600}>
              {formatNumber(totalTokens)}
            </Text>
          </Flex>
        </Menu.Item>

        {contextWindow && (
          <Menu.Item disabled style={{ cursor: 'default' }}>
            <Flex justify="space-between" align="center" gap="xs">
              <Text size="sm">{t('Model limit')}:</Text>
              <Text size="sm" fw={500}>
                {formatNumber(contextWindow)}
              </Text>
            </Flex>
          </Menu.Item>
        )}

        {maxContextMessageCountControl && (
          <>
            <Menu.Divider />
            {maxContextMessageCountControl}
          </>
        )}

        {onCompressClick && contextTokens > 0 && (
          <>
            <Menu.Divider />
            <Menu.Item
              leftSection={<ScalableIcon icon={IconFileZip} size={16} />}
              onClick={onCompressClick}
              color="chatbox-brand"
            >
              {t('Compress Conversation')}
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

export default TokenCountMenu
