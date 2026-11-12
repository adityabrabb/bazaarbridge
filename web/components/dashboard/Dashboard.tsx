"use client";
/**
 * The seller dashboard column: rupee tiles, orders grid with its
 * actions, and the owner chat. Presentational; the DemoStudio owns
 * all state and passes it in.
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

/** Lays out the dashboard panels top to bottom. */
export function Dashboard(p: Props) {
   const unpaid = p.orders.filter(
      (o) => o.status === "awaiting_payment").length;
   return (
      <div className="dash">
         <StatsTiles stats={p.stats} />
         <section className="panel paper panel--grow">
            <div className="panel__head">
               <h2 className="panel__heading">Export orders</h2>
               <DashboardActions unpaidCount={unpaid} busy={p.busy}
                  onRemindAll={p.onRemindAll} onReset={p.onReset} />
            </div>
            {p.error ? <p className="inlineerr">{p.error}</p> : null}
            <OrdersGrid orders={p.orders} context={p.gridContext} />
         </section>
         <OwnerChat chat={p.ownerChat} />
      </div>
   );
}
