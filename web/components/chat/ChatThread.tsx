"use client";
/**
 * Scrolling list of bubbles. Sticks to the bottom when new
 * messages arrive, shows a typing hint while the agent works, and
 * an empty state with a hint line.
 */
import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import type { AttachmentContext } from "./attachmentContext";
import { MessageBubble } from "./MessageBubble";

type Props = {
   messages: Message[];
   viewer: "customer" | "owner";
   ctx: AttachmentContext;
   sending: boolean;
   emptyHint: string;
};

/** Renders the thread; auto-scrolls on change. */
export function ChatThread(
   { messages, viewer, ctx, sending, emptyHint }: Props,
) {
   const box = useRef<HTMLDivElement>(null);

   // Scroll inside the thread only; never move the whole page.
   useEffect(() => {
      const el = box.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
   }, [messages.length, sending]);

   return (
      <div className="thread" ref={box} aria-live="polite">
         {messages.length === 0 ? (
            <div className="thread__empty">{emptyHint}</div>
         ) : null}
         {messages.map((m) => (
            <MessageBubble key={m.id} message={m} viewer={viewer}
               ctx={ctx} />
         ))}
         {sending ? <div className="typing">typing...</div> : null}
      </div>
   );
}
