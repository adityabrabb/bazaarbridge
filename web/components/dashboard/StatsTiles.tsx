/**
 * The strip at the top of the ledger: two rupee numbers lead
 * (collected, still to collect). Order counts and the per-currency
 * breakdown (what buyers actually paid or owe, so the exchange-rate
 * story shows) sit under each number as quiet supporting text.
 */
import { inr, money } from "@/lib/format";
import type { CurrencyTotals, Stats } from "@/lib/types";

/** "£59.70 · $142.00" for one side (paid or unpaid) of the split. */
function breakdown(rows: CurrencyTotals[], side: "paid" | "unpaid") {
   return rows
      .filter((r) => r[side] > 0)
      .map((r) => money(r[side], r.currency))
      .join(" · ");
}

type Lead = {
   key: string; label: string; hindi: string; value: string; sub: string;
};

/** Builds the two leads; dashes while stats have not loaded. */
function leadsFor(stats: Stats | null): Lead[] {
   const dash = "--";
   const rows = stats?.byCurrency ?? [];
   const count = (n: number, word: string) => `${n} ${word}`;
   return [
      { key: "in", label: "Collected", hindi: "वसूली",
        value: stats ? inr(stats.collectedInr) : dash,
        sub: stats ? [count(stats.paidCount, "paid"),
           breakdown(rows, "paid")].filter(Boolean).join(" · ") : "" },
      { key: "out", label: "Still to collect", hindi: "बकाया",
        value: stats ? inr(stats.unpaidInr) : dash,
        sub: stats ? [count(stats.unpaidCount, "unpaid"),
           breakdown(rows, "unpaid")].filter(Boolean).join(" · ") : "" },
   ];
}

/** Renders the two-number strip. */
export function StatsTiles({ stats }: { stats: Stats | null }) {
   return (
      <section className="strip" aria-label="Export numbers">
         {leadsFor(stats).map((t) => (
            <div key={t.key} className={`strip__lead strip__lead--${t.key}`}>
               <div className="strip__label">
                  <span>{t.label}</span>
                  <span lang="hi">{t.hindi}</span>
               </div>
               <div className="strip__value">{t.value}</div>
               <div className="strip__sub">{t.sub || " "}</div>
            </div>
         ))}
      </section>
   );
}
