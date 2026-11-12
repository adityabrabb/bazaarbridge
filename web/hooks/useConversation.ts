"use client";
/**
 * One chat thread: loads history, accepts live `message.created`
 * events for this conversation, and sends new text through
 * POST /api/chat. Used for both customer chats and the owner chat.
 */
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Channel, Message } from "@/lib/types";

/** Optional buyer details sent when a conversation is new. */
export type ConversationMeta = { country?: string; channel?: Channel };

export type ConversationState = {
   messages: Message[];
   sending: boolean;
   error: string | null;
   send: (text: string) => Promise<void>;
   reload: () => Promise<void>;
   addLive: (message: Message) => void;
};

/**
 * Adds a message unless its id is already present (SSE + POST).
 * A live copy of something we typed replaces our temporary bubble,
 * so the user never sees the same line twice.
 */
function addUnique(list: Message[], m: Message): Message[] {
   if (list.some((x) => x.id === m.id)) return list;
   const rest = list.filter((x) => !(
      x.id.startsWith("tmp_") && x.role === m.role && x.text === m.text));
   return [...rest, m];
}

/** Manages one conversation id; `from` is who is typing. */
export function useConversation(
   id: string,
   from: "customer" | "owner",
   customerName: string,
   online: boolean,
   meta: ConversationMeta = {},
): ConversationState {
   const [messages, setMessages] = useState<Message[]>([]);
   const [sending, setSending] = useState(false);
   const [error, setError] = useState<string | null>(null);

   /** Loads history; a 404 just means a brand-new customer. */
   const load = useCallback(async () => {
      try {
         const conv = await api.conversation(id);
         setMessages(conv.messages);
         setError(null);
      } catch (e) {
         if (e instanceof ApiError && e.status === 404) {
            setMessages([]);
            setError(null);
         } else {
            setError("Could not load chat");
         }
      }
   }, [id]);

   // Reload when switching conversation or when the API returns.
   useEffect(() => {
      setMessages([]);
      if (online) load();
   }, [id, online, load]);

   /** Accepts a live event if it belongs to this thread. */
   const addLive = useCallback((m: Message) => {
      if (m.conversationId !== id) return;
      setMessages((list) => addUnique(list, m));
   }, [id]);

   /** Shows the typed text at once, then lets the API reconcile. */
   const send = useCallback(async (text: string) => {
      const clean = text.trim();
      if (!clean || sending) return;
      setSending(true);
      setError(null);
      const temp: Message = {
         id: `tmp_${Date.now()}`, conversationId: id, role: from,
         text: clean, createdAt: new Date().toISOString(),
      };
      setMessages((list) => [...list, temp]);
      try {
         await api.chat({
            conversationId: id, from, text: clean, customerName,
            country: meta.country, channel: meta.channel,
         });
         // Reload so the temp bubble is replaced by the stored one.
         await load();
      } catch {
         setMessages((list) => list.filter((m) => m.id !== temp.id));
         setError("Message not sent. Is the API running?");
      } finally {
         setSending(false);
      }
   }, [id, from, customerName, meta.country, meta.channel, sending, load]);

   return { messages, sending, error, send, reload: load, addLive };
}
