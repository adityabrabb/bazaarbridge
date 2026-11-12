// -----------------------------------------------------------------------
// config-and-fallback.test.ts
// Purpose: mode selection defaults to mock when keys are missing, and a
//          failing real LLM falls back to the mock brain mid-demo.
// -----------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.ts";
import { api, startApp } from "./helpers.ts";

describe("loadConfig", () => {
   it("defaults to mock + mock with notes", () => {
      const c = loadConfig({});
      assert.equal(c.llm.mode, "mock");
      assert.equal(c.paypal.mode, "mock");
      assert.equal(c.port, 8787);
      assert.ok(c.notes.length >= 2);
   });

   it("falls back to mock when keys are missing", () => {
      const c = loadConfig({
         LLM_PROVIDER: "anthropic",
         PAYPAL_ENV: "sandbox",
      });
      assert.equal(c.llm.mode, "mock");
      assert.equal(c.paypal.mode, "mock");
   });

   it("uses real modes and default models when keys exist", () => {
      const a = loadConfig({
         LLM_PROVIDER: "anthropic",
         LLM_API_KEY: "k",
         PAYPAL_ENV: "sandbox",
         PAYPAL_CLIENT_ID: "id",
         PAYPAL_CLIENT_SECRET: "s",
      });
      assert.equal(a.llm.mode, "anthropic");
      assert.equal(a.llm.model, "claude-haiku-5-5");
      assert.equal(a.paypal.mode, "sandbox");
      assert.equal(a.paypal.baseUrl, "https://api-m.sandbox.paypal.com");
      const g = loadConfig({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
      assert.equal(g.llm.mode, "gemini");
      assert.equal(g.llm.model, "gemini-3.8-flash");
   });

   it("survives a bad PORT", () => {
      assert.equal(loadConfig({ PORT: "abc" }).port, 8787);
   });
});

describe("LLM failure fallback", () => {
   it("answers with the mock brain when the provider throws", async () => {
      const t = await startApp({
         provider: {
            mode: "anthropic",
            reply: async () => {
               throw new Error("network down");
            },
         },
      });
      try {
         const r = await api(t.base, "POST", "/api/chat", {
            conversationId: "c_x",
            from: "customer",
            text: "3 scarves to Germany please",
         });
         assert.equal(r.status, 200);
         const card = r.body.messages[0].attachments[0];
         assert.equal(card.type, "quote");
         assert.equal(card.currency, "EUR");
         assert.equal(card.items[0].qty, 3);
      } finally {
         await t.close();
      }
   });
});
