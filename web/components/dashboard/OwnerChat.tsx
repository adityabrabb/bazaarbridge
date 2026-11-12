"use client";
/**
 * The owner's chat with the agent (conversation id `owner`):
 * "kis kis ka payment pending hai?" and "send reminders". Presentational;
 * the DemoStudio owns the conversation state.
 */
import { ChatThread } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { NO_PAYMENT_CONTEXT } from "@/components/chat/attachmentContext";
import {
   STORY_OWNER_REMIND_TEXT, STORY_OWNER_TEXT,
} from "@/lib/constants";
import type { ConversationState } from "@/hooks/useConversation";

/** Renders a bordered panel containing the owner thread + composer. */
export function OwnerChat({ chat }: { chat: ConversationState }) {
   return (
      <section className="ownerchat" aria-label="Ask the sales desk">
         <h3 className="panel__title">Ask the agent</h3>
         <div className="ownerchat__body">
            <ChatThread messages={chat.messages} viewer="owner"
               ctx={NO_PAYMENT_CONTEXT} sending={chat.sending}
               emptyHint="Ask about unpaid invoices or today's money. Hinglish is fine." />
         </div>
         {chat.error ? <p className="inlineerr">{chat.error}</p> : null}
         <Composer onSend={chat.send} disabled={chat.sending}
            placeholder="Ask in English or Hinglish..."
            quickLines={[STORY_OWNER_TEXT, STORY_OWNER_REMIND_TEXT]} />
      </section>
   );
}
