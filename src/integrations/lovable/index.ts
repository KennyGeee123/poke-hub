import { supabase } from "../supabase/client";

/**
 * Google sign-in for the Vercel host.
 * Lovable's relative `/~oauth/initiate` 404s on Vercel, and their broker
 * rejects a vercel.app redirect_uri. Open a popup against the live Cloud
 * broker with an allowed redirect, then take tokens via postMessage.
 */
const OAUTH_BROKER = "https://tcg-vault-master.lovable.app/~oauth/initiate";
const ALLOWED_REDIRECT = "https://tcg-vault-master.lovable.app";
const MESSAGE_ORIGINS = ["https://oauth.lovable.app", "https://lovable.dev", "https://tcg-vault-master.lovable.app"];

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function signInWithOAuthPopup(provider: string, extraParams?: Record<string, string>) {
  const state = randomState();
  const params = new URLSearchParams({
    ...extraParams,
    provider,
    redirect_uri: ALLOWED_REDIRECT,
    state,
    response_mode: "web_message",
  });
  const url = `${OAUTH_BROKER}?${params.toString()}`;

  const width = Math.min(520, window.outerWidth * 0.5);
  const height = Math.min(720, window.outerHeight * 0.8);
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(
    url,
    "pv-google-oauth",
    `width=${Math.round(width)},height=${Math.round(height)},left=${Math.round(left)},top=${Math.round(top)}`,
  );
  if (!popup) {
    return Promise.resolve({ error: new Error("Popup was blocked. Allow popups and try Google again.") });
  }

  return new Promise<{ tokens?: { access_token: string; refresh_token: string }; error: Error | null; redirected?: boolean }>((resolve) => {
    let done = false;
    const finish = (value: { tokens?: { access_token: string; refresh_token: string }; error: Error | null }) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(tick);
      try { popup.close(); } catch { /* ignore */ }
      resolve(value);
    };

    const onMessage = (e: MessageEvent) => {
      if (!MESSAGE_ORIGINS.includes(e.origin)) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      const payload = data.type === "authorization_response" ? data.response : data;
      if (!payload) return;
      if (payload.state && payload.state !== state) {
        finish({ error: new Error("State is invalid") });
        return;
      }
      if (payload.error) {
        finish({ error: new Error(payload.error_description ?? payload.error ?? "Sign in failed") });
        return;
      }
      if (payload.access_token && payload.refresh_token) {
        finish({ tokens: { access_token: payload.access_token, refresh_token: payload.refresh_token }, error: null });
      }
    };

    window.addEventListener("message", onMessage);
    const tick = setInterval(() => {
      if (popup.closed) finish({ error: new Error("Sign in was cancelled") });
    }, 500);
    setTimeout(() => finish({ error: new Error("Google sign-in timed out") }), 120_000);
  });
}

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      const result = await signInWithOAuthPopup(provider, opts?.extraParams);
      if (result.error || !result.tokens) return result;
      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
