import { isNativeApp } from "@/lib/platform";

/** Status bar / splash / keyboard — no-ops on web and when plugins are missing. */
export async function initNativeShell(): Promise<void> {
  if (typeof window === "undefined" || !isNativeApp()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    try {
      await StatusBar.setBackgroundColor({ color: "#0b1020" });
    } catch {
      /* iOS overlay */
    }
  } catch {
    /* plugin unavailable */
  }
  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {
    /* web */
  }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* web */
  }
}

/**
 * Finish OAuth when the OS returns via
 * `com.kennygeee.pokevault://auth/callback?code=…`.
 */
export function listenForAuthDeepLinks(onCode: (code: string) => void): () => void {
  if (typeof window === "undefined" || !isNativeApp()) return () => {};

  let remove: (() => void) | undefined;
  void import("@capacitor/app").then(({ App }) => {
    const handle = App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.includes("auth/callback") && !url.includes("code=")) return;
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        if (code) onCode(code);
      } catch {
        /* ignore */
      }
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
      } catch {
        /* already closed */
      }
    });
    void handle.then((h) => {
      remove = () => h.remove();
    });
  });

  return () => {
    remove?.();
  };
}

/** Open an OAuth URL — Capacitor Browser on native, full navigation on web. */
export async function openAuthUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, windowName: "_self" });
      return;
    } catch {
      /* fall through */
    }
  }
  window.location.assign(url);
}
