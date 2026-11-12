"use client";
/**
 * Actions inside one grid row. One primary button (Remind, unpaid
 * rows only); everything else is a quiet text link: Evidence opens
 * the pack (the whole row does too), "Sim. pay" in PayPal mock mode,
 * and Refresh on unpaid rows with real PayPal.
 */
import type { Order } from "@/lib/types";

export type GridContext = {
   mockPayPal: boolean;
   busyId: string | null;
   onRefresh: (id: string) => void;
   onRemind: (id: string) => void;
   onSimulate: (id: string) => void;
   onEvidence: (id: string) => void;
};

/** Renders the row's actions; disabled while its call is running. */
export function OrderActions(
   { order, ctx }: { order: Order; ctx: GridContext },
) {
   const busy = ctx.busyId === order.id;
   const unpaid = order.status === "awaiting_payment";
   return (
      <div className="rowactions">
         {unpaid ? (
            <button className="btn btn--small btn--red" disabled={busy}
               onClick={() => ctx.onRemind(order.id)}>
               Remind
            </button>
         ) : null}
         <button className="linkbtn linkbtn--evidence"
            onClick={() => ctx.onEvidence(order.id)}>
            Evidence
         </button>
         {unpaid && ctx.mockPayPal ? (
            <button className="linkbtn" disabled={busy}
               onClick={() => ctx.onSimulate(order.id)}>
               Sim. pay
            </button>
         ) : null}
         {unpaid && !ctx.mockPayPal ? (
            <button className="linkbtn" disabled={busy}
               onClick={() => ctx.onRefresh(order.id)}
               aria-label="Re-check with PayPal" title="Re-check with PayPal">
               Refresh
            </button>
         ) : null}
      </div>
   );
}
