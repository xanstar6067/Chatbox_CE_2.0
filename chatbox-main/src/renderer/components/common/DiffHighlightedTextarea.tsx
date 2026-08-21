import { Box, Input } from '@mantine/core'
import { type ChangeEvent, type UIEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { getCorrectionDiffParts } from '@/services/messageRefinementDiff'

const MIN_HEIGHT = 174
const MAX_HEIGHT = 370

export function DiffHighlightedTextarea({
  label,
  description,
  placeholder,
  originalText,
  value,
  readOnly,
  showChanges,
  onChange,
}: {
  label: string
  description: string
  placeholder: string
  originalText: string
  value: string
  readOnly: boolean
  showChanges: boolean
  onChange(value: string): void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayTextRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const parts = useMemo(
    () => (showChanges ? getCorrectionDiffParts(originalText, value) : [{ value, changed: false }]),
    [originalText, showChanges, value]
  )

  useLayoutEffect(() => {
    void value
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`
  }, [value])

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (overlayTextRef.current) {
      overlayTextRef.current.style.transform = `translate(${-event.currentTarget.scrollLeft}px, ${-event.currentTarget.scrollTop}px)`
    }
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.currentTarget.value)
  }

  return (
    <Input.Wrapper label={label} description={description}>
      <Box
        mt={5}
        className={cn(
          'relative overflow-hidden rounded-md border border-solid bg-chatbox-background-primary',
          focused ? 'border-chatbox-border-brand' : 'border-chatbox-border-primary'
        )}
      >
        {!!value && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              ref={overlayTextRef}
              className="box-border min-h-full w-full whitespace-pre-wrap break-words px-[11px] py-[8px] text-sm leading-[1.55] text-transparent"
            >
              {parts.map((part, index) => (
                <span
                  key={`${index}-${part.changed}`}
                  className={
                    part.changed
                      ? 'underline decoration-2 decoration-chatbox-tint-brand underline-offset-[3px]'
                      : undefined
                  }
                >
                  {part.value}
                </span>
              ))}
            </div>
          </div>
        )}
        <textarea
          ref={textareaRef}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={handleChange}
          onScroll={syncScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            'relative z-[1] box-border block w-full resize-none border-0 bg-transparent px-[11px] py-[8px]',
            'text-sm leading-[1.55] text-chatbox-tint-primary outline-none placeholder:text-chatbox-tint-tertiary',
            readOnly ? 'cursor-default' : ''
          )}
          style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
        />
      </Box>
    </Input.Wrapper>
  )
}
