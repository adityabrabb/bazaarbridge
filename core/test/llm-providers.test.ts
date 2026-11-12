// -----------------------------------------------------------------------
// llm-providers.test.ts
// Purpose: the Anthropic and Gemini adapters' request construction and
//          tool loops, against a stubbed fetch (no network, no keys).
// -----------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReplyRequest } from "../src/agent/llm-provider.ts";
import {
   AnthropicProvider,
} from "../src/agent/providers/anthropic-provider.ts";
import { GeminiProvider } from "../src/agent/providers/gemini-provider.ts";
import { toolsFor } from "../src/agent/tool-specs.ts";
import { SEED_CATALOG } from "../src/store/seed-data.ts";
import { stubFetch } from "./helpers.ts";

// -----------------------------------------------------------------------
// makeRequest
// Purpose: a ReplyRequest whose runTool records calls.
// -----------------------------------------------------------------------
function makeRequest(calls: Array<{ name: string; args: unknown }>) {
   const req: ReplyRequest = {
      system: "SYSTEM PROMPT",
      history: [{ role: "user", text: "2 cushion covers to the UK" }],
      tools: toolsFor("customer"),
      runTool: async (name, args) => {
         calls.push({ name, args });
         return { ok: true, content: JSON.stringify({ total: 3 }) };
      },
      kind: "customer",
      catalog: SEED_CATALOG,
      draft: undefined,
      country: "GB",
   };
   return req;
}

describe("AnthropicProvider", () => {
   it("runs the tool_use loop with the documented request shape", async () => {
      const stub = stubFetch((_req, i) => {
         if (i === 0) {
            return {
               json: {
                  id: "msg_1",
                  type: "message",
                  role: "assistant",
                  model: "claude-haiku-5-5",
                  content: [
                     { type: "text", text: "Preparing your quote." },
                     {
                        type: "tool_use",
                        id: "toolu_1",
                        name: "get_quote",
                        input: {
                           items: [{ sku: "CUSHION-BP", qty: 2 }],
                           country: "GB",
                        },
                     },
                  ],
                  stop_reason: "tool_use",
                  stop_sequence: null,
                  usage: { input_tokens: 10, output_tokens: 5 },
               },
            };
         }
         return {
            json: {
               id: "msg_2",
               type: "message",
               role: "assistant",
               model: "claude-haiku-5-5",
               content: [{ type: "text", text: "Total $3.00. Confirm?" }],
               stop_reason: "end_turn",
               stop_sequence: null,
               usage: { input_tokens: 20, output_tokens: 5 },
            },
         };
      });
      const provider = new AnthropicProvider({
         apiKey: "test-key",
         model: "claude-haiku-5-5",
         fetch: stub.fetch,
      });
      const calls: Array<{ name: string; args: unknown }> = [];
      const text = await provider.reply(makeRequest(calls));
      assert.equal(text, "Total $3.00. Confirm?");
      assert.deepEqual(calls, [
         {
            name: "get_quote",
            args: { items: [{ sku: "CUSHION-BP", qty: 2 }], country: "GB" },
         },
      ]);

      const [first, second] = stub.calls;
      assert.ok(first && second);
      assert.equal(first.url, "https://api.anthropic.com/v1/messages");
      assert.equal(first.method, "POST");
      // SDK 1.x sends the key as a Bearer token; older ones as x-api-key.
      const auth =
         first.headers["x-api-key"] ?? first.headers.authorization ?? "";
      assert.match(auth, /^(Bearer )?test-key$/);
      assert.ok(first.headers["anthropic-version"]);
      const body1 = JSON.parse(first.body);
      assert.equal(body1.model, "claude-haiku-5-5");
      assert.equal(body1.system, "SYSTEM PROMPT");
      assert.deepEqual(body1.output_config, { effort: "low" });
      assert.equal(body1.temperature, undefined);
      assert.deepEqual(body1.messages, [
         { role: "user", content: "2 cushion covers to the UK" },
      ]);
      const setCart = body1.tools.find((t: any) => t.name === "get_quote");
      assert.equal(setCart.input_schema.type, "object");
      assert.ok(setCart.description.length > 0);

      const body2 = JSON.parse(second.body);
      assert.equal(body2.messages.length, 3);
      // Assistant content is passed back unchanged (text + tool_use).
      assert.equal(body2.messages[1].role, "assistant");
      assert.equal(body2.messages[1].content[1].id, "toolu_1");
      const result = body2.messages[2].content[0];
      assert.equal(body2.messages[2].role, "user");
      assert.equal(result.type, "tool_result");
      assert.equal(result.tool_use_id, "toolu_1");
      assert.equal(result.content, JSON.stringify({ total: 3 }));
      assert.equal(result.is_error, false);
   });

   it("surfaces API errors so the runner can fall back", async () => {
      const stub = stubFetch(() => ({
         status: 401,
         json: {
            type: "error",
            error: { type: "authentication_error", message: "bad key" },
         },
      }));
      const provider = new AnthropicProvider({
         apiKey: "bad",
         model: "claude-haiku-5-5",
         fetch: stub.fetch,
      });
      await assert.rejects(provider.reply(makeRequest([])));
   });
});

describe("GeminiProvider", () => {
   it("runs stateless interactions with function_result steps", async () => {
      const thought = { type: "thought", signature: "sig-abc" };
      const call = {
         type: "function_call",
         id: "fc_1",
         name: "get_quote",
         arguments: { items: [{ sku: "CUSHION-BP", qty: 2 }], country: "GB" },
      };
      const stub = stubFetch((_req, i) => {
         if (i === 0) {
            return {
               json: {
                  id: "int_1",
                  status: "requires_action",
                  steps: [
                     {
                        type: "user_input",
                        content: [
                           { type: "text", text: "2 cushion covers to the UK" },
                        ],
                     },
                     thought,
                     call,
                  ],
               },
            };
         }
         return {
            json: {
               id: "int_2",
               status: "completed",
               steps: [
                  {
                     type: "model_output",
                     content: [{ type: "text", text: "Total $3. Confirm?" }],
                  },
               ],
            },
         };
      });
      const provider = new GeminiProvider({
         apiKey: "g-key",
         model: "gemini-3.8-flash",
         fetch: stub.fetch,
      });
      const calls: Array<{ name: string; args: unknown }> = [];
      const text = await provider.reply(makeRequest(calls));
      assert.equal(text, "Total $3. Confirm?");
      assert.equal(calls[0]?.name, "get_quote");

      const [first, second] = stub.calls;
      assert.ok(first && second);
      assert.equal(
         first.url,
         "https://generativelanguage.googleapis.com/v1beta/interactions",
      );
      assert.equal(first.headers["x-goog-api-key"], "g-key");
      assert.equal(first.headers["api-revision"], "2026-05-20");
      const body1 = JSON.parse(first.body);
      assert.equal(body1.model, "gemini-3.8-flash");
      assert.equal(body1.store, false);
      assert.equal(body1.system_instruction, "SYSTEM PROMPT");
      assert.deepEqual(body1.input, [
         {
            type: "user_input",
            content: [{ type: "text", text: "2 cushion covers to the UK" }],
         },
      ]);
      assert.equal(body1.tools[0].type, "function");
      assert.ok(body1.tools.every((t: any) => t.parameters.type === "object"));

      const body2 = JSON.parse(second.body);
      // History: our user turn, the model's steps exactly as received
      // (thought signature kept), then our function_result.
      assert.equal(body2.input.length, 4);
      assert.deepEqual(body2.input[1], thought);
      assert.deepEqual(body2.input[2], call);
      assert.deepEqual(body2.input[3], {
         type: "function_result",
         name: "get_quote",
         call_id: "fc_1",
         result: [{ type: "text", text: JSON.stringify({ total: 3 }) }],
      });
   });

   it("throws on HTTP errors without leaking the key", async () => {
      const stub = stubFetch(() => ({
         status: 400,
         json: { error: { message: "API key not valid" } },
      }));
      const provider = new GeminiProvider({
         apiKey: "secret-key",
         model: "gemini-3.8-flash",
         fetch: stub.fetch,
      });
      await assert.rejects(provider.reply(makeRequest([])), (err: unknown) => {
         assert.doesNotMatch((err as Error).message, /secret-key/);
         return true;
      });
   });
});
