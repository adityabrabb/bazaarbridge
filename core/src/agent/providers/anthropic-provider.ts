// -----------------------------------------------------------------------
// anthropic-provider.ts
// Purpose: LlmProvider on the Claude Messages API through the official
//          @anthropic-ai/sdk, with a manual tool-use loop: call, run the
//          tool_use blocks, send all tool_result blocks back in one user
//          message, repeat until the model stops asking for tools.
// -----------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import {
   LLM_MAX_OUTPUT_TOKENS,
   LLM_MAX_TOOL_STEPS,
   LLM_TIMEOUT_MS,
} from "../../constants.ts";
import type { LlmProvider, ReplyRequest } from "../llm-provider.ts";
import type { ToolSpec } from "../tool-specs.ts";

export type AnthropicOptions = {
   apiKey: string;
   model: string;
   // Injected in tests to check the exact request without the network.
   fetch?: typeof fetch;
   baseURL?: string;
};

const FALLBACK_TEXT = "Maaf kijiye, abhi samajh nahi paaya. Dobara likhiye?";

// -----------------------------------------------------------------------
// toAnthropicTools
// Purpose: neutral ToolSpec -> Anthropic tool definition.
// -----------------------------------------------------------------------
export function toAnthropicTools(tools: ToolSpec[]): Anthropic.Tool[] {
   return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
   }));
}

// -----------------------------------------------------------------------
// textOf
// Purpose: join the text blocks of a response.
// -----------------------------------------------------------------------
function textOf(content: Anthropic.ContentBlock[]): string {
   return content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
}

export class AnthropicProvider implements LlmProvider {
   readonly mode = "anthropic" as const;
   private client: Anthropic;
   private model: string;

   // --------------------------------------------------------------------
   // constructor
   // Purpose: build the SDK client. One retry keeps chat latency sane.
   // --------------------------------------------------------------------
   constructor(opts: AnthropicOptions) {
      this.model = opts.model;
      this.client = new Anthropic({
         apiKey: opts.apiKey,
         maxRetries: 1,
         timeout: LLM_TIMEOUT_MS,
         ...(opts.fetch ? { fetch: opts.fetch } : {}),
         ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
      });
   }

   // --------------------------------------------------------------------
   // reply
   // Purpose: the tool-use loop. Assistant content (including any
   //          thinking blocks) is passed back unchanged, as required.
   //          API errors propagate; the agent runner falls back to mock.
   // --------------------------------------------------------------------
   async reply(req: ReplyRequest): Promise<string> {
      const messages: Anthropic.MessageParam[] = req.history.map((turn) => ({
         role: turn.role,
         content: turn.text,
      }));
      const tools = toAnthropicTools(req.tools);
      let lastText = "";
      for (let step = 0; step < LLM_MAX_TOOL_STEPS; step += 1) {
         const response = await this.client.messages.create({
            model: this.model,
            max_tokens: LLM_MAX_OUTPUT_TOKENS,
            system: req.system,
            tools,
            messages,
            // Short chat turns: low effort keeps replies fast and cheap.
            output_config: { effort: "low" },
         });
         lastText = textOf(response.content) || lastText;
         if (response.stop_reason === "refusal") {
            return FALLBACK_TEXT;
         }
         if (response.stop_reason === "pause_turn") {
            messages.push({ role: "assistant", content: response.content });
            continue;
         }
         const calls = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
         );
         if (response.stop_reason !== "tool_use" || calls.length === 0) {
            return lastText || FALLBACK_TEXT;
         }
         messages.push({ role: "assistant", content: response.content });
         const results: Anthropic.ToolResultBlockParam[] = [];
         // Run in order: get_quote must land before confirm_order.
         for (const call of calls) {
            const outcome = await req.runTool(call.name, call.input);
            results.push({
               type: "tool_result",
               tool_use_id: call.id,
               content: outcome.content,
               is_error: !outcome.ok,
            });
         }
         messages.push({ role: "user", content: results });
      }
      return lastText || FALLBACK_TEXT;
   }
}
