import { createTheme, type ThemeOptions } from '@mui/material/styles'
import { useLayoutEffect, useMemo } from 'react'
import { applyThemeColors, findTheme } from '@/lib/theme-presets'
import { getLogger } from '@/lib/utils'
import { settingsStore, useLanguage, useSettingsStore } from '@/stores/settingsStore'
import { uiStore, useUIStore } from '@/stores/uiStore'
import { type Language, Theme, type ThemeColors, type ThemeMode } from '../../shared/types'
import platform from '../platform'
import DesktopPlatform from '../platform/desktop_platform'

const log = getLogger('app-theme')

/**
 * Color scheme imposed by the active appearance theme, or `undefined` when the
 * theme follows the Light / Dark / System setting (the Classic theme).
 */
function getForcedThemeMode(): ThemeMode | undefined {
  const { themePresetId, customThemes } = settingsStore.getState()
  return findTheme(themePresetId, customThemes).mode
}

export const switchTheme = async (theme: Theme) => {
  const forcedMode = getForcedThemeMode()
  let finalTheme = 'light' as 'light' | 'dark'
  if (forcedMode) {
    finalTheme = forcedMode
  } else if (theme === Theme.System) {
    finalTheme = (await platform.shouldUseDarkColors()) ? 'dark' : 'light'
  } else {
    finalTheme = theme === Theme.Dark ? 'dark' : 'light'
  }
  uiStore.setState({
    realTheme: finalTheme,
  })
  localStorage.setItem('initial-theme', finalTheme)
  if (platform instanceof DesktopPlatform) {
    await platform.switchTheme(finalTheme)
  }
}

/** The appearance theme currently selected in Settings → Appearance Themes. */
export function useActiveTheme() {
  const themePresetId = useSettingsStore((state) => state.themePresetId)
  const customThemes = useSettingsStore((state) => state.customThemes)
  return useMemo(() => findTheme(themePresetId, customThemes), [themePresetId, customThemes])
}

export default function useAppTheme() {
  const theme = useSettingsStore((state) => state.theme)
  const realTheme = useUIStore((state) => state.realTheme)
  const language = useLanguage()
  const activeTheme = useActiveTheme()

  // biome-ignore lint/correctness/useExhaustiveDependencies: switchTheme reads the active theme from the store
  useLayoutEffect(() => {
    switchTheme(theme)
  }, [theme, activeTheme.mode])

  useLayoutEffect(() => {
    platform.onSystemThemeChange(() => {
      const theme = settingsStore.getState().theme
      switchTheme(theme)
    })
  }, [])

  useLayoutEffect(() => {
    // paint the active appearance theme over the defaults from globals.css
    log.info(
      `applying theme ${activeTheme.id} (${activeTheme.builtin ? 'built-in' : 'custom'}, mode=${activeTheme.mode ?? 'follows setting'})`
    )
    applyThemeColors(activeTheme.colors)
  }, [activeTheme])

  useLayoutEffect(() => {
    // update material-ui theme
    document.querySelector('html')?.setAttribute('data-theme', realTheme)
    // update tailwindcss theme
    if (realTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [realTheme])

  const themeObj = useMemo(
    () => createTheme(getThemeDesign(realTheme, language, activeTheme.colors)),
    [realTheme, language, activeTheme]
  )
  return themeObj
}

export function getThemeDesign(
  realTheme: 'light' | 'dark',
  language: Language,
  // MUI 内部无法处理 css 变量，需要使用具体颜色值，因此自定义主题的颜色需要在这里显式传入
  colors?: ThemeColors
): ThemeOptions {
  const background = colors?.['background-primary'] ?? (realTheme === 'dark' ? '#242424' : undefined)
  return {
    palette: {
      mode: realTheme,
      ...(background
        ? {
            background: {
              default: background,
              paper: background,
            },
          }
        : {}),
    },
    components: {
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            backgroundColor: realTheme === 'dark' ? (colors?.['background-tertiary'] ?? '#333333') : undefined,
            color: realTheme === 'dark' ? (colors?.['tint-primary'] ?? '#ffffff') : undefined,
          },
        },
      },
    },
    typography: {
      // In Chinese and Japanese the characters are usually larger,
      // so a smaller fontsize may be appropriate.
      ...(language === 'ar'
        ? {
            fontFamily: 'Cairo, Arial, sans-serif',
          }
        : {}),
      fontSize: 14,
    },
    direction: language === 'ar' ? 'rtl' : 'ltr',
    breakpoints: {
      values: {
        xs: 0,
        sm: 640, // 修改sm的值与tailwindcss保持一致
        md: 900,
        lg: 1200,
        xl: 1536,
      },
    },
  }
}
