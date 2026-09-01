import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GBMon, GBMove } from "./gbgame";
import { levelDamage } from "./gbgame";

export type PvPMessage =
  | { kind: "join"; userId: string; name: string; mon: GBMon }
  | { kind: "leave"; userId: string }
  | { kind: "ready"; userId: string }
  | { kind: "move"; userId: string; move: GBMove; resultHp: number; targetHp: number; log: string }
  | { kind: "end"; winnerId: string };

export function pvpChannelName(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `pvp:${x}:${y}`;
}

export type PvPHandlers = {
  onJoin?: (m: Extract<PvPMessage, { kind: "join" }>) => void;
  onLeave?: (m: Extract<PvPMessage, { kind: "leave" }>) => void;
  onReady?: (m: Extract<PvPMessage, { kind: "ready" }>) => void;
  onMove?: (m: Extract<PvPMessage, { kind: "move" }>) => void;
  onEnd?: (m: Extract<PvPMessage, { kind: "end" }>) => void;
};

export function joinPvP(channelName: string, handlers: PvPHandlers): RealtimeChannel {
  const ch = supabase.channel(channelName, { config: { broadcast: { self: false, ack: true } } });
  ch.on("broadcast", { event: "pvp" }, ({ payload }) => {
    const m = payload as PvPMessage;
    if (m.kind === "join") handlers.onJoin?.(m);
    else if (m.kind === "leave") handlers.onLeave?.(m);
    else if (m.kind === "ready") handlers.onReady?.(m);
    else if (m.kind === "move") handlers.onMove?.(m);
    else if (m.kind === "end") handlers.onEnd?.(m);
  });
  ch.subscribe();
  return ch;
}

export async function sendPvP(ch: RealtimeChannel, msg: PvPMessage): Promise<void> {
  await ch.send({ type: "broadcast", event: "pvp", payload: msg });
}

export function computePvPDamage(attacker: GBMon, defender: GBMon, move: GBMove) {
  return levelDamage(move, attacker.level, defender.types, attacker.types);
}
