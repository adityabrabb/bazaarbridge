/**
 * Typed fetch client for the core API. Every call either resolves
 * with data or throws ApiError, so callers can show "API offline"
 * instead of crashing.
 */
import { API_URL } from "./constants";
import type {
   ChatBody, ChatReply, Conversation, ConversationSummary,
   EvidencePack, Health, Order, RemindReply, Stats,
} from "./types";

/** Error with the HTTP status (0 means the network call failed). */
export class ApiError extends Error {
   status: number;
   constructor(message: string, status: number) {
      super(message);
      this.status = status;
   }
}

/** Core request helper: JSON in, JSON out, errors normalised. */
async function request<T>(
   path: string, method: "GET" | "POST" = "GET", body?: unknown,
): Promise<T> {
   let res: Response;
   try {
      res = await fetch(`${API_URL}${path}`, {
         method,
         headers: body ? { "Content-Type": "application/json" } : {},
         body: body ? JSON.stringify(body) : undefined,
      });
   } catch {
      // fetch only throws when the server cannot be reached at all.
      throw new ApiError("API offline", 0);
   }
   if (!res.ok) {
      throw new ApiError(`${method} ${path} failed`, res.status);
   }
   return (await res.json()) as T;
}

export const api = {
   health: () => request<Health>("/api/health"),
   conversations: () =>
      request<ConversationSummary[]>("/api/conversations"),
   conversation: (id: string) =>
      request<Conversation>(`/api/conversations/${id}`),
   chat: (body: ChatBody) =>
      request<ChatReply>("/api/chat", "POST", body),
   orders: () => request<Order[]>("/api/orders"),
   refresh: (id: string) =>
      request<Order>(`/api/orders/${id}/refresh`, "POST"),
   remind: (id: string) =>
      request<RemindReply>(`/api/orders/${id}/remind`, "POST"),
   simulate: (id: string) =>
      request<Order>(`/api/orders/${id}/simulate-payment`, "POST"),
   evidence: (id: string) =>
      request<EvidencePack>(`/api/orders/${id}/evidence`),
   stats: () => request<Stats>("/api/stats"),
   reset: () => request<{ ok: true }>("/api/demo/reset", "POST"),
};
