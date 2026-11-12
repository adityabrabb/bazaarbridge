/**
 * Four numbers the seller scans first, all in rupees: money in,
 * paid count, unpaid count, money still out. The two money tiles
 * carry a small per-currency breakdown (what buyers actually paid
 * or owe) so the exchange-rate story is visible.
 */
import { inr, money } from "@/lib/format";
import type { CurrencyTotals, Stats } from "@/lib/types";

type Tile = {
   key: string; label: string; hindi: string; value: string;
   sub?: string; tone: "ink" | "paper" | "red";
};

/** "£59.70 · $142.00" for one side (paid or unpaid) of the split. */
function breakdown(rows: CurrencyTotals[], side: "paid" | "unpaid") {
   return rows
      .filter((r) => r[side] > 0)
      .map((r) => money(r[side], r.currency))
      .join(" · ");
}

/** Builds the tile list; dashes while stats have not loaded. */
function tilesFor(stats: Stats | null): Tile[] {
   const dash = "--";
   const rows = stats?.byCurrency ?? [];
   return [
      { key: "collected", label: "Collected", hindi: "वसूली",
        value: stats ? inr(stats.collectedInr) : dash,
        sub: breakdown(rows, "paid"), tone: "ink" },
      { key: "paid", label: "Paid orders", hindi: "चुकता",
        value: stats ? String(stats.paidCount) : dash, tone: "paper" },
      { key: "unpaid", label: "Unpaid orders", hindi: "बाकी",
        value: stats ? String(stats.unpaidCount) : dash, tone: "paper" },
      { key: "stuck", label: "Still to collect", hindi: "बकाया",
        value: stats ? inr(stats.unpaidInr) : dash,
        sub: breakdown(rows, "unpaid"), tone: "red" },
   ];
}

/** Renders the tiles as a responsive row. */
export function StatsTiles({ stats }: { stats: Stats | null }) {
   return (
      <section className="tiles" aria-label="Export numbers">
         {tilesFor(stats).map((t) => (
            <div key={t.key} className={`tile tile--${t.tone}`}>
               <div className="tile__label">
                  <span>{t.label}</span>
                  <span lang="hi">{t.hindi}</span>
               </div>
               <div className="tile__value">{t.value}</div>
               <div className="tile__sub">{t.sub || " "}</div>
            </div>
         ))}
      </section>
   );
}
