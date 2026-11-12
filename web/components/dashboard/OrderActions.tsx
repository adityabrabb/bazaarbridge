"use client";
/**
 * Action buttons inside one grid row: open the evidence pack,
 * send a reminder (unpaid only), and in PayPal mock mode only,
 * simulate the buyer paying. With real PayPal, unpaid rows get a
 * Refresh button instead, to re-check the order with PayPal.
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

/** Renders the row's buttons; disabled while its call is running. */
export function OrderActions(
   { order, ctx }: { order: Order; ctx: GridContext },
) {
   const busy = ctx.busyId === order.id;
   const unpaid = order.status === "awaiting_payment";
   return (
      <div className="rowactions">
         <button className="btn btn--small btn--evidence"
            onClick={() => ctx.onEvidence(order.id)}>
            Evidence
         </button>
         {unpaid ? (
            <button className="btn btn--small btn--red" disabled={busy}
               onClick={() => ctx.onRemind(order.id)}>
               Remind
            </button>
         ) : null}
         {unpaid && ctx.mockPayPal ? (
            <button className="btn btn--small btn--ink" disabled={busy}
               onClick={() => ctx.onSimulate(order.id)}>
               Sim. pay
            </button>
         ) : null}
         {unpaid && !ctx.mockPayPal ? (
            <button className="btn btn--small" disabled={busy}
               onClick={() => ctx.onRefresh(order.id)}>
               Refresh
            </button>
         ) : null}
      </div>
   );
}
