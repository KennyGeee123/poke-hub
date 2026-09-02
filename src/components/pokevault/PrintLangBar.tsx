import { PRINT_LANGS, usePrintLang } from "@/lib/print-lang";

export function PrintLangBar() {
  const [lang, setLang] = usePrintLang();
  return (
    <div className="flex gap-1 flex-wrap mb-3" role="group" aria-label="Card print language">
      {PRINT_LANGS.map((l) => (
        <button
          key={l.id}
          className={`pv-pill ${lang === l.id ? "on" : ""}`}
          title={l.name}
          onClick={() => setLang(l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
