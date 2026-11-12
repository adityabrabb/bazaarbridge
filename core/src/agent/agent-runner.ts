// -----------------------------------------------------------------------
// agent-runner.ts
// Purpose: handle one incoming chat message end to end: store it, build
//          the model's view of the chat, run the provider's tool loop,
//          and store the agent's reply with any cards the tools made.
//          If the real LLM fails (network, quota, bad key), the same
//          turn is retried on the rule-based mock so the demo never
//          stalls on stage.
// -----------------------------------------------------------------------

import {
   CHANNELS,
   LLM_HISTORY_MESSAGES,
   MAX_TEXT_LENGTH,
   OWNER_CONVERSATION_ID,
} from "../constants.ts";
import type { ConversationService } from "../chat/conversation-service.ts";
import { HTTP_BAD_REQUEST, ServiceError } from "../errors.ts";
import type { OrderService } from "../orders/order-service.ts";
import type { JsonStore } from "../store/json-store.ts";
import { formatMoney } from "../orders/money.ts";
import type {
   Attachment,
   Channel,
   Message,
   MessageRole,
} from "../types.ts";
import type { ChatTurn, LlmProvider } from "./llm-provider.ts";
import { MockProvider } from "./mock/mock-provider.ts";
import { buildSystemPrompt } from "./system-prompt.ts";
import { runTool, type ToolContext } from "./tool-executor.ts";
import { toolsFor } from "./tool-specs.ts";

export type ChatInput = {
   conversationId: string;
   from: "customer" | "owner";
   text: string;
   customerName?: string;
   // Only used when this message opens a new conversation.
   channel?: Channel;
   country?: string;
};

// -----------------------------------------------------------------------
// describeCards
// Purpose: a one-line text version of chat cards, so the model knows a
//          quote or pay link was already shown in earlier turns.
// -----------------------------------------------------------------------
function describeCards(cards: Attachment[] | undefined): string {
   const parts: string[] = [];
   for (const card of cards ?? []) {
      if (card.type === "quote") {
         const items = card.items.map((i) => `${i.qty} x ${i.name}`);
         parts.push(
            `[quote shown: ${items.join(", ")}; to ${card.destination}; ` +
               `total ${formatMoney(card.total, card.currency)}]`,
         );
      } else if (card.type === "pay_link") {
         parts.push(`[PayPal pay link sent for ${card.orderId}]`);
      } else if (card.type === "invoice") {
         parts.push(`[invoice sent for ${card.orderId}]`);
      } else {
         parts.push(`[payment confirmed for ${card.orderId}]`);
      }
   }
   return parts.join(" ");
}

// -----------------------------------------------------------------------
// toHistory
// Purpose: stored messages -> alternating user/assistant turns that
//          start with a user turn (what the chat APIs expect).
// -----------------------------------------------------------------------
export function toHistory(messages: Message[]): ChatTurn[] {
   const turns: ChatTurn[] = [];
   for (const m of messages.slice(-LLM_HISTORY_MESSAGES)) {
      const role = m.role === "agent" ? "assistant" : "user";
      const text = [m.text, describeCards(m.attachments)]
         .filter((s) => s.length > 0)
         .join(" ");
      const prev = turns[turns.length - 1];
      if (prev && prev.role === role) {
         prev.text = `${prev.text}\n${text}`;
      } else {
         turns.push({ role, text });
      }
   }
   while (turns.length > 0 && turns[0]?.role !== "user") {
      turns.shift();
   }
   return turns;
}

export class AgentRunner {
   private store: JsonStore;
   private chats: ConversationService;
   private orders: OrderService;
   private provider: LlmProvider;
   private fallback = new MockProvider();

   // --------------------------------------------------------------------
   // constructor
   // Purpose: wire services and the chosen provider.
   // --------------------------------------------------------------------
   constructor(
      store: JsonStore,
      chats: ConversationService,
      orders: OrderService,
      provider: LlmProvider,
   ) {
      this.store = store;
      this.chats = chats;
      this.orders = orders;
      this.provider = provider;
   }

   get llmMode(): LlmProvider["mode"] {
      return this.provider.mode;
   }

   // --------------------------------------------------------------------
   // validate
   // Purpose: reject malformed chat input with a 400.
   // --------------------------------------------------------------------
   private validate(input: ChatInput): void {
      const id = input.conversationId;
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
         throw new ServiceError(
            HTTP_BAD_REQUEST,
            "conversationId must be 1-80 letters, digits, _ or -",
         );
      }
      if (input.from !== "customer" && input.from !== "owner") {
         throw new ServiceError(
            HTTP_BAD_REQUEST,
            'from must be "customer" or "owner"',
         );
      }
      if ((input.from === "owner") !== (id === OWNER_CONVERSATION_ID)) {
         throw new ServiceError(
            HTTP_BAD_REQUEST,
            'owner messages use conversationId "owner" (and only them)',
         );
      }
      if (typeof input.text !== "string" || input.text.trim() === "") {
         throw new ServiceError(HTTP_BAD_REQUEST, "text is required");
      }
      if (input.channel !== undefined && !CHANNELS.includes(input.channel)) {
         throw new ServiceError(
            HTTP_BAD_REQUEST,
            `channel must be one of ${CHANNELS.join(", ")}`,
         );
      }
      if (input.country !== undefined && typeof input.country !== "string") {
         throw new ServiceError(HTTP_BAD_REQUEST, "country must be a string");
      }
   }

   // --------------------------------------------------------------------
   // handle
   // Purpose: POST /api/chat. Returns the new agent message(s).
   //          Side effects: stores both messages, may create/advance
   //          orders, emits events.
   // --------------------------------------------------------------------
   async handle(input: ChatInput): Promise<Message[]> {
      this.validate(input);
      const text = input.text.trim().slice(0, MAX_TEXT_LENGTH);
      const convo = this.chats.ensure(
         input.conversationId,
         input.customerName,
         input.channel,
         input.country,
      );
      const role: MessageRole = input.from;
      this.chats.append(convo.id, role, text);
      const ctx: ToolContext = {
         conversationId: convo.id,
         customerName: convo.customerName,
         kind: convo.kind,
         orders: this.orders,
         chats: this.chats,
         catalog: this.store.db.catalog,
         attachments: [],
         calls: [],
      };
      const request = {
         system: buildSystemPrompt(
            convo.kind,
            this.store.db.catalog,
            convo.country,
         ),
         history: toHistory(convo.messages),
         tools: toolsFor(convo.kind),
         runTool: (name: string, args: unknown) => runTool(ctx, name, args),
         kind: convo.kind,
         catalog: this.store.db.catalog,
         draft: this.orders.draftFor(convo.id),
         country: convo.country ?? "",
      };
      let reply: string;
      try {
         reply = await this.provider.reply(request);
      } catch (err) {
         console.warn(
            `[agent] ${this.provider.mode} failed, using mock:`,
            (err as Error).message,
         );
         // Cards from a half-finished real run would be confusing.
         ctx.attachments.length = 0;
         request.draft = this.orders.draftFor(convo.id);
         request.country = this.chats.get(convo.id)?.country ?? "";
         reply = await this.fallback.reply(request);
      }
      const message = this.chats.append(
         convo.id,
         "agent",
         reply,
         ctx.attachments,
      );
      return [message];
   }
}
