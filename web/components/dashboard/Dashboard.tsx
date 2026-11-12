"use client";
/**
 * The seller's ledger: one sheet with the two lead numbers, the
 * orders list with its actions, and the owner chat at the foot.
 * Presentational; the DemoStudio owns all state and passes it in.
 */
import type { ConversationState } from "@/hooks/useConversation";
import type { Order, Stats } from "@/lib/types";
import { DashboardActions } from "./DashboardActions";
import type { GridContext } from "./OrderActions";
import { OrdersGrid } from "./OrdersGrid";
import { OwnerChat } from "./OwnerChat";
import { StatsTiles } from "./StatsTiles";

type Props = {
   orders: Order[];
   stats: Stats | null;
   error: string | null;
   gridContext: GridContext;
   ownerChat: ConversationState;
   busy: boolean;
   onRemindAll: () => void;
   onReset: () => void;
};

/** Lays out the ledger sheet top to bottom. */
export function Dashboard(p: Props) {
   const unpaid = p.orders.filter(
      (o) => o.status === "awaiting_payment").length;
   return (
      <div className="dash">
         <div className="sheet">
            <div className="sheet__head">
               <h2 className="eyebrow">Seller's ledger</h2>
               <DashboardActions unpaidCount={unpaid} busy={p.busy}
                  onRemindAll={p.onRemindAll} onReset={p.onReset} />
            </div>
            <StatsTiles stats={p.stats} />
            <section className="orders" aria-label="Export orders">
               {p.error ? <p className="inlineerr">{p.error}</p> : null}
               <OrdersGrid orders={p.orders} context={p.gridContext} />
            </section>
            <OwnerChat chat={p.ownerChat} />
         </div>
      </div>
   );
}
