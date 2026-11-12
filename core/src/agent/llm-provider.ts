// -----------------------------------------------------------------------
// llm-provider.ts
// Purpose: the provider-neutral contract every LLM adapter implements.
//          An adapter runs its own tool-calling loop (message formats
//          differ per vendor) but calls tools only through `runTool`.
// -----------------------------------------------------------------------

import type { ConversationKind, LlmMode, Order, Product } from "../types.ts";
import type { ToolOutcome } from "./tool-executor.ts";
import type { ToolSpec } from "./tool-specs.ts";

export type ChatTurn = {
   role: "user" | "assistant";
   text: string;
};

export type ReplyRequest = {
   system: string;
   history: ChatTurn[];
   tools: ToolSpec[];
   runTool: (name: string, args: unknown) => Promise<ToolOutcome>;
   // Extra facts for the rule-based mock; real models ignore these.
   kind: ConversationKind;
   catalog: Product[];
   draft: Order | undefined;
   // The buyer's ISO-2 destination if known, else "" (ask for it).
   country: string;
};

export interface LlmProvider {
   readonly mode: LlmMode;

   // Produce the agent's reply text for the last user turn.
   reply(request: ReplyRequest): Promise<string>;
}
