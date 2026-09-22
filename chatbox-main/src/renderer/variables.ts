// 在 webpack.config.base.ts 的 webpack.EnvironmentPlugin 中注册的变量，
// 在编译时 webpack 会根据环境变量替换掉 process.env.XXX

export const CHATBOX_BUILD_TARGET = (process.env.CHATBOX_BUILD_TARGET || 'unknown') as 'unknown' | 'mobile_app'
export const CHATBOX_BUILD_PLATFORM = (process.env.CHATBOX_BUILD_PLATFORM || 'unknown') as
  | 'unknown'
  | 'ios'
  | 'android'
  | 'web'

export const CHATBOX_BUILD_CHANNEL = (process.env.CHATBOX_BUILD_CHANNEL || 'unknown') as 'unknown' | 'google_play'

// The Android Community Edition is an independent fork. Keep integrations that
// point users back to the official commercial product out of that build.
export const IS_ANDROID_FORK_BUILD = CHATBOX_BUILD_PLATFORM === 'android'
export const CHATBOX_OFFICIAL_UPDATE_CHECK_ENABLED = !IS_ANDROID_FORK_BUILD
export const CHATBOX_COMMERCE_LINKS_ENABLED = !IS_ANDROID_FORK_BUILD
export const CHATBOX_BUILT_IN_WEB_SEARCH_ENABLED = !IS_ANDROID_FORK_BUILD
export const CHATBOX_AI_SETTINGS_ENABLED = !IS_ANDROID_FORK_BUILD
export const CHATBOX_AI_DOCUMENT_PARSER_ENABLED = !IS_ANDROID_FORK_BUILD
// Without the Chatbox AI and MinerU parsers the settings page has a single,
// non-actionable option on Android, so the whole entry is hidden there.
export const CHATBOX_DOCUMENT_PARSER_SETTINGS_ENABLED = !IS_ANDROID_FORK_BUILD
// Crash reports and usage events go to the upstream project's Sentry/analytics
// accounts, which the fork has no access to. Keep them out of this build.
export const CHATBOX_ERROR_REPORTING_ENABLED = !IS_ANDROID_FORK_BUILD

// api.chatboxai.app
export const USE_LOCAL_API = process.env.USE_LOCAL_API || ''
export const USE_BETA_API = process.env.USE_BETA_API || ''
export const USE_NEWDB_API = process.env.USE_NEWDB_API || ''

// chatboxai.app
export const USE_LOCAL_CHATBOX = process.env.USE_LOCAL_CHATBOX || ''
export const USE_BETA_CHATBOX = process.env.USE_BETA_CHATBOX || ''

export const NODE_ENV = process.env.NODE_ENV || 'development'
