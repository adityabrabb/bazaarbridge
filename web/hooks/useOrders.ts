"use client";
/**
 * Orders list and stats for the dashboard. Loads once, then merges
 * live `order.updated` events. Also detects the moment an order
 * flips to paid so the page can slam the PAID stamp.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Order, Stats } from "@/lib/types";

export type OrdersState = {
   orders: Order[];
   stats: Stats | null;
   error: string | null;
   /** Latest order that just turned paid (null until it happens). */
   justPaid: Order | null;
   reload: () => Promise<void>;
   applyOrder: (order: Order) => void;
};

/** Inserts or replaces an order, newest first by createdAt. */
function upsert(list: Order[], next: Order): Order[] {
   const rest = list.filter((o) => o.id !== next.id);
   return [next, ...rest].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Owns the orders + stats state for the dashboard. */
export function useOrders(online: boolean): OrdersState {
   const [orders, setOrders] = useState<Order[]>([]);
   const [stats, setStats] = useState<Stats | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [justPaid, setJustPaid] = useState<Order | null>(null);
   // Remember the last status per order to spot unpaid -> paid flips.
   const seen = useRef(new Map<string, string>());

   /** Fetches orders and stats together. */
   const reload = useCallback(async () => {
      try {
         const [o, s] = await Promise.all([api.orders(), api.stats()]);
         o.forEach((x) => seen.current.set(x.id, x.status));
         setOrders(o);
         setStats(s);
         setError(null);
      } catch {
         setError("Could not load orders");
      }
   }, []);

   // Reload whenever the API comes (back) online.
   useEffect(() => {
      if (online) reload();
   }, [online, reload]);

   /** Merges one live order; refreshes stats when money moved. */
   const applyOrder = useCallback((order: Order) => {
      const before = seen.current.get(order.id);
      seen.current.set(order.id, order.status);
      setOrders((list) => upsert(list, order));
      if (order.status === "paid" && before !== "paid") {
         setJustPaid(order);
      }
      api.stats().then(setStats).catch(() => undefined);
   }, []);

   return { orders, stats, error, justPaid, reload, applyOrder };
}
