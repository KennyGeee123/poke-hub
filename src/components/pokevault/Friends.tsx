import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchParty, spriteFor, xpForNext, saveMonStats, gainXP, type GBMon, type GBMove } from "@/lib/gbgame";
import {
  fetchFriendships, fetchFriendParty, fetchFriendVault, removeFriend,
  respondFriendRequest, searchUserByEmail, sendFriendRequest,
  type FriendRow, type VaultSnapshot,
} from "@/lib/friends";
import { computePvPDamage, joinPvP, pvpChannelName, sendPvP, type PvPMessage } from "@/lib/pvp";
import { formatPrice } from "@/lib/vault";
import type { RealtimeChannel } from "@supabase/supabase-js";

type View =
  | { kind: "list" }
  | { kind: "vault"; friend: FriendRow }
  | { kind: "challenge"; friend: FriendRow }
  | { kind: "battle"; friend: FriendRow; myMon: GBMon };

export function FriendsView({ onOpenCard }: { onOpenCard: (id: string) => void }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState<{ user_id: string; display_name: string | null; email: string | null } | null>(null);
  const [msg, setMsg] = useState<string>("");

  const reload = async () => {
    try {
      const list = await fetchFriendships();
      setFriends(list);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data.user?.id ?? null);
      await reload();
      setLoading(false);
    })();
  }, []);

  // Realtime: refresh friendships when changes come in
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("friendships-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        reload();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me]);

  const accepted = friends.filter((f) => f.direction === "friend");
  const incoming = friends.filter((f) => f.direction === "incoming");
  const outgoing = friends.filter((f) => f.direction === "outgoing");

  async function doSearch() {
    setMsg("");
    setSearch(null);
    if (!email.trim()) return;
    try {
      const u = await searchUserByEmail(email);
      if (!u) setMsg("No trainer found with that email.");
      else if (u.user_id === me) setMsg("That's you!");
      else setSearch(u);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function doSend() {
    if (!search) return;
    try {
      await sendFriendRequest(search.user_id);
      setMsg("Request sent!");
      setSearch(null);
      setEmail("");
      reload();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--t2)" }}>Loading friends…</div>;

  if (!me) {
    return (
      <div style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
        <div className="pv-empty">
          <div className="pv-empty-icon">🤝</div>
          <div className="pv-empty-title">SIGN IN TO ADD FRIENDS</div>
          <div>Friends, vault peek, and PvP need an account. The rest of the beta works as a guest.</div>
          <button className="pv-btn pv-btn-fill" style={{ marginTop: 16 }} onClick={() => { window.location.href = "/login"; }}>Sign in</button>
        </div>
      </div>
    );
  }


  if (view.kind === "vault") {
    return <FriendVaultView friend={view.friend} onBack={() => setView({ kind: "list" })} onOpenCard={onOpenCard} />;
  }
  if (view.kind === "challenge") {
    return <ChallengeLobby friend={view.friend} onBack={() => setView({ kind: "list" })}
      onStart={(myMon) => setView({ kind: "battle", friend: view.friend, myMon })} />;
  }
  if (view.kind === "battle") {
    return <PvPBattle friend={view.friend} myMon={view.myMon} onExit={() => setView({ kind: "list" })} />;
  }

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 18, maxWidth: 760, margin: "0 auto" }}>
      <div className="pv-friend-card">
        <div className="pv-friend-hd">➕ Add a Friend</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input
            placeholder="trainer@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            className="pv-friend-in"
          />
          <button className="pv-friend-btn" onClick={doSearch}>Search</button>
        </div>
        {msg && <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 6 }}>{msg}</div>}
        {search && (
          <div className="pv-friend-row" style={{ marginTop: 8 }}>
            <Avatar name={search.display_name || search.email || "?"} url={null} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{search.display_name || "Trainer"}</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>{search.email}</div>
            </div>
            <button className="pv-friend-btn" onClick={doSend}>Send Request</button>
          </div>
        )}
      </div>

      {incoming.length > 0 && (
        <Section title={`🔔 Incoming (${incoming.length})`}>
          {incoming.map((f) => (
            <div className="pv-friend-row" key={f.friendship.id}>
              <Avatar name={f.other?.display_name || f.other?.email || "?"} url={f.other?.avatar_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{f.other?.display_name || "Trainer"}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{f.other?.email}</div>
              </div>
              <button className="pv-friend-btn" onClick={async () => { await respondFriendRequest(f.friendship.id, true); reload(); }}>Accept</button>
              <button className="pv-friend-btn pv-friend-btn-x" onClick={async () => { await respondFriendRequest(f.friendship.id, false); reload(); }}>Decline</button>
            </div>
          ))}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title={`⏳ Pending (${outgoing.length})`}>
          {outgoing.map((f) => (
            <div className="pv-friend-row" key={f.friendship.id}>
              <Avatar name={f.other?.display_name || f.other?.email || "?"} url={f.other?.avatar_url} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{f.other?.display_name || "Trainer"}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>Awaiting reply…</div>
              </div>
              <button className="pv-friend-btn pv-friend-btn-x" onClick={async () => { await removeFriend(f.friendship.id); reload(); }}>Cancel</button>
            </div>
          ))}
        </Section>
      )}

      <Section title={`👥 Friends (${accepted.length})`}>
        {accepted.length === 0 ? (
          <div style={{ padding: 14, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
            No friends yet. Search by email above to send your first request.
          </div>
        ) : accepted.map((f) => (
          <div className="pv-friend-row" key={f.friendship.id}>
            <Avatar name={f.other?.display_name || f.other?.email || "?"} url={f.other?.avatar_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{f.other?.display_name || "Trainer"}</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>{f.other?.email}</div>
            </div>
            <button className="pv-friend-btn" onClick={() => setView({ kind: "vault", friend: f })}>🔒 Vault</button>
            <button className="pv-friend-btn pv-friend-btn-fight" onClick={() => setView({ kind: "challenge", friend: f })}>⚔ PvP</button>
            <button className="pv-friend-btn pv-friend-btn-x" onClick={async () => { if (confirm("Remove this friend?")) { await removeFriend(f.friendship.id); reload(); } }}>✕</button>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pv-friend-card">
      <div className="pv-friend-hd">{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null | undefined }) {
  if (url) return <img src={url} alt={name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />;
  const init = name.slice(0, 2).toUpperCase();
  return (
    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold)", color: "#111", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
      {init}
    </div>
  );
}

/* ─────────── Friend Vault Viewer ─────────── */

function FriendVaultView({ friend, onBack, onOpenCard }: { friend: FriendRow; onBack: () => void; onOpenCard: (id: string) => void }) {
  const [snap, setSnap] = useState<VaultSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchFriendVault(friend.other!.user_id).then((s) => { setSnap(s); setLoading(false); }).catch((e) => { console.error(e); setLoading(false); });
  }, [friend]);
  return (
    <div style={{ padding: 14, maxWidth: 1100, margin: "0 auto" }}>
      <button className="pv-friend-btn" onClick={onBack}>← Back</button>
      <div style={{ marginTop: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{friend.other?.display_name || "Trainer"}'s Vault</div>
        {snap ? (
          <div style={{ fontSize: 12, color: "var(--t2)" }}>
            {snap.card_count} cards · {formatPrice(Number(snap.total_value))}
          </div>
        ) : null}
      </div>
      {loading ? <div style={{ color: "var(--t2)" }}>Loading…</div> : !snap || !snap.cards.length ? (
        <div style={{ color: "var(--t3)", padding: 20, textAlign: "center" }}>This trainer's vault is empty (or hasn't synced yet).</div>
      ) : (
        <div className="pv-fv-grid">
          {snap.cards.map((e) => (
            <button key={e.card.id} className="pv-fv-card" onClick={() => onOpenCard(e.card.id)}>
              <img src={e.card.images?.small} alt={e.card.name} />
              {e.qty > 1 && <div className="pv-fv-qty">×{e.qty}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── PvP Lobby ─────────── */

function ChallengeLobby({ friend, onBack, onStart }: { friend: FriendRow; onBack: () => void; onStart: (m: GBMon) => void }) {
  const [party, setParty] = useState<GBMon[]>([]);
  const [theirParty, setTheirParty] = useState<GBMon[]>([]);
  useEffect(() => {
    fetchParty().then(setParty);
    fetchFriendParty(friend.other!.user_id).then(setTheirParty).catch(console.error);
  }, [friend]);

  return (
    <div style={{ padding: 14, maxWidth: 760, margin: "0 auto" }}>
      <button className="pv-friend-btn" onClick={onBack}>← Back</button>
      <div style={{ marginTop: 14 }}>
        <div className="pv-friend-card">
          <div className="pv-friend-hd">⚔ Challenge {friend.other?.display_name || "Trainer"}</div>
          <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 8 }}>Their party:</div>
          {theirParty.length === 0 ? <div style={{ fontSize: 12, color: "var(--t3)" }}>They haven't trained any Pokémon yet.</div> : (
            <div className="pv-pvp-team">
              {theirParty.slice(0, 6).map((m) => (
                <div key={m.id} className="pv-pvp-mon">
                  <img src={spriteFor(m.name)} alt={m.name} />
                  <div className="pv-pvp-mn">{m.name}</div>
                  <div className="pv-pvp-mlv">Lv {m.level}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pv-friend-card" style={{ marginTop: 14 }}>
          <div className="pv-friend-hd">Choose your fighter</div>
          {party.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--t3)", padding: 8 }}>
              You don't have any Pokémon yet. Go to the 🎮 Game Boy tab and pick a starter first.
            </div>
          ) : (
            <div className="pv-pvp-team">
              {party.map((m) => (
                <button key={m.id} className="pv-pvp-mon pv-pvp-mon-pick" onClick={() => onStart(m)}>
                  <img src={spriteFor(m.name)} alt={m.name} />
                  <div className="pv-pvp-mn">{m.name}</div>
                  <div className="pv-pvp-mlv">Lv {m.level} · HP {m.max_hp}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Realtime PvP Battle ─────────── */

function PvPBattle({ friend, myMon, onExit }: { friend: FriendRow; myMon: GBMon; onExit: () => void }) {
  const [me, setMe] = useState<string | null>(null);
  const [foeMon, setFoeMon] = useState<GBMon | null>(null);
  const [myHp, setMyHp] = useState(myMon.max_hp);
  const [foeHp, setFoeHp] = useState(0);
  const [log, setLog] = useState<string[]>(["Waiting for opponent to join…"]);
  const [myTurn, setMyTurn] = useState(false);
  const [over, setOver] = useState<null | "win" | "loss">(null);
  const chRef = useRef<RealtimeChannel | null>(null);

  // Deterministic first turn: lower user_id goes first
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id!;
      setMe(uid);
      const foeId = friend.other!.user_id;
      const channelName = pvpChannelName(uid, foeId);
      const ch = joinPvP(channelName, {
        onJoin: (m) => {
          if (m.userId === uid) return;
          setFoeMon(m.mon);
          setFoeHp(m.mon.max_hp);
          setLog((l) => [`${m.name} joined with ${m.mon.name} (Lv ${m.mon.level})!`, ...l]);
          // Lower uid goes first
          setMyTurn(uid < foeId);
        },
        onMove: (m) => {
          if (m.userId === uid) return;
          // Opponent attacked us
          setMyHp(m.targetHp);
          setLog((l) => [`◀ ${m.log}`, ...l]);
          if (m.targetHp <= 0) {
            setOver("loss");
            (async () => {
              await saveMonStats({ ...myMon, losses: myMon.losses + 1 });
            })();
          } else {
            setMyTurn(true);
          }
        },
        onEnd: (m) => {
          if (m.winnerId === uid) setOver("win");
          else setOver("loss");
        },
        onLeave: () => {
          setLog((l) => ["Opponent left the battle.", ...l]);
        },
      });
      chRef.current = ch;
      // Announce join after subscribe
      setTimeout(async () => {
        const { data: prof } = await supabase.from("profiles").select("display_name,email").eq("user_id", uid).maybeSingle();
        const name = prof?.display_name || prof?.email || "Trainer";
        await sendPvP(ch, { kind: "join", userId: uid, name, mon: myMon });
      }, 400);
    })();
    return () => {
      if (chRef.current) {
        sendPvP(chRef.current, { kind: "leave", userId: me ?? "" }).catch(() => {});
        supabase.removeChannel(chRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.other?.user_id]);

  async function attack(move: GBMove) {
    if (!myTurn || !foeMon || !me || over) return;
    const { dmg, eff } = computePvPDamage(myMon, foeMon, move);
    const newFoeHp = Math.max(0, foeHp - dmg);
    setFoeHp(newFoeHp);
    const txt = `${myMon.name} used ${move.name}! ${dmg} dmg${eff === "super" ? " (super!)" : eff === "weak" ? " (weak)" : ""}`;
    setLog((l) => [`▶ ${txt}`, ...l]);
    setMyTurn(false);
    if (chRef.current) {
      await sendPvP(chRef.current, {
        kind: "move", userId: me, move, resultHp: foeHp, targetHp: newFoeHp, log: txt,
      });
    }
    if (newFoeHp <= 0) {
      setOver("win");
      if (chRef.current) await sendPvP(chRef.current, { kind: "end", winnerId: me });
      const { mon: leveled } = gainXP({ ...myMon, wins: myMon.wins + 1 }, 30 + foeMon.level * 10);
      try { await saveMonStats(leveled); } catch (e) { console.error(e); }
    }
  }

  return (
    <div style={{ padding: 14, maxWidth: 760, margin: "0 auto" }}>
      <button className="pv-friend-btn" onClick={onExit}>← Exit Battle</button>
      <div className="pv-pvp-arena">
        <div className="pv-pvp-side">
          <div className="pv-pvp-name">{friend.other?.display_name || "Foe"}</div>
          {foeMon ? (
            <>
              <img className="pv-pvp-actor pv-pvp-actor-foe" src={spriteFor(foeMon.name)} alt={foeMon.name} />
              <div className="pv-pvp-stat">
                <div style={{ fontWeight: 800 }}>{foeMon.name} Lv {foeMon.level}</div>
                <div className="pv-pvp-bar"><span style={{ width: `${(foeHp / foeMon.max_hp) * 100}%` }} /></div>
                <div style={{ fontSize: 10, color: "var(--t3)" }}>HP {foeHp}/{foeMon.max_hp}</div>
              </div>
            </>
          ) : (
            <div style={{ padding: 20, color: "var(--t3)", fontSize: 12 }}>Waiting…</div>
          )}
        </div>
        <div className="pv-pvp-vs">VS</div>
        <div className="pv-pvp-side">
          <div className="pv-pvp-name">You</div>
          <img className="pv-pvp-actor" src={spriteFor(myMon.name)} alt={myMon.name} />
          <div className="pv-pvp-stat">
            <div style={{ fontWeight: 800 }}>{myMon.name} Lv {myMon.level}</div>
            <div className="pv-pvp-bar"><span style={{ width: `${(myHp / myMon.max_hp) * 100}%` }} /></div>
            <div style={{ fontSize: 10, color: "var(--t3)" }}>HP {myHp}/{myMon.max_hp}</div>
          </div>
        </div>
      </div>

      <div className="pv-pvp-log">
        {log.slice(0, 5).map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {over ? (
        <div className="pv-pvp-result" style={{ color: over === "win" ? "var(--gold)" : "#ef4444" }}>
          {over === "win" ? "🏆 You win!" : "💀 You lost."}
        </div>
      ) : (
        <div className="pv-pvp-moves">
          {myMon.attacks.slice(0, 4).map((m, i) => (
            <button key={i} className="pv-pvp-move" disabled={!myTurn || !foeMon} onClick={() => attack(m)}>
              {m.name} <span>·{m.damage}</span>
            </button>
          ))}
          {!myTurn && foeMon && <div style={{ gridColumn: "span 2", textAlign: "center", color: "var(--t3)", fontSize: 11 }}>Opponent's turn…</div>}
          {!foeMon && <div style={{ gridColumn: "span 2", textAlign: "center", color: "var(--t3)", fontSize: 11 }}>Share the lobby — your friend must open PvP with you too.</div>}
        </div>
      )}
    </div>
  );
}
