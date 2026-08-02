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
  plugins: {
    CapacitorSQLite: {
      // Chatbox opens every mobile database with `no-encryption`. Leaving the
      // plugin default enabled creates an unused Keystore-backed preference
      // file that cannot be decrypted after Android restores app data.
      androidIsEncryption: false,
    },
  },
}

export default config
