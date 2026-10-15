import { createFileRoute } from "@tanstack/react-router";
import { HoloFareApp } from "@/components/holofare/HoloFare";
import { hfHead } from "@/components/holofare/head";

export const Route = createFileRoute("/holofare/")({
  head: () => hfHead("HoloFare (demo) — Name your card. We'll fetch it."),
  validateSearch: (s: Record<string, unknown>): { screen?: string; tier?: string; q?: string; step?: string } => ({
    screen: typeof s.screen === "string" ? s.screen : undefined,
    tier: typeof s.tier === "string" ? s.tier : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    step: typeof s.step === "string" || typeof s.step === "number" ? String(s.step) : undefined,
  }),
  component: Page,
});

function Page() {
  const s = Route.useSearch();
  return <HoloFareApp initial={s} />;
}
