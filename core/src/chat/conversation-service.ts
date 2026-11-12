// -----------------------------------------------------------------------
// conversation-service.ts
// Purpose: read and append chat messages. Every appended message is
//          saved and published as a message.created event.
// -----------------------------------------------------------------------

import {
   CHANNELS,
   DEFAULT_CHANNEL,
   DEFAULT_CUSTOMER_NAME,
   MAX_NAME_LENGTH,
   OWNER_CONVERSATION_ID,
   OWNER_DISPLAY_NAME,
} from "../constants.ts";
import { normalizeCountry } from "../quote/countries.ts";
import type { EventHub } from "../events/event-hub.ts";
import { newId, nowIso } from "../ids.ts";
import type { JsonStore } from "../store/json-store.ts";
import type {
   Attachment,
   Channel,
   Conversation,
   ConversationKind,
   ConversationSummary,
   Message,
   MessageRole,
} from "../types.ts";

export class ConversationService {
   private store: JsonStore;
   private hub: EventHub;

   // --------------------------------------------------------------------
   // constructor
   // Purpose: keep the store and event hub.
   // --------------------------------------------------------------------
   constructor(store: JsonStore, hub: EventHub) {
      this.store = store;
      this.hub = hub;
   }

   // --------------------------------------------------------------------
   // get
   // Purpose: one conversation by id, or undefined.
   // --------------------------------------------------------------------
   get(id: string): Conversation | undefined {
      return this.store.db.conversations.find((c) => c.id === id);
   }

   // --------------------------------------------------------------------
   // ensure
   // Purpose: return the conversation, creating it on first contact.
   //          The id "owner" is always the owner's chat. A later message
   //          with a customerName fills in a placeholder name. Channel
   //          and country apply to a new conversation; an existing one
   //          only learns a country it did not have yet.
   //          Side effect: may add a conversation and save.
   // --------------------------------------------------------------------
   ensure(
      id: string,
      customerName?: string,
      channel?: Channel,
      country?: string,
   ): Conversation {
      const name = cleanName(customerName);
      const iso = normalizeCountry(country);
      const existing = this.get(id);
      if (existing) {
         let changed = false;
         if (name && existing.customerName === DEFAULT_CUSTOMER_NAME) {
            existing.customerName = name;
            changed = true;
         }
         if (iso && !existing.country && existing.kind === "customer") {
            existing.country = iso;
            changed = true;
         }
         if (changed) {
            void this.store.save();
         }
         return existing;
      }
      const kind: ConversationKind =
         id === OWNER_CONVERSATION_ID ? "owner" : "customer";
      const created: Conversation = {
         id,
         kind,
         customerName:
            kind === "owner"
               ? OWNER_DISPLAY_NAME
               : name || DEFAULT_CUSTOMER_NAME,
         channel:
            channel && CHANNELS.includes(channel) ? channel : DEFAULT_CHANNEL,
         messages: [],
      };
      if (iso && kind === "customer") {
         created.country = iso;
      }
      this.store.db.conversations.push(created);
      void this.store.save();
      return created;
   }

   // --------------------------------------------------------------------
   // setCountry
   // Purpose: record the buyer's destination once the agent learns it
   //          (the quote tool passes it). Overwrites: the buyer may
   //          correct themselves. Unknown input is ignored.
   // --------------------------------------------------------------------
   setCountry(id: string, country: string): void {
      const iso = normalizeCountry(country);
      const convo = this.get(id);
      if (iso && convo && convo.kind === "customer" && convo.country !== iso) {
         convo.country = iso;
         void this.store.save();
      }
   }

   // --------------------------------------------------------------------
   // append
   // Purpose: add a message to a conversation, save, publish.
   //          Side effect: mutates the store and emits message.created.
   // --------------------------------------------------------------------
   append(
      conversationId: string,
      role: MessageRole,
      text: string,
      attachments?: Attachment[],
   ): Message {
      const convo = this.ensure(conversationId);
      const message: Message = {
         id: newId("msg"),
         conversationId,
         role,
         text,
         createdAt: nowIso(),
      };
      if (attachments && attachments.length > 0) {
         message.attachments = attachments;
      }
      convo.messages.push(message);
      void this.store.save();
      this.hub.publish({ type: "message.created", data: message });
      return message;
   }

   // --------------------------------------------------------------------
   // summaries
   // Purpose: list view for GET /api/conversations, most recent first.
   // --------------------------------------------------------------------
   summaries(): ConversationSummary[] {
      const list = this.store.db.conversations.map((c) => {
         const last = c.messages[c.messages.length - 1];
         return {
            id: c.id,
            kind: c.kind,
            customerName: c.customerName,
            channel: c.channel,
            country: c.country,
            lastText: last?.text ?? "",
            updatedAt: last?.createdAt ?? "",
         };
      });
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
   }
}

// -----------------------------------------------------------------------
// cleanName
// Purpose: trim and cap a display name from user input.
// -----------------------------------------------------------------------
function cleanName(name: string | undefined): string {
   if (typeof name !== "string") {
      return "";
   }
   return name.trim().slice(0, MAX_NAME_LENGTH);
}
