import { useEffect, useMemo, useRef, useState } from "react";
import { hdImg } from "@/lib/card-images";
import { searchCards, getSets, getAllCardsBySet, type TCGCard, type TCGSet } from "@/lib/pokemon-api";
import {
  addToParty,
  fetchParty,
  gainXP,
  levelDamage,
  makeMonFromCard,
  releaseMon,
  saveMonStats,
  spriteFor,
  xpForNext,
  type GBMon,
  type GBMove,
} from "@/lib/gbgame";
import { animatedSpriteUrl, backSpriteUrl, backSpriteFallback, staticSpriteUrl } from "@/lib/sprites";
import { hpPct } from "@/lib/battle";
import { movesAtLevel, newlyLearned } from "@/lib/pokeapi-moves";
import { CatchFx, type CatchPhase } from "./CatchFx";
import { ARENA_CLIP, battleClipFor } from "@/lib/battle-cine";
import { pressGbFace } from "@/lib/gb-face";

type Scene = "menu" | "party" | "starter" | "battle" | "victory" | "defeat";
type BattlePane = "main" | "fight" | "bag" | "switch";

const isPlayable = (c: TCGCard) =>
  c.supertype === "Pokémon" && parseInt(c.hp || "") > 0 && !!c.attacks?.length;

const STARTING_POTIONS = 3;

export function GameBoyView() {
  const [scene, setScene] = useState<Scene>("menu");
  const [party, setParty] = useState<GBMon[]>([]);
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<TCGSet[]>([]);
  const [pickedSet, setPickedSet] = useState<TCGSet | null>(null);
  const [setCards, setSetCards] = useState<TCGCard[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [active, setActive] = useState<GBMon | null>(null);
  const [foe, setFoe] = useState<GBMon | null>(null);
  const [activeHp, setActiveHp] = useState(0);
  const [foeHp, setFoeHp] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [gained, setGained] = useState(0);
  const [pane, setPane] = useState<BattlePane>("main");
  const [potions, setPotions] = useState(STARTING_POTIONS);
  const [foeFx, setFoeFx] = useState<"" | "hit" | "flash" | "faint">("");
  const [meFx, setMeFx] = useState<"" | "hit" | "flash" | "faint">("");
  const [catchPhase, setCatchPhase] = useState<CatchPhase | null>(null);
  const [atkClip, setAtkClip] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fromAdventureRef = useRef(false);
  const catchableRef = useRef(true);
  const battleKindRef = useRef<"wild" | "gym" | "elite" | "champion">("wild");
  const badgeRef = useRef<string | undefined>(undefined);
  const e4IndexRef = useRef<number>(0);
  const [catchable, setCatchable] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchParty();
        setParty(p);
        for (const m of p) {
          try {
            const real = await movesAtLevel(m.name, m.level, m.attacks);
            const same = real.length === m.attacks.length && real.every((r, i) => r.name === m.attacks[i]?.name);
            if (real.length && !same) {
              const updated = { ...m, attacks: real };
              await saveMonStats(updated);
              setParty((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
            }
          } catch {}
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (scene === "starter" && !sets.length) {
      getSets().then(setSets).catch(console.error);
    }
  }, [scene, sets.length]);

  async function loadSet(s: TCGSet) {
    setPickedSet(s);
    setSetCards([]);
    setSetsLoading(true);
    try {
      const res = await getAllCardsBySet(s.id, undefined, s.name);
      setSetCards(res.data.filter(isPlayable));
    } finally {
      setSetsLoading(false);
    }
  }

  async function pickStarter(card: TCGCard) {
    setBusy(true);
    try {
      const mon = await addToParty(card, 5);
      try {
        const real = await movesAtLevel(mon.name, mon.level, mon.attacks);
        if (real.length) {
          mon.attacks = real;
          await saveMonStats(mon);
        }
      } catch (e) { console.error(e); }
      setParty((p) => [...p, mon]);
      setScene("party");
      setPickedSet(null);
      setSetCards([]);
      setNotice(null);
    } catch (e: any) {
      setNotice(e?.message || "Could not add that Pokémon — try another.");
    } finally {
      setBusy(false);
    }
  }

  function startBattle(mon: GBMon) {
    const lvl = Math.max(1, mon.level + (Math.random() < 0.5 ? -1 : 1) + Math.floor(Math.random() * 3) - 1);
    if (setCards.length) {
      const c = setCards[Math.floor(Math.random() * setCards.length)];
      kickoff(mon, c, lvl);
    } else {
      searchCards({
        q: `supertype:Pokémon hp:[60 TO 200]`,
        page: Math.floor(Math.random() * 30) + 1,
        pageSize: 20,
      }).then((r) => {
        const pool = r.data.filter(isPlayable);
        const c = pool[Math.floor(Math.random() * pool.length)];
        if (c) kickoff(mon, c, lvl);
      });
    }
  }

  async function kickoff(mon: GBMon, foeCard: TCGCard, lvl: number) {
    const f = { ...makeMonFromCard(foeCard, lvl), id: "wild" } as GBMon;
    try {
      const real = await movesAtLevel(f.name, f.level, f.attacks);
      if (real.length) f.attacks = real;
    } catch {}
    setActive(mon);
    setFoe(f);
    setActiveHp(mon.max_hp);
    setFoeHp(f.max_hp);
    setLog([`A wild ${f.name.toUpperCase()} (Lv ${f.level}) appeared!`]);
    setPane("main");
    setPotions(STARTING_POTIONS);
    setFoeFx(""); setMeFx("");
    setCatchPhase(null);
    setNotice(null);
    setScene("battle");
  }

  useEffect(() => {
    const onWild = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        name?: string; level?: number; kind?: "wild" | "gym" | "elite" | "champion";
        catchable?: boolean; badge?: string; e4Index?: number; leader?: string;
      };
      if (!detail?.name) return;
      catchableRef.current = detail.catchable !== false && (detail.kind || "wild") === "wild";
      battleKindRef.current = detail.kind || "wild";
      badgeRef.current = detail.badge;
      e4IndexRef.current = detail.e4Index ?? 0;
      setCatchable(catchableRef.current);
      const mon = party[0];
      if (!mon) {
        setNotice("Choose a starter first — then Fight in Adventure.");
        setScene("starter");
        return;
      }
      try {
        const res = await searchCards({
          q: `name:"${detail.name}" supertype:Pokémon`,
          pageSize: 8,
          orderBy: "-set.releaseDate",
        });
        const pool = res.data.filter(isPlayable);
        const card = pool[0] ?? res.data[0];
        if (!card) return;
        const lvl = Math.max(2, Math.min(60, detail.level ?? mon.level));
        fromAdventureRef.current = true;
        await kickoff(mon, card, lvl);
      } catch (err) { console.error(err); }
    };
    // Adventure overlay owns in-tab fights; this listener remains for Game Boy tab sandbox.
    window.addEventListener("pv-gb-wild", onWild as EventListener);
    return () => window.removeEventListener("pv-gb-wild", onWild as EventListener);
  }, [party]);

  async function playerAttack(move: GBMove) {
    if (busy || !active || !foe) return;
    setBusy(true);
    setPane("main");
    const { dmg, eff } = levelDamage(move, active.level, foe.types, active.types);
    setAtkClip(battleClipFor(move.name, active.types?.[0]));
    setFoeFx("flash");
    await wait(180);
    setFoeFx("hit");
    const newFoeHp = Math.max(0, foeHp - dmg);
    setFoeHp(newFoeHp);
    setLog((l) => [
      `▶ ${active.name.toUpperCase()} used ${move.name}!  ${dmg} dmg${eff === "super" ? " ★ super effective!" : eff === "weak" ? " (not very effective)" : ""}`,
      ...l,
    ]);
    await wait(550);
    setFoeFx("");
    setAtkClip(null);

    if (newFoeHp <= 0) {
      setFoeFx("faint");
      await wait(500);
      await endBattle(true);
      return;
    }
    await foeTurn();
  }

  async function foeTurn() {
    if (!active || !foe) return;
    const fmove = foe.attacks[Math.floor(Math.random() * foe.attacks.length)];
    const fdmg = levelDamage(fmove, foe.level, active.types, foe.types).dmg;
    setAtkClip(battleClipFor(fmove.name, foe.types?.[0]));
    setMeFx("flash");
    await wait(180);
    setMeFx("hit");
    const newPlayerHp = Math.max(0, activeHp - fdmg);
    setActiveHp(newPlayerHp);
    setLog((l) => [`◀ Foe ${foe.name.toUpperCase()} used ${fmove.name}!  ${fdmg} dmg`, ...l]);
    await wait(550);
    setMeFx("");
    setAtkClip(null);
    if (newPlayerHp <= 0) {
      setMeFx("faint");
      await wait(500);
      await endBattle(false);
      return;
    }
    setBusy(false);
  }

  async function usePotion() {
    if (busy || !active || potions <= 0) return;
    setBusy(true);
    setPane("main");
    const maxHp = Number.isFinite(active.max_hp) && active.max_hp > 0 ? active.max_hp : 1;
    const heal = Math.max(0, Math.min(maxHp - activeHp, 30));
    setActiveHp((h) => Math.max(0, Math.min(maxHp, h + heal)));

    setPotions((p) => p - 1);
    setLog((l) => [`✚ Used POTION. Restored ${heal} HP.`, ...l]);
    await wait(500);
    await foeTurn();
  }

  async function switchTo(mon: GBMon) {
    if (busy || !active || mon.id === active.id) return;
    setBusy(true);
    setPane("main");
    // save current mon HP not persisted (HP is per-battle)
    setActive(mon);
    setActiveHp(mon.max_hp);
    setLog((l) => [`↺ Go! ${mon.name.toUpperCase()}!`, ...l]);
    await wait(500);
    await foeTurn();
  }

  async function tryCatch() {
    if (busy || !active || !foe) return;
    if (!catchableRef.current) {
      setLog((l) => [`You can't catch a trainer's Pokémon!`, ...l]);
      return;
    }
    setBusy(true);
    setPane("main");
    // Catch chance scales with missing HP and inverse level.
    const hpFactor = 1 - hpPct(foeHp, foe.max_hp) / 100; // 0..1
    const lvlFactor = Math.max(0.15, 1 - foe.level / 80);
    const chance = Math.min(0.92, 0.18 + hpFactor * 0.55 + lvlFactor * 0.25);
    setLog((l) => [`🎯 Threw a POKÉ BALL at ${foe.name.toUpperCase()}!`, ...l]);
    setCatchPhase("throw");
    await wait(750);
    setCatchPhase("shake");
    await wait(1900);
    if (Math.random() < chance) {
      setCatchPhase("caught");
      setLog((l) => [`✨ Gotcha! ${foe.name.toUpperCase()} was caught!`, ...l]);
      try {
        const res = await searchCards({ q: `name:"${foe.name}" supertype:Pokémon`, pageSize: 1, orderBy: "-set.releaseDate" });
        const card = res.data[0];
        if (card) {
          try {
            const mon = await addToParty(card, foe.level);
            try {
              const real = await movesAtLevel(mon.name, mon.level, mon.attacks);
              if (real.length) { mon.attacks = real; await saveMonStats(mon); }
            } catch {}
            setParty((p) => [...p, mon]);
          } catch (e) { console.error(e); }
        }
      } catch (e) { console.error(e); }
      await wait(1100);
      setCatchPhase(null);
      setScene("victory");
      setGained(0);
      setBusy(false);
      return;
    }
    setCatchPhase("broke");
    setLog((l) => [`💢 Oh no! ${foe.name.toUpperCase()} broke free!`, ...l]);
    await wait(800);
    setCatchPhase(null);
    await foeTurn();
  }

  async function endBattle(won: boolean) {
    if (!active || !foe) return;
    if (won) {
      const xp = 25 + foe.level * 12;
      const oldLevel = active.level;
      let { mon, leveled } = gainXP({ ...active, wins: active.wins + 1 }, xp);
      setGained(xp);
      const learnedLogs: string[] = [];
      if (leveled) {
        try {
          const learned = await newlyLearned(mon.name, oldLevel, mon.level);
          if (learned.length) {
            let attacks = [...mon.attacks];
            for (const nm of learned) {
              if (attacks.find((a) => a.name === nm.name)) continue;
              if (attacks.length < 4) attacks.push(nm);
              else {
                const widx = attacks.reduce((wi, a, i, arr) => (a.damage < arr[wi].damage ? i : wi), 0);
                if (nm.damage > attacks[widx].damage) {
                  learnedLogs.push(`📘 ${mon.name} forgot ${attacks[widx].name} and learned ${nm.name}!`);
                  attacks[widx] = nm;
                  continue;
                }
              }
              learnedLogs.push(`📘 ${mon.name} learned ${nm.name}!`);
            }
            mon = { ...mon, attacks };
          }
        } catch (e) { console.error(e); }
      }
      try { await saveMonStats(mon); } catch (e) { console.error(e); }
      setActive(mon);
      setParty((p) => p.map((x) => (x.id === mon.id ? mon : x)));
      setLog((l) => [
        ...learnedLogs,
        leveled ? `🌟 ${mon.name} grew to Lv ${mon.level}!` : `+${xp} XP`,
        `🏆 Victory!`,
        ...l,
      ]);
      const kind = battleKindRef.current;
      if (kind === "gym" && badgeRef.current) {
        window.dispatchEvent(new CustomEvent("pv-adv-gym-won", { detail: { badge: badgeRef.current } }));
      }
      if (kind === "elite" || kind === "champion") {
        window.dispatchEvent(new CustomEvent("pv-adv-elite-won", { detail: { index: e4IndexRef.current } }));
      }
      setScene("victory");
    } else {
      const loser = { ...active, losses: active.losses + 1 };
      try { await saveMonStats(loser); } catch (e) { console.error(e); }
      setParty((p) => p.map((x) => (x.id === loser.id ? loser : x)));
      setScene("defeat");
    }
    setBusy(false);
  }

  async function release(id: string) {
    if (!confirm("Release this Pokémon? This cannot be undone.")) return;
    await releaseMon(id);
    setParty((p) => p.filter((m) => m.id !== id));
  }

  if (loading) return <div className="gb-frame"><div className="gb-screen"><div className="gb-line">LOADING…</div></div></div>;

  return (
    <div className="gb-wrap">
      <div className="gb-frame">
        <div className="gb-top">
          <div className="gb-led" />
          <div className="gb-brand">GAME BOY COLOR · DOT MATRIX WITH STEREO SOUND</div>
          <div className="gb-dot-cluster"><span /><span /><span /></div>
        </div>
        <div className="gb-screen">
          <div className="gb-scanlines" aria-hidden />
          {notice && (
            <div className="gb-notice" role="status">
              <div className="gb-line">{notice}</div>
              <button className="gb-mi gb-mi-sm" onClick={() => setNotice(null)}>OK</button>
            </div>
          )}
          {scene === "menu" && (
            <Menu
              party={party}
              onContinue={() => setScene(party.length ? "party" : "starter")}
              onParty={() => setScene(party.length ? "party" : "starter")}
              onStarter={() => setScene("starter")}
            />
          )}
          {scene === "party" && (
            <PartyView
              party={party}
              onBattle={(m) => startBattle(m)}
              onAdd={() => setScene("starter")}
              onRelease={release}
              onBack={() => setScene("menu")}
            />
          )}
          {scene === "starter" && (
            <StarterPicker
              sets={sets}
              pickedSet={pickedSet}
              cards={setCards}
              loading={setsLoading}
              busy={busy}
              onSet={loadSet}
              onPick={pickStarter}
              onBack={() => { setPickedSet(null); setScene(party.length ? "party" : "menu"); }}
            />
          )}
          {scene === "battle" && active && foe && (
            <BattleScreen
              me={active}
              meHp={activeHp}
              foe={foe}
              foeHp={foeHp}
              meFx={meFx}
              foeFx={foeFx}
              catchPhase={catchPhase} catchable={catchable} atkClip={atkClip}
              log={log}
              busy={busy}
              pane={pane}
              party={party}
              potions={potions}
              onPane={setPane}
              onMove={playerAttack}
              onPotion={usePotion}
              onSwitch={switchTo}
              onCatch={tryCatch}
              onRun={() => setScene("party")}
            />
          )}
          {scene === "victory" && active && (
            <ResultScreen
              title="VICTORY!"
              mon={active}
              extra={gained ? `+${gained} XP — Next Lv: ${active.xp}/${xpForNext(active.level)}` : "Caught it!"}
              onContinue={() => {
                const back = fromAdventureRef.current;
                fromAdventureRef.current = false;
                setScene("party");
                if (back) window.dispatchEvent(new CustomEvent("pv-goto", { detail: "adventure" }));
              }}
            />
          )}
          {scene === "defeat" && active && (
            <ResultScreen
              title="WHITE OUT…"
              mon={active}
              extra="Your Pokémon fainted. Heal at the Party screen and try again."
              onContinue={() => {
                const back = fromAdventureRef.current;
                fromAdventureRef.current = false;
                setScene("party");
                if (back) window.dispatchEvent(new CustomEvent("pv-goto", { detail: "adventure" }));
              }}
            />
          )}
        </div>
        <div className="gb-controls">
          <div className="gb-dpad" aria-hidden>
            <span /><span /><span /><span /><span />
          </div>
          <div className="gb-ab">
            <button type="button" className="gb-btn" aria-label="B" onClick={() => pressGbFace("B")}>B</button>
            <button type="button" className="gb-btn" aria-label="A" onClick={() => pressGbFace("A")}>A</button>
          </div>
        </div>
        <div className="gb-startsel">
          <div className="gb-pill-wrap"><div className="gb-pill" /><span>SELECT</span></div>
          <div className="gb-pill-wrap"><div className="gb-pill" /><span>START</span></div>
        </div>
        <div className="gb-speaker"><span /><span /><span /><span /><span /><span /></div>
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/* ─────────── Sub-screens ─────────── */

function Menu({ party, onContinue, onParty, onStarter }: {
  party: GBMon[]; onContinue: () => void; onParty: () => void; onStarter: () => void;
}) {
  return (
    <div className="gb-page">
      <div className="gb-title">POKÉVAULT</div>
      <div className="gb-sub">GAME BOY COLOR</div>
      {party.length > 0 && (
        <div className="gb-menu-preview">
          {party.slice(0, 6).map((m) => (
            <img
              key={m.id}
              className="gb-sprite"
              src={spriteFor(m.name)}
              alt={m.name}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>
      )}
      <div className="gb-menu">
        <button className="gb-mi" onClick={onContinue} disabled={!party.length}>CONTINUE</button>
        <button className="gb-mi" onClick={onParty} disabled={!party.length}>
          PARTY{party.length ? `  (${party.length})` : ""}
        </button>
        <button className="gb-mi" onClick={onStarter}>NEW TRAINER</button>
      </div>
      <div className="gb-foot">© POKÉVAULT — TCG RPG</div>
    </div>
  );
}

function PartyView({
  party, onBattle, onAdd, onRelease, onBack,
}: { party: GBMon[]; onBattle: (m: GBMon) => void; onAdd: () => void; onRelease: (id: string) => void; onBack: () => void }) {
  if (!party.length) {
    return (
      <div className="gb-page">
        <div className="gb-line">PARTY IS EMPTY</div>
        <div className="gb-line gb-line-sm">Catch in Adventure, or pick a starter.</div>
        <button className="gb-mi" onClick={onAdd}>CATCH A POKÉMON</button>
        <button className="gb-mi gb-mi-sm" onClick={onBack}>BACK</button>
      </div>
    );
  }
  return (
    <div className="gb-page">
      <div className="gb-line gb-line-hd">▼ YOUR PARTY ▼</div>
      <div className="gb-line gb-line-sm">FIGHT in grass · CATCH from BAG</div>
      <div className="gb-party">
        {party.map((m) => (
          <div className="gb-pm" key={m.id}>
            <img className="gb-sprite" src={spriteFor(m.name)} alt={m.name} onError={(e) => ((e.currentTarget.style.display = "none"))} />
            <div className="gb-pm-info">
              <div className="gb-pm-name">{m.name.toUpperCase()}</div>
              <div className="gb-pm-meta">Lv {m.level} · {m.wins}W / {m.losses}L</div>
              <div className="gb-type-pills">
                {(m.types.length ? m.types : ["—"]).map((t) => (
                  <span key={t} className="gb-type-pill">{t}</span>
                ))}
              </div>
              <div className="gb-hpbar" title="HP">
                <span style={{ width: "100%" }} />
              </div>
              <div className="gb-hp-text">HP {m.max_hp}/{m.max_hp}</div>
              <div className="gb-xpbar"><span style={{ width: `${Math.min(100, (m.xp / xpForNext(m.level)) * 100)}%` }} /></div>
            </div>
            <div className="gb-pm-acts">
              <button className="gb-mi gb-mi-sm" onClick={() => onBattle(m)}>FIGHT</button>
              <button className="gb-mi gb-mi-sm gb-mi-x" onClick={() => onRelease(m.id)}>RELEASE</button>
            </div>
          </div>
        ))}
      </div>
      <div className="gb-row">
        <button className="gb-mi gb-mi-sm" onClick={onAdd}>+ ADD</button>
        <button className="gb-mi gb-mi-sm" onClick={onBack}>MENU</button>
      </div>
    </div>
  );
}

function StarterPicker({
  sets, pickedSet, cards, loading, busy, onSet, onPick, onBack,
}: {
  sets: TCGSet[]; pickedSet: TCGSet | null; cards: TCGCard[]; loading: boolean; busy: boolean;
  onSet: (s: TCGSet) => void; onPick: (c: TCGCard) => void; onBack: () => void;
}) {
  const setGrid = useMemo(() => sets.slice(0, 80), [sets]);
  if (!pickedSet) {
    return (
      <div className="gb-page">
        <div className="gb-line gb-line-hd">CHOOSE A SET</div>
        <div className="gb-set-grid">
          {setGrid.map((s) => (
            <button key={s.id} className="gb-set-tile" onClick={() => onSet(s)}>
              {s.images?.symbol ? (
                <img src={s.images.symbol} alt="" />
              ) : (
                <span className="gb-set-fallback">{s.name.slice(0, 1)}</span>
              )}
              <span className="gb-set-name">{s.name.toUpperCase()}</span>
              <span className="gb-set-year">{s.releaseDate?.slice(0, 4)}</span>
            </button>
          ))}
        </div>
        <button className="gb-mi gb-mi-sm" onClick={onBack}>BACK</button>
      </div>
    );
  }
  return (
    <div className="gb-page">
      <div className="gb-line gb-line-hd">{pickedSet.name.toUpperCase()}</div>
      {loading ? <div className="gb-line">LOADING…</div> : (
        <div className="gb-grid">
          {cards.map((c) => (
            <button key={c.id} className="gb-card" disabled={busy} onClick={() => onPick(c)}>
              <img {...hdImg(c)} alt={c.name} />
              <div className="gb-cname">{c.name}</div>
              <div className="gb-cmeta">HP {c.hp} · {(c.types || []).join("/")}</div>
            </button>
          ))}
        </div>
      )}
      <button className="gb-mi gb-mi-sm" onClick={onBack}>BACK</button>
    </div>
  );
}

function BattleScreen({
  me, meHp, foe, foeHp, meFx, foeFx, catchPhase, catchable, atkClip, log, busy, pane, party, potions,
  onPane, onMove, onPotion, onSwitch, onCatch, onRun,
}: {
  me: GBMon; meHp: number; foe: GBMon; foeHp: number;
  meFx: string; foeFx: string;
  catchPhase: CatchPhase | null;
  catchable: boolean;
  atkClip: string | null;
  log: string[]; busy: boolean; pane: BattlePane;
  party: GBMon[]; potions: number;
  onPane: (p: BattlePane) => void;
  onMove: (m: GBMove) => void;
  onPotion: () => void;
  onSwitch: (m: GBMon) => void;
  onCatch: () => void;
  onRun: () => void;
}) {
  const meHpPct = hpPct(meHp, me.max_hp);
  const foeHpPct = hpPct(foeHp, foe.max_hp);

  const meLow = meHpPct < 25 ? "gb-low" : "";
  const foeLow = foeHpPct < 25 ? "gb-low" : "";
  const moves = me.attacks.slice(0, 4);
  while (moves.length < 4) moves.push({ name: "—", damage: 0 });

  return (
    <div className="gb-page gb-battle">
      <div className={`gb-arena ${catchPhase ? `pv-catching-${catchPhase}` : ""}`}>
      <video className="gb-arena-vid" src={ARENA_CLIP} autoPlay muted loop playsInline preload="none" />
      {atkClip && (
        <video key={atkClip} className="gb-atk-vid" src={atkClip} autoPlay muted playsInline />
      )}
      <div className="gb-bf">
        <div className="gb-side gb-foe">
          <div className={`gb-stat ${foeLow}`}>
            <div className="gb-stat-name">{foe.name.toUpperCase()} <span>Lv{foe.level}</span></div>
            <div className="gb-hpbar"><span className={hpColor(foeHpPct)} style={{ width: `${foeHpPct}%` }} /></div>
            <div className="gb-hp-text">HP {foeHp}/{foe.max_hp}</div>
          </div>
          <img
            className={`gb-actor gb-actor-foe gb-fx-${foeFx}`}
            src={animatedSpriteUrl(foe.name)}
            alt={foe.name}
            onError={(e) => { e.currentTarget.src = staticSpriteUrl(foe.name); }}
          />
        </div>
        <div className="gb-side gb-me">
          <img
            className={`gb-actor gb-actor-me gb-fx-${meFx}`}
            src={backSpriteUrl(me.name)}
            alt={me.name}
            onError={(e) => { e.currentTarget.src = backSpriteFallback(me.name); }}
          />
          <div className={`gb-stat ${meLow}`}>
            <div className="gb-stat-name">{me.name.toUpperCase()} <span>Lv{me.level}</span></div>
            <div className="gb-hpbar"><span className={hpColor(meHpPct)} style={{ width: `${meHpPct}%` }} /></div>
            <div className="gb-hp-text">HP {meHp}/{me.max_hp} · XP {me.xp}/{xpForNext(me.level)}</div>
          </div>
        </div>
      </div>
      <CatchFx phase={catchPhase} />
      </div>
      <div className="gb-log">
        {log.slice(0, 3).map((l, i) => <div key={`${i}-${l}`} className="gb-log-line">{l}</div>)}
        {pane === "main" && !busy && (
          <div className="gb-log-line">What will {me.name.toUpperCase()} do?</div>
        )}
      </div>

      {pane === "main" && (
        <div className="gb-moves">
          <button className="gb-move" disabled={busy} onClick={() => onPane("fight")}>FIGHT</button>
          <button className="gb-move" disabled={busy} onClick={() => onPane("bag")}>BAG</button>
          <button className="gb-move" disabled={busy || party.length < 2} onClick={() => onPane("switch")}>POKéMON</button>
          <button className="gb-move gb-move-run" disabled={busy} onClick={onRun}>RUN</button>
        </div>
      )}

      {pane === "fight" && (
        <div className="gb-moves gb-moves-4">
          {moves.map((m, i) => (
            <button
              key={i}
              className="gb-move"
              disabled={busy || !m.damage}
              onClick={() => m.damage && onMove(m)}
            >
              {m.name} {m.damage ? <span>·{m.damage}</span> : null}
            </button>
          ))}
          <button className="gb-move gb-move-run" disabled={busy} onClick={() => onPane("main")}>BACK</button>
        </div>
      )}

      {pane === "bag" && (
        <div className="gb-moves">
          <button className="gb-move" disabled={busy || potions <= 0} onClick={onPotion}>
            POTION <span>×{potions} ·30HP</span>
          </button>
          <button className="gb-move" disabled={busy || !catchable} onClick={onCatch}>
            {catchable ? "POKé BALL" : "CAN'T CATCH"}
          </button>
          <button className="gb-move gb-move-run" disabled={busy} onClick={() => onPane("main")}>BACK</button>
        </div>
      )}

      {pane === "switch" && (
        <div className="gb-switch">
          {party.map((m) => (
            <button
              key={m.id}
              className="gb-switch-item"
              disabled={busy || m.id === me.id}
              onClick={() => onSwitch(m)}
            >
              <img src={spriteFor(m.name)} alt={m.name} />
              <div>
                <div className="gb-pm-name">{m.name.toUpperCase()}</div>
                <div className="gb-pm-meta">Lv {m.level} · HP {m.max_hp}</div>
              </div>
              {m.id === me.id && <span className="gb-tag">ACTIVE</span>}
            </button>
          ))}
          <button className="gb-move gb-move-run" disabled={busy} onClick={() => onPane("main")}>BACK</button>
        </div>
      )}
    </div>
  );
}

function hpColor(pct: number): string {
  if (pct < 25) return "gb-hp-red";
  if (pct < 55) return "gb-hp-yellow";
  return "";
}

function ResultScreen({ title, mon, extra, onContinue }: { title: string; mon: GBMon; extra: string; onContinue: () => void }) {
  return (
    <div className="gb-page">
      <div className="gb-line gb-line-hd">{title}</div>
      <img className="gb-actor" src={spriteFor(mon.name)} alt={mon.name} style={{ margin: "10px auto" }} />
      <div className="gb-line">{mon.name.toUpperCase()} Lv {mon.level}</div>
      <div className="gb-line gb-line-sm">{extra}</div>
      <button className="gb-mi" onClick={onContinue}>CONTINUE</button>
    </div>
  );
}
