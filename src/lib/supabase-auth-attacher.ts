// Same job as integrations/supabase/auth-attacher (attach the bearer token to
// serverFn RPCs) but loads the Supabase SDK lazily and skips it entirely for
// guests, so the SDK is not part of the first-paint bundle.
import { createMiddleware } from "@tanstack/react-start";
import { loadSupabase } from "@/integrations/supabase/lazy";

function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => /^sb-.*-auth-token/.test(k));
  } catch {
    return false;
  }
}

export const attachSupabaseAuthLazy = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    if (typeof window !== "undefined" && hasStoredSession()) {
      try {
        const supabase = await loadSupabase();
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      } catch {
        token = undefined;
      }
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
