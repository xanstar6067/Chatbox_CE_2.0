import { z } from 'zod'

/**
 * Appearance theme color tokens.
 *
 * Every token maps 1:1 to a `--chatbox-<token>` CSS custom property declared in
 * `src/renderer/static/globals.css`. A theme is simply an override of those
 * properties, so themes automatically reach every platform (web, desktop,
 * Electron, Android, iOS) that renders the shared UI.
 */
export const THEME_COLOR_TOKENS = [
  // tint
  'tint-primary',
  'tint-secondary',
  'tint-tertiary',
  'tint-brand',
  'tint-placeholder',
  'tint-disabled',
  'tint-gray',
  'tint-white',
  'tint-black',
  'tint-success',
  'tint-warning',
  'tint-error',
  'tint-error-disabled',
  // border
  'border-primary',
  'border-secondary',
  'border-brand',
  'border-success',
  'border-warning',
  'border-error',
  // background
  'background-primary',
  'background-primary-hover',
  'background-secondary',
  'background-secondary-hover',
  'background-tertiary',
  'background-tertiary-hover',
  'background-disabled',
  // background - brand
  'background-brand-primary',
  'background-brand-primary-hover',
  'background-brand-secondary',
  'background-brand-secondary-hover',
  // background - gray
  'background-gray-primary',
  'background-gray-primary-hover',
  'background-gray-secondary',
  'background-gray-secondary-hover',
  // background - success
  'background-success-primary',
  'background-success-primary-hover',
  'background-success-secondary',
  'background-success-secondary-hover',
  // background - error
  'background-error-primary',
  'background-error-primary-hover',
  'background-error-secondary',
  'background-error-secondary-hover',
  // background - warning
  'background-warning-primary',
  'background-warning-primary-hover',
  'background-warning-secondary',
  'background-warning-secondary-hover',
  // background - mask
  'background-mask-overlay',
  'background-mask-lighten',
] as const

export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number]

export type ThemeColors = Record<ThemeColorToken, string>

/** Base color scheme a theme runs in. `auto` follows the Light/Dark/System setting. */
export type ThemeMode = 'light' | 'dark'

/** Id of the built-in theme that keeps the historical Chatbox appearance. */
export const CLASSIC_THEME_ID = 'classic'

/**
 * A theme saved by the user. Colors are stored as a loose record so that
 * tokens added in later versions simply fall back to the base palette instead
 * of invalidating persisted themes.
 */
export const CustomThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.enum(['light', 'dark']),
  colors: z.record(z.string(), z.string()),
  basedOn: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
})

export type CustomTheme = z.infer<typeof CustomThemeSchema>
