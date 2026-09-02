export const ARENA_CLIP = "/fx/battle-arena.mp4";

export function battleClipFor(name: string, type?: string): string {
  const n = `${name} ${type || ""}`.toLowerCase();
  if (/flame|fire|ember|blast|overheat|inferno|heat|burn/.test(n)) return "/fx/battle-fire.mp4";
  if (/thunder|volt|zap|shock|spark|electric|lightning|discharge/.test(n)) return "/fx/battle-thunder.mp4";
  return "/fx/battle-impact.mp4";
}
