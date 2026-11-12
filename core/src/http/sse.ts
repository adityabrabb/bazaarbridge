// -----------------------------------------------------------------------
// sse.ts
// Purpose: GET /api/events as Server-Sent Events. Each hub event is
//          written as "event: <type>" + "data: <json>". A comment line
//          every few seconds keeps proxies from closing idle streams.
// -----------------------------------------------------------------------

import type { IncomingMessage, ServerResponse } from "node:http";
import { SSE_KEEPALIVE_MS } from "../constants.ts";
import type { EventHub, HubEvent } from "../events/event-hub.ts";
import { HTTP_OK } from "./http-utils.ts";

const RETRY_MS = 3_000;

// -----------------------------------------------------------------------
// openEventStream
// Purpose: hold the response open and forward hub events until the
//          client disconnects. Side effect: subscribes to the hub.
// -----------------------------------------------------------------------
export function openEventStream(
   req: IncomingMessage,
   res: ServerResponse,
   hub: EventHub,
): void {
   res.writeHead(HTTP_OK, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops reverse proxies (and Next.js dev rewrites) from buffering.
      "X-Accel-Buffering": "no",
   });
   res.write(`retry: ${RETRY_MS}\n: connected\n\n`);
   const send = (event: HubEvent) => {
      if (res.writableEnded) {
         return;
      }
      res.write(
         `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
      );
   };
   const unsubscribe = hub.subscribe(send);
   const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
         res.write(": ping\n\n");
      }
   }, SSE_KEEPALIVE_MS);
   const close = () => {
      clearInterval(keepAlive);
      unsubscribe();
   };
   req.on("close", close);
   res.on("error", close);
}
