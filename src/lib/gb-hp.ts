/**
 * Adventure battle HP that carries between fights until the party is healed
 * (Poké Center or white-out). Stored per device, keyed by party mon id.
 */
const LS_HP = "pv.gb.hp.v1";

type HpMap = Record<string, number>;

function readMap(): HpMap {
  try {
    const raw = localStorage.getItem(LS_HP);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as HpMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: HpMap): void {
  try {
    if (Object.keys(map).length) localStorage.setItem(LS_HP, JSON.stringify(map));
    else localStorage.removeItem(LS_HP);
  } catch {
    /* private mode / quota */
  }
}

/** Current HP for a mon (defaults to full). Always clamped to 0..max_hp. */
export function getMonHp(mon: { id: string; max_hp: number }): number {
  const max = Number.isFinite(mon.max_hp) && mon.max_hp > 0 ? mon.max_hp : 1;
  const v = readMap()[mon.id];
  if (typeof v !== "number" || !Number.isFinite(v)) return max;
  return Math.max(0, Math.min(max, Math.round(v)));
}

export function setMonHp(mon: { id: string; max_hp: number }, hp: number): void {
  const map = readMap();
  const max = Number.isFinite(mon.max_hp) && mon.max_hp > 0 ? mon.max_hp : 1;
  const v = Math.max(0, Math.min(max, Math.round(hp)));
  if (v >= max) delete map[mon.id];
  else map[mon.id] = v;
  writeMap(map);
}

export function moveMonHp(fromId: string, toId: string): void {
  const map = readMap();
  if (fromId in map) {
    map[toId] = map[fromId];
    delete map[fromId];
    writeMap(map);
  }
}

export function isMonFainted(mon: { id: string; max_hp: number }): boolean {
  return getMonHp(mon) <= 0;
}

/** Poké Center / white-out: everyone back to full HP. */
export function healAllHp(): void {
  writeMap({});
}
