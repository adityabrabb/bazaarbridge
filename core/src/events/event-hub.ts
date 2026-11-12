// -----------------------------------------------------------------------
// event-hub.ts
// Purpose: in-process pub/sub for the two live event types the web app
//          listens to over SSE: order.updated and message.created.
// -----------------------------------------------------------------------

import { EventEmitter } from "node:events";
import type { Message, Order } from "../types.ts";

export type HubEvent =
   | { type: "order.updated"; data: Order }
   | { type: "message.created"; data: Message };

const CHANNEL = "event";
// Each open browser tab adds one listener; lift Node's default cap of 10.
const MAX_LISTENERS = 200;

export class EventHub {
   private emitter = new EventEmitter();

   // --------------------------------------------------------------------
   // constructor
   // Purpose: create a hub with a raised listener cap.
   // --------------------------------------------------------------------
   constructor() {
      this.emitter.setMaxListeners(MAX_LISTENERS);
   }

   // --------------------------------------------------------------------
   // publish
   // Purpose: send an event to every subscriber. A throwing subscriber
   //          is logged and skipped so it cannot break the request that
   //          caused the event.
   // --------------------------------------------------------------------
   publish(event: HubEvent): void {
      for (const listener of this.emitter.listeners(CHANNEL)) {
         try {
            (listener as (e: HubEvent) => void)(event);
         } catch (err) {
            console.warn("[events] listener failed:", (err as Error).message);
         }
      }
   }

   // --------------------------------------------------------------------
   // subscribe
   // Purpose: register a listener; returns the unsubscribe function.
   // --------------------------------------------------------------------
   subscribe(listener: (e: HubEvent) => void): () => void {
      this.emitter.on(CHANNEL, listener);
      return () => this.emitter.off(CHANNEL, listener);
   }
}
