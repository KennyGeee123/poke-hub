import { useEffect, useState } from "react";

export type PrintLang = {
  id: string;
  label: string;
  name: string;
  region: "intl" | "asia";
};

export const PRINT_LANGS: PrintLang[] = [
  { id: "en", label: "EN", name: "English", region: "intl" },
  { id: "ja", label: "日本語", name: "Japanese", region: "asia" },
  { id: "zh-tw", label: "繁中", name: "Chinese (Traditional)", region: "asia" },
  { id: "zh-cn", label: "简中", name: "Chinese (Simplified)", region: "asia" },
  { id: "ko", label: "한국어", name: "Korean", region: "asia" },
  { id: "th", label: "ไทย", name: "Thai", region: "asia" },
  { id: "fr", label: "FR", name: "French", region: "intl" },
  { id: "de", label: "DE", name: "German", region: "intl" },
  { id: "es", label: "ES", name: "Spanish", region: "intl" },
  { id: "it", label: "IT", name: "Italian", region: "intl" },
  { id: "pt-br", label: "PT", name: "Portuguese", region: "intl" },
];

const KEY = "pv.printLang";
const EVT = "pv-print-lang";

export function getPrintLang(): string {
  if (typeof localStorage === "undefined") return "en";
  const v = localStorage.getItem(KEY);
  return PRINT_LANGS.some((l) => l.id === v) ? (v as string) : "en";
}

export function setPrintLang(id: string) {
  if (!PRINT_LANGS.some((l) => l.id === id)) return;
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new CustomEvent(EVT, { detail: id }));
}

export function printLangMeta(id?: string | null): PrintLang {
  return PRINT_LANGS.find((l) => l.id === id) ?? PRINT_LANGS[0];
}

export function usePrintLang(): [string, (id: string) => void] {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    setLang(getPrintLang());
    const h = (e: Event) => setLang((e as CustomEvent).detail as string);
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return [lang, setPrintLang];
}

export const SEARCH_CHIPS: Record<string, string[]> = {
  ja: ["ピカチュウ", "リザードン", "ミュウツー", "ルギア", "レックウザ"],
  "zh-tw": ["皮卡丘", "噴火龍", "超夢", "洛奇亞"],
  "zh-cn": ["皮卡丘", "喷火龙", "超梦", "洛奇亚"],
  ko: ["피카츄", "리자몽", "뮤츠", "루기아"],
  th: ["พิคาชู", "ลิซาร์ดอน", "มิวทู"],
  fr: ["Dracaufeu", "Pikachu", "Mewtwo", "Lugia"],
  de: ["Glurak", "Pikachu", "Mewtu", "Lugia"],
  es: ["Charizard", "Pikachu", "Mewtwo", "Lugia"],
  it: ["Charizard", "Pikachu", "Mewtwo", "Lugia"],
  "pt-br": ["Charizard", "Pikachu", "Mewtwo", "Lugia"],
};

export function searchChips(lang: string): string[] {
  const core = SEARCH_CHIPS[lang] ?? ["Charizard", "Pikachu", "Mewtwo", "Lugia", "Rayquaza"];
  if (lang === "en") return ["Shadowless", "Shadowless Charizard", ...core];
  return [...core, "Shadowless"];
}

export function searchPlaceholder(lang: string): string {
  if (lang === "ja") return "名前で検索（リザードン、ピカチュウ…）";
  if (lang === "zh-tw" || lang === "zh-cn") return "按名称搜索（喷火龙 / 皮卡丘…）";
  if (lang === "ko") return "이름으로 검색 (리자몽, 피카츄…)";
  if (lang === "th") return "ค้นหาชื่อ (ลิซาร์ดอน, พิคาชู…)";
  if (lang === "fr") return "Rechercher (Dracaufeu, Pikachu…)";
  if (lang === "de") return "Suchen (Glurak, Pikachu…)";
  return "Search by name — typos ok (charzard, shadowless, pikachu)…";
}
