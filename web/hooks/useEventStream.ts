"use client";
/**
 * Subscribes to the core's server-sent events (SPEC section 5) and
 * hands order and message events to the caller. Handlers live in a
 * ref so changing them never tears down the connection.
 */
import { useEffect, useRef, useState } from "react";
import {
   API_URL, EVENT_MESSAGE_CREATED, EVENT_ORDER_UPDATED,
} from "@/lib/constants";
import type { Message, Order } from "@/lib/types";

export type StreamHandlers = {
   onOrder?: (order: Order) => void;
   onMessage?: (message: Message) => void;
};

/** Parses event data safely; a bad payload must not kill the stream. */
function parse<T>(raw: string): T | null {
   try {
      return JSON.parse(raw) as T;
   } catch {
      return null;
   }
}

/** Opens one EventSource for the page; returns whether it is live. */
export function useEventStream(handlers: StreamHandlers): boolean {
   const ref = useRef(handlers);
   const [connected, setConnected] = useState(false);

   // Always point at the latest handlers without reconnecting.
   useEffect(() => {
      ref.current = handlers;
   });

   useEffect(() => {
      // EventSource reconnects by itself after a drop, so we only
      // mirror its state into `connected` for the offline badge.
      const source = new EventSource(`${API_URL}/api/events`);
      source.onopen = () => setConnected(true);
      source.onerror = () => setConnected(false);
      source.addEventListener(EVENT_ORDER_UPDATED, (e) => {
         const order = parse<Order>((e as MessageEvent).data);
         if (order) ref.current.onOrder?.(order);
      });
      source.addEventListener(EVENT_MESSAGE_CREATED, (e) => {
         const msg = parse<Message>((e as MessageEvent).data);
         if (msg) ref.current.onMessage?.(msg);
      });
      return () => source.close();
   }, []);

   return connected;
}
