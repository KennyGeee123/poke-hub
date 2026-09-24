export const APP_ID = "com.kennygeee.pokevault";
export const APP_NAME = "PokéVault";
export const LIVE_URL = "https://pokedex-hub-lime.vercel.app";
export const AUTH_CALLBACK_URL = `${APP_ID}://auth/callback`;

type CapWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean((window as CapWindow).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function isIosApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (window as CapWindow).Capacitor?.getPlatform?.() === "ios";
  } catch {
    return false;
  }
}

/** OAuth redirect target: custom scheme on native, site origin on web. */
export function authRedirectUrl(path = "/login"): string {
  if (isNativeApp()) return AUTH_CALLBACK_URL;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return `${LIVE_URL}${path}`;
}

export function supportEmail(): string {
  return (
    (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() ||
    "kmitchjr7@gmail.com"
  );
}
