"use client";
/**
 * Buyer list for the switcher: the demo's "new buyer" (Emma) first,
 * then the seeded buyers from /api/conversations.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
   NEW_CUSTOMER_CHANNEL, NEW_CUSTOMER_COUNTRY, NEW_CUSTOMER_ID,
   NEW_CUSTOMER_NAME,
} from "@/lib/constants";
import type { Channel } from "@/lib/types";

export type Customer = {
   id: string; name: string; country?: string; channel: Channel;
};

const NEW_CUSTOMER: Customer = {
   id: NEW_CUSTOMER_ID, name: NEW_CUSTOMER_NAME,
   country: NEW_CUSTOMER_COUNTRY, channel: NEW_CUSTOMER_CHANNEL,
};

/** Loads buyer conversations; reloadable after a demo reset. */
export function useCustomers(online: boolean) {
   const [customers, setCustomers] = useState<Customer[]>([NEW_CUSTOMER]);

   /** Fetches summaries and keeps only buyer chats. */
   const reload = useCallback(async () => {
      try {
         const list = await api.conversations();
         const others = list
            .filter((c) => c.kind === "customer")
            .filter((c) => c.id !== NEW_CUSTOMER_ID)
            .map((c) => ({ id: c.id, name: c.customerName,
               country: c.country, channel: c.channel }));
         setCustomers([NEW_CUSTOMER, ...others]);
      } catch {
         setCustomers([NEW_CUSTOMER]);
      }
   }, []);

   useEffect(() => {
      if (online) reload();
   }, [online, reload]);

   return { customers, reload };
}
