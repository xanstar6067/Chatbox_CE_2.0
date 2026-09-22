import {
  CLASSIC_THEME_ID,
  type CustomTheme,
  THEME_COLOR_TOKENS,
  type ThemeColors,
  type ThemeColorToken,
  type ThemeMode,
} from '@shared/types'
import { getLogger } from './utils'

const log = getLogger('theme-presets')

/**
 * Built-in palettes.
 *
 * `classicLightColors` / `classicDarkColors` mirror the values declared in
 * `src/renderer/static/globals.css`; they are the fallback used whenever a saved
 * theme does not define a token, and the starting point of the theme editor.
 */
export const classicLightColors: ThemeColors = {
  'tint-primary': '#212529',
  'tint-secondary': '#495057',
  'tint-tertiary': '#868e96',
  'tint-brand': '#228be6',
  'tint-placeholder': '#adb5bd',
  'tint-disabled': '#adb5bd',
  'tint-gray': '#868e96',
  'tint-white': '#ffffff',
  'tint-black': '#000000',
  'tint-success': '#12b886',
  'tint-warning': '#fab005',
  'tint-error': '#fa5252',
  'tint-error-disabled': '#ff8787',

  'border-primary': '#dee2e6',
  'border-secondary': '#ced4da',
  'border-brand': '#228be6',
  'border-success': '#12b886',
  'border-warning': '#fab005',
  'border-error': '#fa5252',

  'background-primary': '#ffffff',
  'background-primary-hover': '#f8f9fa',
  'background-secondary': '#f1f3f5',
  'background-secondary-hover': '#e9ecef',
  'background-tertiary': '#dee2e6',
  'background-tertiary-hover': '#ced4da',
  'background-disabled': '#e9ecef',

  'background-brand-primary': '#228be6',
  'background-brand-primary-hover': '#1c7ed6',
  'background-brand-secondary': 'rgba(34, 139, 230, 0.08)',
  'background-brand-secondary-hover': 'rgba(34, 139, 230, 0.16)',

  'background-gray-primary': '#868e96',
  'background-gray-primary-hover': '#495057',
  'background-gray-secondary': 'rgba(134, 142, 150, 0.1)',
  'background-gray-secondary-hover': 'rgba(134, 142, 150, 0.12)',

  'background-success-primary': '#12b886',
  'background-success-primary-hover': '#0ca678',
  'background-success-secondary': 'rgba(18, 184, 134, 0.1)',
  'background-success-secondary-hover': 'rgba(18, 184, 134, 0.12)',

  'background-error-primary': '#fa5252',
  'background-error-primary-hover': '#f03e3e',
  'background-error-secondary': 'rgba(250, 82, 82, 0.1)',
  'background-error-secondary-hover': 'rgba(250, 82, 82, 0.12)',

  'background-warning-primary': '#fab005',
  'background-warning-primary-hover': '#f59f00',
  'background-warning-secondary': 'rgba(250, 176, 5, 0.1)',
  'background-warning-secondary-hover': 'rgba(250, 176, 5, 0.12)',

  'background-mask-overlay': 'rgba(59, 59, 59, 0.64)',
  'background-mask-lighten': 'rgba(255, 255, 255, 0.76)',
}

export const classicDarkColors: ThemeColors = {
  'tint-primary': '#ffffff',
  'tint-secondary': '#ced4da',
  'tint-tertiary': '#828282',
  'tint-brand': '#4dabf7',
  'tint-placeholder': '#828282',
  'tint-disabled': '#696969',
  'tint-gray': '#868e96',
  'tint-white': '#ffffff',
  'tint-black': '#000000',
  'tint-success': '#63e6be',
  'tint-warning': '#ffe066',
  'tint-error': '#f03e3e',
  'tint-error-disabled': 'rgba(224, 49, 49, 0.5)',

  'border-primary': '#495057',
  'border-secondary': '#868e96',
  'border-brand': '#1971c2',
  'border-success': '#63e6be',
  'border-warning': '#ffe066',
  'border-error': '#f03e3e',

  'background-primary': '#242424',
  'background-primary-hover': '#1f1f1f',
  'background-secondary': '#3b3b3b',
  'background-secondary-hover': '#495057',
  'background-tertiary': '#424242',
  'background-tertiary-hover': '#696969',
  'background-disabled': '#2e2e2e',

  'background-brand-primary': '#1971c2',
  'background-brand-primary-hover': '#1864ab',
  'background-brand-secondary': 'rgba(28, 126, 214, 0.2)',
  'background-brand-secondary-hover': 'rgba(34, 139, 230, 0.24)',

  'background-gray-primary': '#343a40',
  'background-gray-primary-hover': '#212529',
  'background-gray-secondary': 'rgba(134, 142, 150, 0.15)',
  'background-gray-secondary-hover': 'rgba(134, 142, 150, 0.2)',

  'background-success-primary': '#099268',
  'background-success-primary-hover': '#087f5b',
  'background-success-secondary': 'rgba(18, 184, 134, 0.15)',
  'background-success-secondary-hover': 'rgba(18, 184, 134, 0.2)',

  'background-error-primary': '#e03131',
  'background-error-primary-hover': '#c92a2a',
  'background-error-secondary': 'rgba(250, 82, 82, 0.15)',
  'background-error-secondary-hover': 'rgba(250, 82, 82, 0.2)',

  'background-warning-primary': '#f08c00',
  'background-warning-primary-hover': '#e67700',
  'background-warning-secondary': 'rgba(250, 176, 5, 0.15)',
  'background-warning-secondary-hover': 'rgba(250, 176, 5, 0.2)',

  'background-mask-overlay': 'rgba(31, 31, 31, 0.78)',
  'background-mask-lighten': 'rgba(173, 181, 189, 0.48)',
}

/** Soft, always-light palette with warm paper surfaces. */
const softLightColors: ThemeColors = {
  'tint-primary': '#1a1a19',
  'tint-secondary': '#4a4a47',
  'tint-tertiary': '#8b8b85',
  'tint-brand': '#2f6feb',
  'tint-placeholder': '#a8a8a2',
  'tint-disabled': '#b6b6b0',
  'tint-gray': '#8b8b85',
  'tint-white': '#ffffff',
  'tint-black': '#000000',
  'tint-success': '#0f9d76',
  'tint-warning': '#d98a00',
  'tint-error': '#e04a4a',
  'tint-error-disabled': '#f09a9a',

  'border-primary': '#e4e3de',
  'border-secondary': '#d3d2cc',
  'border-brand': '#2f6feb',
  'border-success': '#0f9d76',
  'border-warning': '#d98a00',
  'border-error': '#e04a4a',

  'background-primary': '#fdfdfb',
  'background-primary-hover': '#f6f6f2',
  'background-secondary': '#f1f0ec',
  'background-secondary-hover': '#e8e7e2',
  'background-tertiary': '#e0dfd9',
  'background-tertiary-hover': '#d3d2cb',
  'background-disabled': '#eeedea',

  'background-brand-primary': '#2f6feb',
  'background-brand-primary-hover': '#2559c8',
  'background-brand-secondary': 'rgba(47, 111, 235, 0.08)',
  'background-brand-secondary-hover': 'rgba(47, 111, 235, 0.16)',

  'background-gray-primary': '#8b8b85',
  'background-gray-primary-hover': '#4a4a47',
  'background-gray-secondary': 'rgba(139, 139, 133, 0.1)',
  'background-gray-secondary-hover': 'rgba(139, 139, 133, 0.14)',

  'background-success-primary': '#0f9d76',
  'background-success-primary-hover': '#0c8462',
  'background-success-secondary': 'rgba(15, 157, 118, 0.1)',
  'background-success-secondary-hover': 'rgba(15, 157, 118, 0.14)',

  'background-error-primary': '#e04a4a',
  'background-error-primary-hover': '#c73a3a',
  'background-error-secondary': 'rgba(224, 74, 74, 0.1)',
  'background-error-secondary-hover': 'rgba(224, 74, 74, 0.14)',

  'background-warning-primary': '#d98a00',
  'background-warning-primary-hover': '#b97400',
  'background-warning-secondary': 'rgba(217, 138, 0, 0.1)',
  'background-warning-secondary-hover': 'rgba(217, 138, 0, 0.14)',

  'background-mask-overlay': 'rgba(40, 40, 36, 0.56)',
  'background-mask-lighten': 'rgba(253, 253, 251, 0.78)',
}

/** Pure black palette that saves power on OLED screens. */
const oledColors: ThemeColors = {
  'tint-primary': '#f2f2f2',
  'tint-secondary': '#c2c2c2',
  'tint-tertiary': '#7d7d7d',
  'tint-brand': '#4dabf7',
  'tint-placeholder': '#6b6b6b',
  'tint-disabled': '#5a5a5a',
  'tint-gray': '#7d7d7d',
  'tint-white': '#ffffff',
  'tint-black': '#000000',
  'tint-success': '#4ddbb0',
  'tint-warning': '#ffd43b',
  'tint-error': '#ff6b6b',
  'tint-error-disabled': 'rgba(255, 107, 107, 0.5)',

  'border-primary': '#262626',
  'border-secondary': '#3a3a3a',
  'border-brand': '#1c7ed6',
  'border-success': '#2f9e79',
  'border-warning': '#c79a00',
  'border-error': '#c93a3a',

  'background-primary': '#000000',
  'background-primary-hover': '#0a0a0a',
  'background-secondary': '#111111',
  'background-secondary-hover': '#1b1b1b',
  'background-tertiary': '#1f1f1f',
  'background-tertiary-hover': '#2b2b2b',
  'background-disabled': '#141414',

  'background-brand-primary': '#1c7ed6',
  'background-brand-primary-hover': '#1971c2',
  'background-brand-secondary': 'rgba(77, 171, 247, 0.16)',
  'background-brand-secondary-hover': 'rgba(77, 171, 247, 0.24)',

  'background-gray-primary': '#1f1f1f',
  'background-gray-primary-hover': '#2b2b2b',
  'background-gray-secondary': 'rgba(125, 125, 125, 0.14)',
  'background-gray-secondary-hover': 'rgba(125, 125, 125, 0.2)',

  'background-success-primary': '#12b886',
  'background-success-primary-hover': '#0ca678',
  'background-success-secondary': 'rgba(77, 219, 176, 0.14)',
  'background-success-secondary-hover': 'rgba(77, 219, 176, 0.2)',

  'background-error-primary': '#e03131',
  'background-error-primary-hover': '#c92a2a',
  'background-error-secondary': 'rgba(255, 107, 107, 0.14)',
  'background-error-secondary-hover': 'rgba(255, 107, 107, 0.2)',

  'background-warning-primary': '#d99e00',
  'background-warning-primary-hover': '#b98600',
  'background-warning-secondary': 'rgba(255, 212, 59, 0.14)',
  'background-warning-secondary-hover': 'rgba(255, 212, 59, 0.2)',

  'background-mask-overlay': 'rgba(0, 0, 0, 0.82)',
  'background-mask-lighten': 'rgba(255, 255, 255, 0.14)',
}

export type AppTheme = {
  id: string
  /** Built-in themes carry an i18n key, user themes carry the name typed by the user. */
  name: string
  builtin: boolean
  /** `undefined` means the theme follows the Light / Dark / System setting. */
  mode?: ThemeMode
  /** `undefined` means the theme keeps the stylesheet defaults (no CSS variable override). */
  colors?: ThemeColors
  /** i18n key, built-in themes only. */
  description?: string
}

export const builtinThemes: AppTheme[] = [
  {
    id: CLASSIC_THEME_ID,
    name: 'Classic Look',
    builtin: true,
    description: 'The original Chatbox look, following the Light / Dark / System setting',
  },
  {
    id: 'soft-light',
    name: 'Light',
    builtin: true,
    mode: 'light',
    colors: softLightColors,
    description: 'A soft, always-light palette with warm paper surfaces',
  },
  {
    id: 'oled-black',
    name: 'OLED Black',
    builtin: true,
    mode: 'dark',
    colors: oledColors,
    description: 'A pure black palette that saves power on OLED screens',
  },
]

/** Completes a partial palette with the classic palette of the matching mode. */
export function withFallbackColors(colors: Record<string, string> | undefined, mode: ThemeMode): ThemeColors {
  const base = mode === 'dark' ? classicDarkColors : classicLightColors
  const result = {} as ThemeColors
  for (const token of THEME_COLOR_TOKENS) {
    result[token] = colors?.[token] || base[token]
  }
  return result
}

export function customThemeToAppTheme(theme: CustomTheme): AppTheme {
  return {
    id: theme.id,
    name: theme.name,
    builtin: false,
    mode: theme.mode,
    colors: withFallbackColors(theme.colors, theme.mode),
  }
}

export function getAllThemes(customThemes?: CustomTheme[]): AppTheme[] {
  const saved = Array.isArray(customThemes) ? customThemes : []
  return [...builtinThemes, ...saved.map(customThemeToAppTheme)]
}

/** Missing theme ids already reported, so the fallback is logged once per id. */
const reportedMissingThemeIds = new Set<string>()

export function findTheme(themeId: string | undefined, customThemes?: CustomTheme[]): AppTheme {
  const theme = getAllThemes(customThemes).find((theme) => theme.id === themeId)
  if (theme) {
    return theme
  }
  // A selected theme that no longer exists means the app silently looks different
  // than the user left it, typically after a restore or a failed settings write.
  if (themeId && !reportedMissingThemeIds.has(themeId)) {
    reportedMissingThemeIds.add(themeId)
    log.warn(`theme ${themeId} not found, falling back to ${builtinThemes[0].id}`)
  }
  return builtinThemes[0]
}

/** Palette actually painted on screen, given the current light/dark mode. */
export function resolveThemeColors(theme: AppTheme, realTheme: ThemeMode): ThemeColors {
  if (theme.colors) {
    return theme.colors
  }
  return realTheme === 'dark' ? classicDarkColors : classicLightColors
}

export function toCssVariables(colors: ThemeColors): Record<string, string> {
  const style: Record<string, string> = {}
  for (const token of THEME_COLOR_TOKENS) {
    style[`--chatbox-${token}`] = colors[token]
  }
  return style
}

/** Writes (or clears) the theme overrides on the document root. */
export function applyThemeColors(colors: ThemeColors | undefined) {
  const root = document.documentElement
  const missingTokens: ThemeColorToken[] = []
  for (const token of THEME_COLOR_TOKENS) {
    const property = `--chatbox-${token}`
    if (colors) {
      if (!colors[token]) {
        missingTokens.push(token)
      }
      root.style.setProperty(property, colors[token])
    } else {
      root.style.removeProperty(property)
    }
  }
  // An incomplete palette paints empty CSS variables, which renders as unstyled
  // text on an unstyled background — worth naming the exact tokens.
  if (missingTokens.length) {
    log.warn(`theme applied with ${missingTokens.length} empty tokens: ${missingTokens.join(', ')}`)
  }
}

type ThemeTokenGroup = {
  /** i18n key */
  label: string
  tokens: ThemeColorToken[]
}

/** Grouping used by the theme editor. */
export const themeTokenGroups: ThemeTokenGroup[] = [
  {
    label: 'Text & Accent',
    tokens: [
      'tint-primary',
      'tint-secondary',
      'tint-tertiary',
      'tint-brand',
      'tint-placeholder',
      'tint-disabled',
      'tint-gray',
      'tint-white',
      'tint-black',
    ],
  },
  {
    label: 'Status Colors',
    tokens: ['tint-success', 'tint-warning', 'tint-error', 'tint-error-disabled'],
  },
  {
    label: 'Borders',
    tokens: ['border-primary', 'border-secondary', 'border-brand', 'border-success', 'border-warning', 'border-error'],
  },
  {
    label: 'Surfaces',
    tokens: [
      'background-primary',
      'background-primary-hover',
      'background-secondary',
      'background-secondary-hover',
      'background-tertiary',
      'background-tertiary-hover',
      'background-disabled',
    ],
  },
  {
    label: 'Accent Surfaces',
    tokens: [
      'background-brand-primary',
      'background-brand-primary-hover',
      'background-brand-secondary',
      'background-brand-secondary-hover',
      'background-gray-primary',
      'background-gray-primary-hover',
      'background-gray-secondary',
      'background-gray-secondary-hover',
    ],
  },
  {
    label: 'Status Surfaces',
    tokens: [
      'background-success-primary',
      'background-success-primary-hover',
      'background-success-secondary',
      'background-success-secondary-hover',
      'background-error-primary',
      'background-error-primary-hover',
      'background-error-secondary',
      'background-error-secondary-hover',
      'background-warning-primary',
      'background-warning-primary-hover',
      'background-warning-secondary',
      'background-warning-secondary-hover',
    ],
  },
  {
    label: 'Overlays',
    tokens: ['background-mask-overlay', 'background-mask-lighten'],
  },
]

/** i18n keys describing each token in the theme editor. */
export const themeTokenLabels: Record<ThemeColorToken, string> = {
  'tint-primary': 'Primary text',
  'tint-secondary': 'Secondary text',
  'tint-tertiary': 'Tertiary text',
  'tint-brand': 'Accent text',
  'tint-placeholder': 'Placeholder text',
  'tint-disabled': 'Disabled text',
  'tint-gray': 'Gray text',
  'tint-white': 'White',
  'tint-black': 'Black',
  'tint-success': 'Success text',
  'tint-warning': 'Warning text',
  'tint-error': 'Error text',
  'tint-error-disabled': 'Disabled error text',

  'border-primary': 'Primary border',
  'border-secondary': 'Secondary border',
  'border-brand': 'Accent border',
  'border-success': 'Success border',
  'border-warning': 'Warning border',
  'border-error': 'Error border',

  'background-primary': 'Primary surface',
  'background-primary-hover': 'Primary surface (hover)',
  'background-secondary': 'Secondary surface',
  'background-secondary-hover': 'Secondary surface (hover)',
  'background-tertiary': 'Tertiary surface',
  'background-tertiary-hover': 'Tertiary surface (hover)',
  'background-disabled': 'Disabled surface',

  'background-brand-primary': 'Accent fill',
  'background-brand-primary-hover': 'Accent fill (hover)',
  'background-brand-secondary': 'Accent tint',
  'background-brand-secondary-hover': 'Accent tint (hover)',

  'background-gray-primary': 'Gray fill',
  'background-gray-primary-hover': 'Gray fill (hover)',
  'background-gray-secondary': 'Gray tint',
  'background-gray-secondary-hover': 'Gray tint (hover)',

  'background-success-primary': 'Success fill',
  'background-success-primary-hover': 'Success fill (hover)',
  'background-success-secondary': 'Success tint',
  'background-success-secondary-hover': 'Success tint (hover)',

  'background-error-primary': 'Error fill',
  'background-error-primary-hover': 'Error fill (hover)',
  'background-error-secondary': 'Error tint',
  'background-error-secondary-hover': 'Error tint (hover)',

  'background-warning-primary': 'Warning fill',
  'background-warning-primary-hover': 'Warning fill (hover)',
  'background-warning-secondary': 'Warning tint',
  'background-warning-secondary-hover': 'Warning tint (hover)',

  'background-mask-overlay': 'Overlay mask',
  'background-mask-lighten': 'Lighten mask',
}

/** Tokens stored with an alpha channel; the editor shows an opacity slider for them. */
export const themeAlphaTokens = new Set<ThemeColorToken>([
  'tint-error-disabled',
  'background-brand-secondary',
  'background-brand-secondary-hover',
  'background-gray-secondary',
  'background-gray-secondary-hover',
  'background-success-secondary',
  'background-success-secondary-hover',
  'background-error-secondary',
  'background-error-secondary-hover',
  'background-warning-secondary',
  'background-warning-secondary-hover',
  'background-mask-overlay',
  'background-mask-lighten',
])

export type ThemeBase = {
  value: string
  /** i18n key for built-in bases, raw user name for saved themes. */
  label: string
  builtin: boolean
  mode: ThemeMode
  colors: ThemeColors
}

/** Palettes offered as a starting point when creating a new theme. */
export function getThemeBases(customThemes?: CustomTheme[]): ThemeBase[] {
  const saved = Array.isArray(customThemes) ? customThemes : []
  return [
    { value: 'classic-light', label: 'Classic Look (Light)', builtin: true, mode: 'light', colors: classicLightColors },
    { value: 'classic-dark', label: 'Classic Look (Dark)', builtin: true, mode: 'dark', colors: classicDarkColors },
    { value: 'soft-light', label: 'Light', builtin: true, mode: 'light', colors: softLightColors },
    { value: 'oled-black', label: 'OLED Black', builtin: true, mode: 'dark', colors: oledColors },
    ...saved.map((theme) => ({
      value: theme.id,
      label: theme.name,
      builtin: false,
      mode: theme.mode,
      colors: withFallbackColors(theme.colors, theme.mode),
    })),
  ]
}
