import { useEffect, useMemo, useRef, useState } from "react";
import { hdImg } from "@/lib/card-images";
import { searchCards, getSets, getAllCardsBySet, type TCGCard, type TCGSet } from "@/lib/pokemon-api";
import {
  addToParty,
  fetchParty,
  gainXP,
  levelDamage,
  makeMonFromCard,
  rentalStarter,
  saveMonStats,
  spriteFor,
  wildFoeMon,
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

export type GBBattleFoe = {
  name: string;
  level: number;
  kind?: "wild" | "gym" | "elite" | "champion";
  catchable?: boolean;
  badge?: string;
  e4Index?: number;
  leader?: string;
};

type Scene = "loading" | "starter" | "battle" | "victory" | "defeat";
type BattlePane = "main" | "fight" | "bag" | "switch";

const isPlayable = (c: TCGCard) =>
  c.supertype === "Pokémon" && parseInt(c.hp || "") > 0 && !!c.attacks?.length;

const STARTING_POTIONS = 3;

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function hpColor(pct: number): string {
  if (pct < 25) return "gb-hp-red";
  if (pct < 55) return "gb-hp-yellow";
  return "";
}

export function GBBattleSession({
  foe: foeProps,
  onDone,
  chrome = true,
}: {
  foe: GBBattleFoe;
  onDone: (result: "win" | "lose" | "run" | "cancel") => void;
  /** Include Game Boy bezel chrome (default true for Adventure overlay). */
  chrome?: boolean;
}) {
  const [scene, setScene] = useState<Scene>("loading");
  const [party, setParty] = useState<GBMon[]>([]);
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
  const [catchable, setCatchable] = useState(true);
  const catchableRef = useRef(true);
  const battleKindRef = useRef<"wild" | "gym" | "elite" | "champion">("wild");
  const badgeRef = useRef<string | undefined>(undefined);
  const e4IndexRef = useRef(0);
  const startedRef = useRef(false);
  const pendingFoeRef = useRef(foeProps);

  useEffect(() => {
    pendingFoeRef.current = foeProps;
  }, [foeProps]);

  async function kickoff(mon: GBMon, f: GBMon, kindLabel: string) {
    try {
      const real = await movesAtLevel(f.name, f.level, f.attacks);
      if (real.length) f.attacks = real;
    } catch {}
    setActive(mon);
    setFoe(f);
    setActiveHp(mon.max_hp);
    setFoeHp(f.max_hp);
    const opener =
      kindLabel === "wild"
        ? `A wild ${f.name.toUpperCase()} (Lv ${f.level}) appeared!`
        : `${kindLabel.toUpperCase()} battle — ${f.name.toUpperCase()} (Lv ${f.level})!`;
    const rentalNote = mon.id === "rental-starter" ? `Rental ${mon.name.toUpperCase()} sent out.` : null;
    setLog(rentalNote ? [opener, rentalNote] : [opener]);
    setPane("main");
    setPotions(STARTING_POTIONS);
    setFoeFx("");
    setMeFx("");
    setCatchPhase(null);
    setNotice(null);
    setScene("battle");
  }

  async function beginWithParty(p: GBMon[]) {
    const detail = pendingFoeRef.current;
    const kind = detail.kind || "wild";
    catchableRef.current = detail.catchable !== false && kind === "wild";
    battleKindRef.current = kind;
    badgeRef.current = detail.badge;
    e4IndexRef.current = detail.e4Index ?? 0;
    setCatchable(catchableRef.current);

    const mon = p[0] ?? rentalStarter();
    if (!p[0]) setParty([mon]);
    const lvl = Math.max(2, Math.min(60, detail.level ?? mon.level));
    let foeMon = wildFoeMon(detail.name, lvl);
    try {
      const res = await searchCards({
        q: `name:"${detail.name}" supertype:Pokémon`,
        pageSize: 8,
        orderBy: "-set.releaseDate",
      });
      const pool = res.data.filter(isPlayable);
      const card = pool[0] ?? res.data[0];
      if (card) foeMon = { ...makeMonFromCard(card, lvl), id: "wild" } as GBMon;
    } catch (err) {
      console.error(err);
    }
    await kickoff(mon, foeMon, kind);
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const p = await fetchParty();
        setParty(p);
        await beginWithParty(p);
      } catch (e) {
        console.error(e);
        await beginWithParty([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } catch (e) {
        console.error(e);
      }
      const next = [...party, mon];
      setParty(next);
      setPickedSet(null);
      setSetCards([]);
      setNotice(null);
      await beginWithParty(next);
    } catch (e: any) {
      setNotice(e?.message || "Could not add that Pokémon — try another.");
    } finally {
      setBusy(false);
    }
  }

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
    const hpFactor = 1 - hpPct(foeHp, foe.max_hp) / 100;
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
      window.dispatchEvent(new CustomEvent("pv-adventure-caught", { detail: { name: foe.name } }));
      try {
        const res = await searchCards({
          q: `name:"${foe.name}" supertype:Pokémon`,
          pageSize: 1,
          orderBy: "-set.releaseDate",
        });
        const card = res.data[0];
        if (card) {
          try {
            const mon = await addToParty(card, foe.level);
            try {
              const real = await movesAtLevel(mon.name, mon.level, mon.attacks);
              if (real.length) {
                mon.attacks = real;
                await saveMonStats(mon);
              }
            } catch {}
            setParty((p) => [...p, mon]);
          } catch (e) {
            console.error(e);
          }
        }
      } catch (e) {
        console.error(e);
      }
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
        } catch (e) {
          console.error(e);
        }
      }
      try {
        await saveMonStats(mon);
      } catch (e) {
        console.error(e);
      }
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
      try {
        await saveMonStats(loser);
      } catch (e) {
        console.error(e);
      }
      setParty((p) => p.map((x) => (x.id === loser.id ? loser : x)));
      setScene("defeat");
    }
    setBusy(false);
  }

  const body = (
    <>
      {notice && (
        <div className="gb-notice" role="status">
          <div className="gb-line">{notice}</div>
          <button className="gb-mi gb-mi-sm" onClick={() => setNotice(null)}>
            OK
          </button>
        </div>
      )}
      {scene === "loading" && <div className="gb-line">LOADING…</div>}
      {scene === "starter" && (
        <StarterPicker
          sets={sets}
          pickedSet={pickedSet}
          cards={setCards}
          loading={setsLoading}
          busy={busy}
          onSet={loadSet}
          onPick={pickStarter}
          onBack={() => onDone("cancel")}
          emptyHint="Your party is empty. Pick a starter to battle."
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
          catchPhase={catchPhase}
          catchable={catchable}
          atkClip={atkClip}
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
          onRun={() => onDone("run")}
        />
      )}
      {scene === "victory" && active && (
        <ResultScreen
          title="VICTORY!"
          mon={active}
          extra={gained ? `+${gained} XP — Next Lv: ${active.xp}/${xpForNext(active.level)}` : "Caught it!"}
          onContinue={() => onDone("win")}
        />
      )}
      {scene === "defeat" && active && (
        <ResultScreen
          title="WHITE OUT…"
          mon={active}
          extra="Your Pokémon fainted. Heal at a Poké Center and try again."
          onContinue={() => onDone("lose")}
        />
      )}
    </>
  );

  if (!chrome) {
    return <div className="gb-screen gb-screen-embed">{body}</div>;
  }

  return (
    <div className="gb-wrap gb-wrap-embed">
      <div className="gb-frame">
        <div className="gb-top">
          <div className="gb-led" />
          <div className="gb-brand">GAME BOY COLOR · ADVENTURE BATTLE</div>
          <div className="gb-dot-cluster">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="gb-screen">
          <div className="gb-scanlines" aria-hidden />
          {body}
        </div>
        <div className="gb-controls">
          <div className="gb-dpad" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="gb-ab">
            <button type="button" className="gb-btn" aria-label="B" onClick={() => pressGbFace("B")}>B</button>
            <button type="button" className="gb-btn" aria-label="A" onClick={() => pressGbFace("A")}>A</button>
          </div>
        </div>
        <div className="gb-startsel">
          <div className="gb-pill-wrap">
            <div className="gb-pill" />
            <span>SELECT</span>
          </div>
          <div className="gb-pill-wrap">
            <div className="gb-pill" />
            <span>START</span>
          </div>
        </div>
        <div className="gb-speaker">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function StarterPicker({
  sets,
  pickedSet,
  cards,
  loading,
  busy,
  onSet,
  onPick,
  onBack,
  emptyHint,
}: {
  sets: TCGSet[];
  pickedSet: TCGSet | null;
  cards: TCGCard[];
  loading: boolean;
  busy: boolean;
  onSet: (s: TCGSet) => void;
  onPick: (c: TCGCard) => void;
  onBack: () => void;
  emptyHint?: string;
}) {
  const setGrid = useMemo(() => sets.slice(0, 80), [sets]);
  if (!pickedSet) {
    return (
      <div className="gb-page">
        <div className="gb-line gb-line-hd">CHOOSE A STARTER</div>
        {emptyHint && <div className="gb-line gb-line-sm">{emptyHint}</div>}
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
        <button className="gb-mi gb-mi-sm" onClick={onBack}>
          BACK
        </button>
      </div>
    );
  }
  return (
    <div className="gb-page">
      <div className="gb-line gb-line-hd">{pickedSet.name.toUpperCase()}</div>
      {loading ? (
        <div className="gb-line">LOADING…</div>
      ) : (
        <div className="gb-grid">
          {cards.map((c) => (
            <button key={c.id} className="gb-card" disabled={busy} onClick={() => onPick(c)}>
              <img {...hdImg(c)} alt={c.name} />
              <div className="gb-cname">{c.name}</div>
              <div className="gb-cmeta">
                HP {c.hp} · {(c.types || []).join("/")}
              </div>
            </button>
          ))}
        </div>
      )}
      <button className="gb-mi gb-mi-sm" onClick={onBack}>
        BACK
      </button>
    </div>
  );
}

function BattleScreen({
  me,
  meHp,
  foe,
  foeHp,
  meFx,
  foeFx,
  catchPhase,
  catchable,
  atkClip,
  log,
  busy,
  pane,
  party,
  potions,
  onPane,
  onMove,
  onPotion,
  onSwitch,
  onCatch,
  onRun,
}: {
  me: GBMon;
  meHp: number;
  foe: GBMon;
  foeHp: number;
  meFx: string;
  foeFx: string;
  catchPhase: CatchPhase | null;
  catchable: boolean;
  atkClip: string | null;
  log: string[];
  busy: boolean;
  pane: BattlePane;
  party: GBMon[];
  potions: number;
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
        {atkClip && <video key={atkClip} className="gb-atk-vid" src={atkClip} autoPlay muted playsInline />}
        <div className="gb-bf">
          <div className="gb-side gb-foe">
            <div className={`gb-stat ${foeLow}`}>
              <div className="gb-stat-name">
                {foe.name.toUpperCase()} <span>Lv{foe.level}</span>
              </div>
              <div className="gb-hpbar">
                <span className={hpColor(foeHpPct)} style={{ width: `${foeHpPct}%` }} />
              </div>
              <div className="gb-hp-text">
                HP {foeHp}/{foe.max_hp}
              </div>
            </div>
            <img
              className={`gb-actor gb-actor-foe gb-fx-${foeFx}`}
              src={animatedSpriteUrl(foe.name)}
              alt={foe.name}
              onError={(e) => {
                e.currentTarget.src = staticSpriteUrl(foe.name);
              }}
            />
          </div>
          <div className="gb-side gb-me">
            <img
              className={`gb-actor gb-actor-me gb-fx-${meFx}`}
              src={backSpriteUrl(me.name)}
              alt={me.name}
              onError={(e) => {
                e.currentTarget.src = backSpriteFallback(me.name);
              }}
            />
            <div className={`gb-stat ${meLow}`}>
              <div className="gb-stat-name">
                {me.name.toUpperCase()} <span>Lv{me.level}</span>
              </div>
              <div className="gb-hpbar">
                <span className={hpColor(meHpPct)} style={{ width: `${meHpPct}%` }} />
              </div>
              <div className="gb-hp-text">
                HP {meHp}/{me.max_hp} · XP {me.xp}/{xpForNext(me.level)}
              </div>
            </div>
          </div>
        </div>
        <CatchFx phase={catchPhase} />
      </div>
      <div className="gb-log">
        {log.slice(0, 3).map((l, i) => (
          <div key={`${i}-${l}`} className="gb-log-line">
            {l}
          </div>
        ))}
        {pane === "main" && !busy && <div className="gb-log-line">What will {me.name.toUpperCase()} do?</div>}
      </div>

      {pane === "main" && (
        <div className="gb-moves">
          <button className="gb-move" disabled={busy} onClick={() => onPane("fight")}>
            FIGHT
          </button>
          <button className="gb-move" disabled={busy} onClick={() => onPane("bag")}>
            BAG
          </button>
          <button className="gb-move" disabled={busy || party.length < 2} onClick={() => onPane("switch")}>
            POKéMON
          </button>
          <button className="gb-move gb-move-run" disabled={busy} onClick={onRun}>
            RUN
          </button>
        </div>
      )}

      {pane === "fight" && (
        <div className="gb-moves gb-moves-4">
          {moves.map((m, i) => (
            <button key={i} className="gb-move" disabled={busy || !m.damage} onClick={() => m.damage && onMove(m)}>
              {m.name} {m.damage ? <span>·{m.damage}</span> : null}
            </button>
          ))}
          <button className="gb-move gb-move-run" disabled={busy} onClick={() => onPane("main")}>
            BACK
          </button>
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
          <button className="gb-move gb-move-run" disabled={busy} onClick={() => onPane("main")}>
            BACK
          </button>
        </div>
      )}

      {pane === "switch" && (
        <div className="gb-switch">
          {party.map((m) => (
            <button key={m.id} className="gb-switch-item" disabled={busy || m.id === me.id} onClick={() => onSwitch(m)}>
              <img src={spriteFor(m.name)} alt={m.name} />
              <div>
                <div className="gb-pm-name">{m.name.toUpperCase()}</div>
                <div className="gb-pm-meta">
                  Lv {m.level} · HP {m.max_hp}
                </div>
              </div>
              {m.id === me.id && <span className="gb-tag">ACTIVE</span>}
            </button>
          ))}
          <button className="gb-move gb-move-run" disabled={busy} onClick={() => onPane("main")}>
            BACK
          </button>
        </div>
      )}
    </div>
  );
}

function ResultScreen({
  title,
  mon,
  extra,
  onContinue,
}: {
  title: string;
  mon: GBMon;
  extra: string;
  onContinue: () => void;
}) {
  return (
    <div className="gb-page">
      <div className="gb-line gb-line-hd">{title}</div>
      <img className="gb-actor" src={spriteFor(mon.name)} alt={mon.name} style={{ margin: "10px auto" }} />
      <div className="gb-line">
        {mon.name.toUpperCase()} Lv {mon.level}
      </div>
      <div className="gb-line gb-line-sm">{extra}</div>
      <button className="gb-mi" onClick={onContinue}>
        CONTINUE
      </button>
    </div>
  );
}
