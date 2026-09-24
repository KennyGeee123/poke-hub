export const ARENA_CLIP = "/fx/battle-arena.mp4";

/**
 * The /fx clips are 10-18 MB each and are excluded from production deploys
 * (.vercelignore → public/fx). Only reference them in local dev so live
 * battles don't spam 404s or stall on huge downloads.
 */
export const FX_VIDEOS_ENABLED: boolean = !!import.meta.env.DEV;

export function battleClipFor(name: string, type?: string): string {
  const n = `${name} ${type || ""}`.toLowerCase();
  if (/flame|fire|ember|blast|overheat|inferno|heat|burn/.test(n)) return "/fx/battle-fire.mp4";
  if (/thunder|volt|zap|shock|spark|electric|lightning|discharge/.test(n))
    return "/fx/battle-thunder.mp4";
  return "/fx/battle-impact.mp4";
}
