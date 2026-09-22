import platforms from '@/platform'
import { CHATBOX_ERROR_REPORTING_ENABLED } from '@/variables'
;(() => {
  if (!CHATBOX_ERROR_REPORTING_ENABLED) {
    return
  }
  try {
    platforms.initTracking()
  } catch (e) {
    console.error(e)
  }
})()
