import { supabase } from "@/integrations/supabase/client";
import type { TCGCard } from "./pokemon-api";
import { getMarketPrice } from "./pokemon-api";
import type { GBMon } from "./gbgame";

export type FriendStatus = "pending" | "accepted" | "blocked";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendStatus;
  created_at: string;
};

export type FriendProfile = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type FriendRow = {
  friendship: Friendship;
  other: FriendProfile | null;
  direction: "incoming" | "outgoing" | "friend";
};

export type VaultSnapshot = {
  user_id: string;
  cards: { card: TCGCard; qty: number }[];
  total_value: number;
  card_count: number;
  updated_at: string;
};

export async function searchUserByEmail(email: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase.rpc("find_user_by_email", { _email: email.trim() });
  if (error) throw error;
  return (data?.[0] as FriendProfile) ?? null;
}

export async function sendFriendRequest(addressee_id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (uid === addressee_id) throw new Error("You can't friend yourself");
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: uid, addressee_id, status: "pending" });
  if (error) throw error;
}

export async function respondFriendRequest(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "blocked" })
    .eq("id", id);
  if (error) throw error;
}

export async function removeFriend(id: string): Promise<void> {
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchFriendships(): Promise<FriendRow[]> {
  const { data: u } = await supabase.auth.getUser();
  const me = u.user?.id;
  if (!me) return [];
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Friendship[];
  const otherIds = Array.from(
    new Set(rows.map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id)))
  );
  let profiles: FriendProfile[] = [];
  if (otherIds.length) {
    const { data: ps } = await supabase
      .from("profiles")
      .select("user_id, display_name, email, avatar_url")
      .in("user_id", otherIds);
    profiles = (ps ?? []) as FriendProfile[];
  }
  return rows.map((r) => {
    const otherId = r.requester_id === me ? r.addressee_id : r.requester_id;
    const other = profiles.find((p) => p.user_id === otherId) ?? null;
    const direction: FriendRow["direction"] =
      r.status === "accepted"
        ? "friend"
        : r.requester_id === me
        ? "outgoing"
        : "incoming";
    return { friendship: r, other, direction };
  });
}

export async function pushVaultSnapshot(vault: Record<string, { card: TCGCard; qty: number }>): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  const cards = Object.values(vault).map((e) => ({ card: e.card, qty: e.qty }));
  const total_value = cards.reduce((s, e) => s + getMarketPrice(e.card) * e.qty, 0);
  const card_count = cards.reduce((s, e) => s + e.qty, 0);
  const { error } = await supabase
    .from("vault_snapshots")
    .upsert(
      { user_id: uid, cards, total_value, card_count, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) console.error("vault snapshot push", error);
}

export async function fetchFriendVault(user_id: string): Promise<VaultSnapshot | null> {
  const { data, error } = await supabase
    .from("vault_snapshots")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw error;
  return data as VaultSnapshot | null;
}

export async function fetchFriendParty(user_id: string): Promise<GBMon[]> {
  const { data, error } = await supabase
    .from("gb_party")
    .select("*")
    .eq("user_id", user_id)
    .order("level", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    card_id: r.card_id,
    name: r.name,
    types: r.types ?? [],
    level: r.level,
    xp: r.xp,
    max_hp: r.max_hp,
    attacks: r.attacks ?? [],
    sprite_url: r.sprite_url,
    image_url: r.image_url,
    wins: r.wins,
    losses: r.losses,
    slot: r.slot,
  }));
}
