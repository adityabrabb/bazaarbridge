"use client";
/**
 * Polls /api/health. Gives the mode badges their data and doubles
 * as the "is the API reachable" signal for the offline banner.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { HEALTH_POLL_MS } from "@/lib/constants";
import type { Health } from "@/lib/types";

export type HealthState = {
   health: Health | null;
   online: boolean;
   checked: boolean;
};

/** Returns the latest health plus an online flag (false on error). */
export function useHealth(): HealthState {
   const [state, setState] = useState<HealthState>({
      health: null, online: false, checked: false,
   });

   useEffect(() => {
      let alive = true;
      /** One poll; failure flips the page into its offline state. */
      const poll = async () => {
         try {
            const health = await api.health();
            if (alive) setState({ health, online: true, checked: true });
         } catch {
            if (alive) {
               setState((s) => ({ ...s, online: false, checked: true }));
            }
         }
      };
      poll();
      const timer = setInterval(poll, HEALTH_POLL_MS);
      return () => {
         alive = false;
         clearInterval(timer);
      };
   }, []);

   return state;
}
