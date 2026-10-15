import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/holofare/HoloFare";
import { hfHead } from "@/components/holofare/head";
import { HF } from "@/lib/holofare";
import log from "@/lib/holofare-buildlog.json";

export const Route = createFileRoute("/holofare/build-log")({ head: () => hfHead("Build log — HoloFare (demo)"), component: BuildLog });

type Item = { id: string; part: string; category: string; title: string; navi: string; naviName: string; status: string };
const COL: Record<string, string> = { usable: HF.mint, stub: HF.gold, failed: HF.magenta, pending: HF.dimLilac };

function BuildLog() {
  const items = (log as { items: Item[] }).items;
  const [f, setF] = useState("all");
  const counts = items.reduce<Record<string, number>>((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {});
  const shown = f === "all" ? items : items.filter((x) => x.status === f);
  return (
    <Shell>
      <h1 className="pt-6 text-[32px] md:text-[40px]" style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 700 }}>Build log</h1>
      <p className="mt-2" style={{ color: HF.softLilac }}>
        Every line item from the HoloFare playbook, the navi desk that reviewed it, and its DAN prompt status. Updated {(log as { updated: string }).updated}.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        {["all", "usable", "stub", "failed", "pending"].map((k) => (
          <button key={k} onClick={() => setF(k)} className="rounded-full px-4" style={{ minHeight: 44, border: `1px solid ${f === k ? HF.cyan : HF.inputBorder}`, color: f === k ? HF.cyan : HF.frost }}>
            {k} ({k === "all" ? items.length : counts[k] || 0})
          </button>
        ))}
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl" style={{ border: `1px solid ${HF.panelBorder}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: HF.deepOrbit, color: HF.softLilac }}><tr>{["ID", "Part", "Category", "Line item", "Navi", "DAN prompt"].map((h) => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} style={{ background: HF.boardNavy, borderTop: `1px solid ${HF.panelBorder}` }}>
                <td className="px-4 py-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: HF.cyan }}>{x.id}</td>
                <td className="px-4 py-2" style={{ color: HF.softLilac }}>{x.part}</td>
                <td className="px-4 py-2" style={{ color: HF.softLilac }}>{x.category}</td>
                <td className="px-4 py-2">{x.title}</td>
                <td className="px-4 py-2">{x.naviName}</td>
                <td className="px-4 py-2 font-semibold" style={{ color: COL[x.status] || HF.frost }}>{x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
