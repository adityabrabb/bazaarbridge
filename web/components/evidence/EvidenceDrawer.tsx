"use client";
/**
 * Slide-over panel holding one order's evidence pack. Handles the
 * loading and error states itself so the dashboard stays simple;
 * Escape or the backdrop closes it.
 */
import { useEffect } from "react";
import { useEvidence } from "@/hooks/useEvidence";
import type { Order } from "@/lib/types";
import { EvidenceDocument } from "./EvidenceDocument";

type Props = { order: Order | null; onClose: () => void };

/** Renders nothing until an order is chosen. */
export function EvidenceDrawer({ order, onClose }: Props) {
   const version = order ? `${order.status}-${order.reminders}` : "";
   const { pack, loading, error } = useEvidence(
      order?.id ?? null, version);

   // Keyboard users can leave the panel without hunting for X.
   useEffect(() => {
      if (!order) return;
      const onKey = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
   }, [order, onClose]);

   if (!order) return null;
   return (
      <div className="drawer" role="dialog" aria-modal="true"
         aria-label="Evidence pack">
         <div className="drawer__shade" onClick={onClose} />
         <aside className="drawer__panel">
            <button className="btn btn--small drawer__close"
               onClick={onClose}>
               Close
            </button>
            {error ? <p className="inlineerr">{error}</p> : null}
            {loading && !pack ? (
               <p className="drawer__wait">Opening the file...</p>
            ) : null}
            {pack && pack.order.id === order.id ? (
               <EvidenceDocument pack={pack} />
            ) : null}
         </aside>
      </div>
   );
}
