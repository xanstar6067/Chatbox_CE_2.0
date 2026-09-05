import { Box, Button, Input } from '@mantine/core'
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const id = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [editing, setEditing] = useState(false)
  const isEditing = editing && !readOnly
  // `value` is the plain replacement buffer. Diff markup exists only in the preview.
  const parts = useMemo(
    () => (showChanges ? getCorrectionDiffParts(originalText, value) : [{ value, changed: false }]),
    [originalText, showChanges, value]
  )

  useLayoutEffect(() => {
    if (readOnly) setEditing(false)
  }, [readOnly])

  useLayoutEffect(() => {
    void value
    void isEditing
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`
  }, [value, isEditing])

  useLayoutEffect(() => {
    if (isEditing) textareaRef.current?.focus()
  }, [isEditing])

  return (
    <Input.Wrapper id={id} label={label} description={description}>
      {!readOnly && (
        <Button size="compact-xs" variant="subtle" mt={5} onClick={() => setEditing(!isEditing)}>
          {isEditing ? t('Preview') : t('Edit')}
        </Button>
      )}
      <Box
        mt={5}
        className="overflow-hidden rounded-md border border-solid border-chatbox-border-primary bg-chatbox-background-primary focus-within:border-chatbox-border-brand"
      >
        {isEditing ? (
          <textarea
            id={id}
            ref={textareaRef}
            aria-label={label}
            aria-describedby={`${id}-description`}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            className="box-border block w-full resize-none border-0 bg-transparent px-[11px] py-[8px] text-sm leading-[1.55] text-chatbox-tint-primary outline-none placeholder:text-chatbox-tint-tertiary"
            style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          />
        ) : (
          <div
            id={id}
            role="region"
            aria-label={label}
            aria-describedby={`${id}-description`}
            tabIndex={0}
            className="box-border w-full overflow-y-auto whitespace-pre-wrap break-words px-[11px] py-[8px] text-sm leading-[1.55] text-chatbox-tint-primary"
            style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          >
            {value ? (
              parts.map((part, index) => (
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
              ))
            ) : (
              <span className="text-chatbox-tint-tertiary">{placeholder}</span>
            )}
          </div>
        )}
      </Box>
    </Input.Wrapper>
  )
}
