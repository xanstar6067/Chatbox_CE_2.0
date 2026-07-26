import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'xyz.chatboxapp.ce',
  appName: 'Chatbox CE',
  webDir: 'release/app/dist/renderer',
  server: {
    androidScheme: 'https',
  },
  android: {
    adjustMarginsForEdgeToEdge: 'auto',
  },
}

export default config
