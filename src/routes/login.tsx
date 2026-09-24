import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — PokéVault Pro" },
      {
        name: "description",
        content: "Sign in to PokéVault Pro to scan, track and trade Pokémon TCG cards.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user, loading, signInWithGoogle, signInWithApple } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setInfo("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const desc = q.get("error_description") || q.get("error");
    if (desc) setErr(decodeURIComponent(desc.replace(/\+/g, " ")));
  }, []);

  const onGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw new Error(error);
    } catch (e: any) {
      setErr(e?.message ?? "Google sign-in failed");
      setBusy(false);
    }
  };

  const onApple = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await signInWithApple();
      if (error) throw new Error(error);
    } catch (e: any) {
      setErr(e?.message ?? "Apple sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="pv-login">
      <div className="pv-login-card">
        <div className="pv-login-head">
          <div
            className="pv-pokeball"
            aria-hidden
            style={{ width: 36, height: 36, margin: "0 auto 10px" }}
          />
          <h1 className="pv-login-title">PokéVault Pro</h1>
          <p className="pv-login-sub">
            {mode === "signin" ? "Sign in to your trainer account" : "Create your trainer account"}
          </p>
        </div>

        <button onClick={onGoogle} disabled={busy} className="pv-login-google">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.61z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33C2.44 15.98 5.48 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.99-2.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </button>
        <button onClick={onApple} disabled={busy} className="pv-login-google" style={{ marginTop: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M16.7 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.7zM14.6 6.5c.6-.7 1-1.7.9-2.7-0.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 1.9-.4 2.5-1.2z"
            />
          </svg>
          Continue with Apple
        </button>


        <div className="flex items-center gap-2 my-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">OR</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pv-login-input"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pv-login-input"
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
          {info && <p className="text-sm text-green-600">{info}</p>}
          <button type="submit" disabled={busy} className="pv-login-submit">
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "signin" ? "New trainer?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setErr(null);
              setInfo(null);
            }}
            className="text-primary hover:underline font-medium"
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Free accounts include <strong>2 submissions</strong>. Upgrade for unlimited.
        </p>


        <p className="text-center text-xs text-muted-foreground mt-4">
          <a href="/privacy.html" className="hover:underline">Privacy</a>
          {" · "}
          <a href="/terms.html" className="hover:underline">Terms</a>
          {" · "}
          <a href="/support.html" className="hover:underline">Support</a>
        </p>
        <p className="text-center text-[10px] text-muted-foreground mt-2 px-2">
          Unofficial fan app — not affiliated with Nintendo, The Pokémon Company, or Game Freak.
        </p>

        <p className="text-center text-sm mt-3">
          <button
            type="button"
            onClick={() => nav({ to: "/" })}
            className="text-muted-foreground hover:underline"
          >
            Skip for now, continue as guest
          </button>
        </p>
      </div>
    </div>
  );
}
