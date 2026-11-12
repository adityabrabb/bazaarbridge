// -----------------------------------------------------------------------
// app.ts
// Purpose: the composition root. Builds the store, services, PayPal
//          gateway and LLM provider from a Config, and returns an HTTP
//          server that is not yet listening (tests listen on port 0).
// -----------------------------------------------------------------------

import { createServer, type Server } from "node:http";
import { AgentRunner } from "./agent/agent-runner.ts";
import type { LlmProvider } from "./agent/llm-provider.ts";
import { MockProvider } from "./agent/mock/mock-provider.ts";
import { AnthropicProvider } from "./agent/providers/anthropic-provider.ts";
import { GeminiProvider } from "./agent/providers/gemini-provider.ts";
import { ConversationService } from "./chat/conversation-service.ts";
import type { Config } from "./config.ts";
import { EXTRA_WEB_ORIGINS } from "./constants.ts";
import { EventHub } from "./events/event-hub.ts";
import { registerApiRoutes } from "./http/api-routes.ts";
import { applyCors, HTTP_NO_CONTENT, sendJson } from "./http/http-utils.ts";
import { registerPageRoutes } from "./http/page-routes.ts";
import { Router, replyWithError } from "./http/router.ts";
import { OrderService } from "./orders/order-service.ts";
import { MockGateway } from "./paypal/mock-gateway.ts";
import type { PaymentGateway } from "./paypal/payment-gateway.ts";
import { SandboxGateway } from "./paypal/sandbox-gateway.ts";
import { JsonStore } from "./store/json-store.ts";
import { HTTP_NOT_FOUND } from "./errors.ts";

export type App = {
   config: Config;
   server: Server;
   store: JsonStore;
   hub: EventHub;
   chats: ConversationService;
   orders: OrderService;
   agent: AgentRunner;
};

export type AppOverrides = {
   gateway?: PaymentGateway;
   provider?: LlmProvider;
};

// -----------------------------------------------------------------------
// buildGateway
// Purpose: sandbox REST gateway when configured, else the mock.
// -----------------------------------------------------------------------
function buildGateway(config: Config): PaymentGateway {
   if (config.paypal.mode === "sandbox") {
      return new SandboxGateway(config.paypal, config.publicBaseUrl);
   }
   return new MockGateway(config.publicBaseUrl);
}

// -----------------------------------------------------------------------
// buildProvider
// Purpose: the configured LLM adapter, else the rule-based mock.
// -----------------------------------------------------------------------
function buildProvider(config: Config): LlmProvider {
   const { mode, apiKey, model } = config.llm;
   if (mode === "anthropic") {
      return new AnthropicProvider({ apiKey, model });
   }
   if (mode === "gemini") {
      return new GeminiProvider({ apiKey, model });
   }
   return new MockProvider();
}

// -----------------------------------------------------------------------
// createApp
// Purpose: wire everything. Side effect: opens/seeds /data/db.json.
// -----------------------------------------------------------------------
export function createApp(config: Config, overrides: AppOverrides = {}): App {
   const store = new JsonStore(config.dataDir);
   const hub = new EventHub();
   const chats = new ConversationService(store, hub);
   const gateway = overrides.gateway ?? buildGateway(config);
   const orders = new OrderService(
      store, hub, chats, gateway, config.publicBaseUrl,
   );
   const provider = overrides.provider ?? buildProvider(config);
   const agent = new AgentRunner(store, chats, orders, provider);
   const router = new Router();
   const app: App = {
      config,
      server: createServer(),
      store,
      hub,
      chats,
      orders,
      agent,
   };
   registerApiRoutes(router, app);
   registerPageRoutes(router, app);
   const origins = [config.webOrigin, ...EXTRA_WEB_ORIGINS];
   app.server.on("request", (req, res) => {
      applyCors(req, res, origins);
      if (req.method === "OPTIONS") {
         res.statusCode = HTTP_NO_CONTENT;
         res.end();
         return;
      }
      router
         .handle(req, res)
         .then((matched) => {
            if (!matched) {
               sendJson(res, HTTP_NOT_FOUND, { error: "not found" });
            }
         })
         .catch((err: unknown) => replyWithError(res, err));
   });
   return app;
}
