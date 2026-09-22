import { type ClassValue, clsx } from 'clsx'
import dayjs from 'dayjs'
import { getDefaultStore } from 'jotai'
import { twMerge } from 'tailwind-merge'
import platform from '@/platform'
import { initLogAtom } from '@/stores/atoms/utilAtoms'

// Re-export from shared layer for backward compatibility
export { parseJsonOrEmpty } from '../../shared/utils/json_utils'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The startup log is only ever shown on the loading screen, but `getLogger` is
 * used for the whole app session. Keeping the tail bounds both the memory it
 * holds and the array copy done on every single log line.
 */
const MAX_INIT_LOG_ENTRIES = 200

/** Longest a single serialized argument may be, so one payload cannot flood the log. */
const MAX_ARG_LENGTH = 2000

/**
 * `String(value)` turns every object into a useless `[object Object]`, which is
 * how most of the existing log calls lose their payload. Serialize instead, and
 * keep errors readable by preferring their stack.
 */
function formatLogArg(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`
  }
  if (value === null || typeof value !== 'object') {
    return String(value)
  }
  let text: string
  try {
    const seen = new WeakSet<object>()
    text = JSON.stringify(value, (_key, val) => {
      if (val !== null && typeof val === 'object') {
        if (seen.has(val)) {
          return '[Circular]'
        }
        seen.add(val)
      }
      return val
    })
  } catch {
    text = String(value)
  }
  if (text === undefined) {
    return String(value)
  }
  return text.length > MAX_ARG_LENGTH ? `${text.slice(0, MAX_ARG_LENGTH)}…(truncated)` : text
}

export function getLogger(logId: string) {
  // const logger = log.create({ logId })
  // logger.transports.console.format = '{h}:{i}:{s}.{ms} › [{logId}] › {text}'
  // return logger
  return {
    log(level: string, ...args: any[]) {
      // Logging must never be able to break the code it reports on.
      try {
        const store = getDefaultStore()
        const now = dayjs().format('HH:mm:ss.SSS')
        const message = args.map(formatLogArg).join(' ')
        const entries = [...store.get(initLogAtom), `[${now}][${logId}] ${message}`]
        store.set(initLogAtom, entries.slice(-MAX_INIT_LOG_ENTRIES))
        platform.appLog(level, `[${logId}] ${message}`).catch((e) => {
          console.error('Failed to send log to main process', e)
        })
      } catch (e) {
        console.error('Failed to record log entry', e)
      }
    },
    info(...args: any[]) {
      this.log('info', ...args)
    },
    warn(...args: any[]) {
      this.log('warn', ...args)
    },
    error(...args: any[]) {
      this.log('error', ...args)
    },
    debug(...args: any[]) {
      console.debug('debug', ...args)
    },
  }
}
