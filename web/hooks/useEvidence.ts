"use client";
/**
 * Loads GET /api/orders/:id/evidence for the open drawer. `version`
 * changes when the order changes (e.g. it just got paid), which
 * re-fetches so the pack never shows stale proof.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EvidencePack } from "@/lib/types";

export type EvidenceState = {
   pack: EvidencePack | null;
   loading: boolean;
   error: string | null;
};

/** Fetches the pack whenever the order id or version changes. */
export function useEvidence(
   orderId: string | null, version: string,
): EvidenceState {
   const [state, setState] = useState<EvidenceState>(
      { pack: null, loading: false, error: null });

   useEffect(() => {
      if (!orderId) return;
      let alive = true;
      setState((s) => ({ ...s, loading: true, error: null }));
      api.evidence(orderId)
         .then((pack) => {
            if (alive) setState({ pack, loading: false, error: null });
         })
         .catch(() => {
            if (alive) {
               setState({ pack: null, loading: false,
                  error: "Could not load the evidence pack." });
            }
         });
      return () => { alive = false; };
   }, [orderId, version]);

   return state;
}
