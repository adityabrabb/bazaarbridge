// -----------------------------------------------------------------------
// api-routes.ts
// Purpose: the JSON API (SPEC.md v2 contract over the section 5 base),
//          one handler per route.
// -----------------------------------------------------------------------

import type { App } from "../app.ts";
import type { ChatInput } from "../agent/agent-runner.ts";
import { HTTP_NOT_FOUND, ServiceError } from "../errors.ts";
import { HTTP_OK, readJsonBody, sendJson } from "./http-utils.ts";
import type { Router } from "./router.ts";
import { openEventStream } from "./sse.ts";
import { handlePaypalWebhook } from "./paypal-webhook.ts";

// -----------------------------------------------------------------------
// registerApiRoutes
// Purpose: attach every /api route to the router.
// -----------------------------------------------------------------------
export function registerApiRoutes(router: Router, app: App): void {
   router.add("GET", "/api/health", ({ res }) => {
      sendJson(res, HTTP_OK, {
         llm: app.agent.llmMode,
         paypal: app.orders.paymentMode,
      });
   });

   router.add("GET", "/api/catalog", ({ res }) => {
      sendJson(res, HTTP_OK, app.store.db.catalog);
   });

   router.add("GET", "/api/conversations", ({ res }) => {
      sendJson(res, HTTP_OK, app.chats.summaries());
   });

   router.add("GET", "/api/conversations/:id", ({ res, params }) => {
      const convo = app.chats.get(params.id ?? "");
      if (!convo) {
         throw new ServiceError(HTTP_NOT_FOUND, "conversation not found");
      }
      sendJson(res, HTTP_OK, convo);
   });

   router.add("POST", "/api/chat", async ({ req, res }) => {
      const body = (await readJsonBody(req)) as Partial<ChatInput>;
      const messages = await app.agent.handle({
         conversationId: body.conversationId ?? "",
         from: body.from as ChatInput["from"],
         text: body.text ?? "",
         customerName: body.customerName,
         channel: body.channel,
         country: body.country,
      });
      sendJson(res, HTTP_OK, { messages });
   });

   router.add("GET", "/api/orders", ({ res }) => {
      sendJson(res, HTTP_OK, app.orders.list());
   });

   router.add("GET", "/api/orders/:id", ({ res, params }) => {
      sendJson(res, HTTP_OK, app.orders.require(params.id ?? ""));
   });

   router.add("GET", "/api/orders/:id/evidence", ({ res, params }) => {
      sendJson(res, HTTP_OK, app.orders.evidence(params.id ?? ""));
   });

   router.add("POST", "/api/orders/:id/refresh", async ({ res, params }) => {
      sendJson(res, HTTP_OK, await app.orders.refresh(params.id ?? ""));
   });

   router.add("POST", "/api/orders/:id/remind", async ({ res, params }) => {
      sendJson(res, HTTP_OK, await app.orders.remind(params.id ?? ""));
   });

   router.add(
      "POST",
      "/api/orders/:id/simulate-payment",
      async ({ res, params }) => {
         const order = await app.orders.simulatePayment(params.id ?? "");
         sendJson(res, HTTP_OK, order);
      },
   );

   router.add("GET", "/api/stats", ({ res }) => {
      sendJson(res, HTTP_OK, app.orders.stats());
   });

   router.add("GET", "/api/events", ({ req, res }) => {
      openEventStream(req, res, app.hub);
   });

   router.add("POST", "/api/webhooks/paypal", async ({ req, res }) => {
      const body = await readJsonBody(req).catch(() => ({}));
      void handlePaypalWebhook(app, body, req.headers);
      // Always 200 quickly so PayPal does not retry; work continues.
      sendJson(res, HTTP_OK, { received: true });
   });

   router.add("POST", "/api/demo/reset", async ({ res }) => {
      await app.store.reset();
      sendJson(res, HTTP_OK, { ok: true });
   });
}
