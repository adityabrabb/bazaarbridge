"use client";
/**
 * The export orders table, built on AG Grid Community. Columns:
 * status, buyer, country, currency, total (buyer currency with the
 * rupee value beside it), actions. Rows are keyed by id so
 * live updates change in place and flash the status cell.
 */
import { useMemo } from "react";
import {
   AllCommunityModule, ModuleRegistry,
   type ColDef, type ICellRendererParams, type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { PostageStamp } from "@/components/common/PostageStamp";
import { useNarrow } from "@/hooks/useNarrow";
import { NARROW_GRID_PX } from "@/lib/constants";
import { countryName, inr, money } from "@/lib/format";
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

/** Country cell: a tiny postage stamp plus the country name. */
function CountryCell(p: ICellRendererParams<Order>) {
   if (!p.data) return null;
   return (
      <span className="countrycell">
         <PostageStamp code={p.data.buyerCountry} size="sm" />
         {countryName(p.data.buyerCountry)}
      </span>
   );
}

/** Total cell: buyer currency first, rupee value beside it. */
function TotalCell(p: ICellRendererParams<Order>) {
   if (!p.data) return null;
   return (
      <span className="totalcell">
         <strong>{money(p.data.total, p.data.currency)}</strong>
         <small>{inr(p.data.totalInr)}</small>
      </span>
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
      { field: "status", headerName: "Status", width: 100,
        cellRenderer: StatusCell, enableCellChangeFlash: true },
      { field: "customerName", headerName: "Buyer", flex: 1,
        minWidth: 104 },
      { field: "buyerCountry", headerName: "Country", width: 176,
        cellRenderer: CountryCell },
      { field: "currency", headerName: "Cur.", width: 76 },
      { field: "total", headerName: "Total (buyer / ₹)", width: 184,
        cellRenderer: TotalCell },
      { headerName: "Actions", width: 262, sortable: false,
        cellRenderer: ActionsCell },
   ], [narrow]);

   /** Tapping a row opens its evidence (buttons keep their job). */
   const onRowClicked = (e: RowClickedEvent<Order>) => {
      const target = e.event?.target as HTMLElement | null;
      if (target?.closest("button") || !e.data) return;
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
