import type { CapacitorConfig } from '@capacitor/cli'

/**
 * PokéVault native shells (iOS / Android).
 *
 * TanStack Start is SSR on Vercel, so production Capacitor builds load the
 * live site in the WebView (server.url). webDir holds a local fallback +
 * static assets used by `cap sync`. OAuth returns via the custom URL scheme
 * com.kennygeee.pokevault://auth/callback (see src/lib/platform.ts).
 */
const LIVE_URL = 'https://pokedex-hub-lime.vercel.app'

const config: CapacitorConfig = {
  appId: 'com.kennygeee.pokevault',
  appName: 'PokéVault',
  webDir: 'www',
  backgroundColor: '#0b1020',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0b1020',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#0b1020',
  },
  server: {
    url: LIVE_URL,
    cleartext: true,
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'pokedex-hub-lime.vercel.app',
      '*.supabase.co',
      'accounts.google.com',
      '*.google.com',
      'appleid.apple.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      launchAutoHide: true,
      backgroundColor: '#0b1020',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b1020',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
}

export default config
