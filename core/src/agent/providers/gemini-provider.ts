// -----------------------------------------------------------------------
// gemini-provider.ts
// Purpose: LlmProvider on the Gemini Interactions API (the API Google's
//          docs now recommend over generateContent), in stateless mode
//          (store: false): we resend the full step history each call,
//          including the model's own thought / function_call steps
//          exactly as received, then our function_result steps.
//          Shapes follow aistudio.google.com/docs/function-calling
//          (REST tab) and docs/text-generation, Api-Revision 2026-05-20.
// -----------------------------------------------------------------------

import {
   GEMINI_API_REVISION,
   GEMINI_INTERACTIONS_URL,
   LLM_MAX_OUTPUT_TOKENS,
   LLM_MAX_TOOL_STEPS,
   GEMINI_ATTEMPT_TIMEOUT_MS,
   GEMINI_COOLDOWN_MS,
   GEMINI_FALLBACK_MODELS,
} from "../../constants.ts";
import type { ChatTurn, LlmProvider, ReplyRequest } from "../llm-provider.ts";
import type { ToolSpec } from "../tool-specs.ts";

export type GeminiOptions = {
   apiKey: string;
   model: string;
   fetch?: typeof fetch;
   url?: string;
};

// A step is an open-ended JSON object; we only read a few fields.
type Step = {
   type: string;
   id?: string;
   name?: string;
   arguments?: unknown;
   content?: Array<{ type: string; text?: string }>;
   [key: string]: unknown;
};

type InteractionResponse = {
   id?: string;
   status?: string;
   steps?: Step[];
   error?: { message?: string };
};

const FALLBACK_TEXT = "Maaf kijiye, abhi samajh nahi paaya. Dobara likhiye?";
// Steps we author ourselves; never echo the server's copies back.
const CLIENT_STEP_TYPES = new Set(["user_input", "function_result"]);

// -----------------------------------------------------------------------
// toGeminiTools
// Purpose: neutral ToolSpec -> Interactions function tool.
// -----------------------------------------------------------------------
export function toGeminiTools(tools: ToolSpec[]) {
   return tools.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
   }));
}

// -----------------------------------------------------------------------
// historyToSteps
// Purpose: our stored chat -> Interactions input steps.
// -----------------------------------------------------------------------
export function historyToSteps(history: ChatTurn[]): Step[] {
   return history.map((turn) => ({
      type: turn.role === "user" ? "user_input" : "model_output",
      content: [{ type: "text", text: turn.text }],
   }));
}

// -----------------------------------------------------------------------
// textOf
// Purpose: the text of all model_output steps in a response.
// -----------------------------------------------------------------------
function textOf(steps: Step[]): string {
   return steps
      .filter((s) => s.type === "model_output")
      .flatMap((s) => s.content ?? [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n")
      .trim();
}

export class GeminiProvider implements LlmProvider {
   readonly mode = "gemini" as const;
   private opts: GeminiOptions;
   private fetchFn: typeof fetch;
   // ----- Model that answered last; tried first next time so one
   //       overloaded model does not slow every later reply.
   private workingModel: string | null = null;
   // ----- model -> time (ms) before which it is not tried again.
   private coolUntil = new Map<string, number>();

   // --------------------------------------------------------------------
   // constructor
   // Purpose: keep key, model and an injectable fetch.
   // --------------------------------------------------------------------
   constructor(opts: GeminiOptions) {
      this.opts = opts;
      this.fetchFn = opts.fetch ?? fetch;
   }

   // --------------------------------------------------------------------
   // callModel
   // Purpose: one POST /v1beta/interactions for one model. Throws on HTTP
   //          errors with Google's message (never the key).
   // --------------------------------------------------------------------
   private async callModel(
      model: string,
      req: ReplyRequest,
      input: Step[],
   ): Promise<InteractionResponse> {
      const res = await this.fetchFn(
         this.opts.url ?? GEMINI_INTERACTIONS_URL,
         {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "x-goog-api-key": this.opts.apiKey,
               "Api-Revision": GEMINI_API_REVISION,
            },
            body: JSON.stringify({
               model,
               store: false,
               system_instruction: req.system,
               input,
               tools: toGeminiTools(req.tools),
               generation_config: {
                  thinking_level: "low",
                  max_output_tokens: LLM_MAX_OUTPUT_TOKENS,
               },
            }),
            signal: AbortSignal.timeout(GEMINI_ATTEMPT_TIMEOUT_MS),
         },
      );
      let json: InteractionResponse = {};
      try {
         json = (await res.json()) as InteractionResponse;
      } catch {
         json = {};
      }
      if (!res.ok) {
         const why = json.error?.message ?? "no details";
         throw new Error(`Gemini HTTP ${res.status}: ${why}`);
      }
      return json;
   }

   // --------------------------------------------------------------------
   // call
   // Purpose: try the configured model, then each fallback model in
   //          turn. Why: the newest flash model is often overloaded
   //          (HTTP 503) or slow, and a live demo must still be answered
   //          by a real model rather than the rule-based mock.
   // --------------------------------------------------------------------
   private async call(
      req: ReplyRequest,
      input: Step[],
   ): Promise<InteractionResponse> {
      const ordered = [
         ...(this.workingModel ? [this.workingModel] : []),
         this.opts.model,
         ...GEMINI_FALLBACK_MODELS,
      ];
      const unique = ordered.filter((m, i) => ordered.indexOf(m) === i);
      const now = Date.now();
      const ready = unique.filter((m) => (this.coolUntil.get(m) ?? 0) <= now);
      // ----- If every model is cooling down, still try them all once.
      const models = ready.length > 0 ? ready : unique;
      let lastError: unknown = new Error("no Gemini model tried");
      for (const model of models) {
         try {
            const answer = await this.callModel(model, req, input);
            this.workingModel = model;
            return answer;
         } catch (err) {
            lastError = err;
            this.coolUntil.set(model, Date.now() + GEMINI_COOLDOWN_MS);
            const why = err instanceof Error ? err.message : String(err);
            console.warn(`[agent] gemini ${model} failed: ${why}`);
         }
      } // end for each model
      throw lastError;
   }

   // --------------------------------------------------------------------
   // reply
   // Purpose: the function-calling loop over stateless interactions.
   // --------------------------------------------------------------------
   async reply(req: ReplyRequest): Promise<string> {
      const input = historyToSteps(req.history);
      let lastText = "";
      for (let step = 0; step < LLM_MAX_TOOL_STEPS; step += 1) {
         const response = await this.call(req, input);
         const modelSteps = (response.steps ?? []).filter(
            (s) => !CLIENT_STEP_TYPES.has(s.type),
         );
         lastText = textOf(modelSteps) || lastText;
         const calls = modelSteps.filter((s) => s.type === "function_call");
         if (calls.length === 0) {
            return lastText || FALLBACK_TEXT;
         }
         input.push(...modelSteps);
         for (const call of calls) {
            const outcome = await req.runTool(
               call.name ?? "",
               call.arguments ?? {},
            );
            input.push({
               type: "function_result",
               name: call.name ?? "",
               call_id: call.id ?? "",
               result: [{ type: "text", text: outcome.content }],
            });
         }
      }
      return lastText || FALLBACK_TEXT;
   }
}
