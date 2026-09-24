import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerEmail } from "./owner";
import { authRedirectUrl } from "./platform";
import { listenForAuthDeepLinks, openAuthUrl } from "./native";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOwner: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  completeOAuth: (code: string) => Promise<{ error: string | null }>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: false,
  isOwner: false,
  signOut: async () => {},
  signInWithGoogle: async () => ({ error: null }),
  signInWithApple: async () => ({ error: null }),
  completeOAuth: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Default false so SSR + first paint render the guest shell instead of a spinner wall.
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const completeOAuth = async (code: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { error: error.message };
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Sign-in failed." };
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const q = new URLSearchParams(window.location.search);
    const access_token = hash.get("access_token") || q.get("access_token");
    const refresh_token = hash.get("refresh_token") || q.get("refresh_token");
    const code = q.get("code");
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
    } else if (code) {
      supabase.auth
        .exchangeCodeForSession(window.location.href)
        .catch(() => {})
        .then(() => {
          window.history.replaceState({}, "", window.location.pathname);
        });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let done = false;
    const finish = (s: Session | null) => {
      if (done) return;
      done = true;
      setSession(s);
      setLoading(false);
    };
    const timer = window.setTimeout(() => finish(null), 2500);
    let unsub = () => {};
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => finish(s));
      unsub = () => sub.subscription.unsubscribe();
      supabase.auth
        .getSession()
        .then(({ data }) => finish(data.session))
        .catch(() => finish(null));
    } catch {
      finish(null);
    }
    const stopDeepLinks = listenForAuthDeepLinks((code) => {
      void completeOAuth(code);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
      stopDeepLinks();
    };
  }, []);

  const user = session?.user ?? null;
  const emailOwner = isOwnerEmail(user?.email);

  useEffect(() => {
    if (!user) {
      setIsOwner(false);
      return;
    }
    setIsOwner(emailOwner);
    let cancelled = false;
    import("./owner.functions")
      .then(({ getIsOwner }) => getIsOwner())
      .then((r) => {
        if (!cancelled) setIsOwner(emailOwner || !!r?.isOwner);
      })
      .catch(() => {
        if (!cancelled) setIsOwner(emailOwner);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, emailOwner]);

  const signInWithOAuth = async (provider: "google" | "apple") => {
    try {
      const redirectTo = authRedirectUrl("/login");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          ...(provider === "google"
            ? { queryParams: { access_type: "offline", prompt: "select_account" } }
            : {}),
        },
      });
      if (error) return { error: error.message };
      if (!data?.url) return { error: `${provider} did not return a sign-in URL.` };
      await openAuthUrl(data.url);
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : `${provider} sign-in failed` };
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        isOwner: emailOwner || isOwner,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        signInWithGoogle: () => signInWithOAuth("google"),
        signInWithApple: () => signInWithOAuth("apple"),
        completeOAuth,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
