import type { ThemeColors } from '@shared/types'
import clsx from 'clsx'
import type { CSSProperties, FC } from 'react'
import { toCssVariables } from '@/lib/theme-presets'

type Props = {
  colors: ThemeColors
  /** `sm` fits a theme card, `md` is used by the editor. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Miniature of the app painted with a given palette.
 *
 * The palette is injected as `--chatbox-*` custom properties on the wrapper, so
 * the very same utility classes used across the app render the preview.
 */
export const ThemePreview: FC<Props> = ({ colors, size = 'sm', className }) => {
  const scale = size === 'md' ? 1.6 : 1
  const px = (value: number) => Math.round(value * scale)

  return (
    <div
      style={toCssVariables(colors) as CSSProperties}
      className={clsx(
        'overflow-hidden rounded-md border border-solid border-chatbox-border-primary bg-chatbox-background-primary select-none',
        className
      )}
    >
      {/* title bar */}
      <div
        className="flex items-center gap-xxs border-0 border-b border-solid border-chatbox-border-primary bg-chatbox-background-primary"
        style={{ height: px(14), paddingInline: px(6) }}
      >
        <span className="rounded-full bg-chatbox-background-error-primary" style={{ width: px(4), height: px(4) }} />
        <span className="rounded-full bg-chatbox-background-warning-primary" style={{ width: px(4), height: px(4) }} />
        <span className="rounded-full bg-chatbox-background-success-primary" style={{ width: px(4), height: px(4) }} />
        <span
          className="rounded-full bg-chatbox-background-secondary"
          style={{ width: '38%', height: px(4), marginInlineStart: px(6) }}
        />
      </div>

      <div className="flex" style={{ height: px(76) }}>
        {/* sidebar */}
        <div
          className="flex flex-col border-0 border-r border-solid border-chatbox-border-primary bg-chatbox-background-secondary"
          style={{ width: '34%', padding: px(6), gap: px(5) }}
        >
          <span
            className="rounded-full bg-chatbox-background-brand-primary"
            style={{ width: '82%', height: px(9), marginBottom: px(2) }}
          />
          <span className="rounded-sm bg-chatbox-background-tertiary" style={{ width: '100%', height: px(5) }} />
          <span className="rounded-sm bg-chatbox-background-tertiary" style={{ width: '76%', height: px(5) }} />
          <span className="rounded-sm bg-chatbox-background-tertiary" style={{ width: '88%', height: px(5) }} />
          <span
            className="rounded-sm bg-chatbox-tint-tertiary opacity-60"
            style={{ width: '60%', height: px(5), marginTop: 'auto' }}
          />
        </div>

        {/* conversation */}
        <div className="flex flex-1 flex-col bg-chatbox-background-primary" style={{ padding: px(6), gap: px(5) }}>
          <div
            className="flex flex-col rounded-md bg-chatbox-background-secondary"
            style={{ width: '82%', padding: px(4), gap: px(3) }}
          >
            <span className="rounded-sm bg-chatbox-tint-secondary opacity-70" style={{ width: '92%', height: px(4) }} />
            <span className="rounded-sm bg-chatbox-tint-secondary opacity-40" style={{ width: '64%', height: px(4) }} />
          </div>

          <div
            className="flex flex-col self-end rounded-md bg-chatbox-background-brand-secondary"
            style={{ width: '64%', padding: px(4), gap: px(3) }}
          >
            <span className="rounded-sm bg-chatbox-tint-brand opacity-80" style={{ width: '88%', height: px(4) }} />
            <span className="rounded-sm bg-chatbox-tint-brand opacity-50" style={{ width: '56%', height: px(4) }} />
          </div>

          <div
            className="mt-auto flex items-center justify-between rounded-md border border-solid border-chatbox-border-secondary bg-chatbox-background-primary"
            style={{ height: px(16), paddingInline: px(5) }}
          >
            <span className="rounded-sm bg-chatbox-tint-placeholder" style={{ width: '46%', height: px(4) }} />
            <span
              className="rounded-full bg-chatbox-background-brand-primary"
              style={{ width: px(8), height: px(8) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ThemePreview
