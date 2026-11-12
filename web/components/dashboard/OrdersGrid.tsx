"use client";
/**
 * The export orders list, built on AG Grid Community. Columns:
 * status, buyer (with country), total (buyer currency, code and rupee
 * value), age with reminder count, actions. Rows are keyed by id so
 * live updates change in place and flash the status cell.
 */
import { useMemo } from "react";
import {
   AllCommunityModule, ModuleRegistry,
   type ColDef, type ICellRendererParams, type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useNarrow } from "@/hooks/useNarrow";
import { NARROW_GRID_PX } from "@/lib/constants";
import { ageOf, countryName, inr, money } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { exportTheme } from "./gridTheme";
import { OrderActions, type GridContext } from "./OrderActions";

// Register AG Grid's community feature set once per page load.
ModuleRegistry.registerModules([AllCommunityModule]);

const STATUS_LABEL: Record<OrderStatus, string> = {
   draft: "Quote",
   awaiting_payment: "Unpaid",
   paid: "Paid",
   cancelled: "Cancelled",
};

/** Status cell: a chip coloured by state (red = needs attention). */
function StatusCell(p: ICellRendererParams<Order, OrderStatus>) {
   const status = p.value ?? "draft";
   return (
      <span className={`status status--${status}`}>
         {STATUS_LABEL[status]}
      </span>
   );
}

/** Actions cell: delegates to OrderActions with the grid context. */
function ActionsCell(p: ICellRendererParams<Order>) {
   if (!p.data) return null;
   return <OrderActions order={p.data} ctx={p.context as GridContext} />;
}

/** Buyer cell: name, then the country underneath. */
function WhoCell(p: ICellRendererParams<Order>) {
   if (!p.data) return null;
   return (
      <div className="twoline">
         <strong>{p.data.customerName}</strong>
         <small>{countryName(p.data.buyerCountry)}</small>
      </div>
   );
}

/** Total cell: buyer-currency amount, then code and rupee value. */
function TotalCell(p: ICellRendererParams<Order>) {
   if (!p.data) return null;
   return (
      <div className="twoline">
         <strong>{money(p.data.total, p.data.currency)}</strong>
         <small>{p.data.currency} · {inr(p.data.totalInr)}</small>
      </div>
   );
}

/** Follow-up cell: how old the order is and how often we nudged. */
function FollowCell(p: ICellRendererParams<Order>) {
   if (!p.data) return null;
   const n = p.data.reminders;
   return (
      <div className="twoline">
         <strong>{ageOf(p.data.createdAt)}</strong>
         <small>{n === 0 ? "no reminders" :
            `${n} reminder${n === 1 ? "" : "s"}`}</small>
      </div>
   );
}

/** Compact buyer cell for phones: name, then country and total. */
function BuyerCell(p: ICellRendererParams<Order>) {
   if (!p.data) return null;
   return (
      <div className="twoline">
         <strong>
            {p.data.customerName} · {p.data.buyerCountry}
         </strong>
         <small>
            {money(p.data.total, p.data.currency)} · {inr(p.data.totalInr)}
         </small>
      </div>
   );
}

type Props = { orders: Order[]; context: GridContext };

/** Renders the grid; columns are memoised so they do not reset. */
export function OrdersGrid({ orders, context }: Props) {
   const narrow = useNarrow(NARROW_GRID_PX);
   const columns = useMemo<ColDef<Order>[]>(() => narrow ? [
      { field: "status", headerName: "Status", width: 80,
        cellRenderer: StatusCell, enableCellChangeFlash: true },
      { headerName: "Buyer", flex: 1, minWidth: 110,
        cellRenderer: BuyerCell },
      { headerName: "Actions", width: 140, pinned: "right",
        sortable: false, cellRenderer: ActionsCell },
   ] : [
      { field: "status", headerName: "Status", width: 104,
        cellRenderer: StatusCell, enableCellChangeFlash: true },
      { headerName: "Buyer", flex: 1, minWidth: 150,
        cellRenderer: WhoCell },
      { headerName: "Total", width: 150, cellRenderer: TotalCell },
      { headerName: "Age", width: 140, cellRenderer: FollowCell },
      { headerName: "", width: 250, sortable: false,
        cellRenderer: ActionsCell },
   ], [narrow]);

   /** Tapping a row opens its evidence (buttons keep their job). */
   const onRowClicked = (e: RowClickedEvent<Order>) => {
      const target = e.event?.target as HTMLElement | null;
      if (target?.closest("button, a") || !e.data) return;
      context.onEvidence(e.data.id);
   };

   return (
      <div className="grid">
         <AgGridReact<Order>
            theme={exportTheme}
            rowData={orders}
            columnDefs={columns}
            context={context}
            getRowId={(p) => p.data.id}
            onRowClicked={onRowClicked}
            suppressCellFocus
            overlayNoRowsTemplate="No orders yet. Send a message first."
         />
      </div>
   );
}
