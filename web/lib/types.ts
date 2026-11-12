/**
 * BazaarBridge v2 contract types, copied from SPEC v2 (top of
 * SPEC.md). One file, so the UI and the core cannot drift apart.
 */

export type Currency = "USD" | "GBP" | "EUR" | "AUD";

export type Product = {
   sku: string; name: string; aliases: string[]; unit: string;
   priceInr: number; category: string;
};
/** Prices in OrderItem are in the buyer's currency. */
export type OrderItem = {
   sku: string; name: string; qty: number; unitPrice: number;
};
export type OrderStatus =
   "draft" | "awaiting_payment" | "paid" | "cancelled";
export type Order = {
   id: string; conversationId: string; customerName: string;
   buyerCountry: string;            // ISO-2, e.g. "GB"
   items: OrderItem[];
   subtotal: number; discount: number; shipping: number; total: number;
   currency: Currency;
   totalInr: number;                // rupee value at quote time
   deliveryDays: string;            // e.g. "7-10"
   status: OrderStatus;
   paypalOrderId?: string; approveUrl?: string;
   invoiceId?: string; invoiceUrl?: string;
   payerEmail?: string; captureId?: string;
   reminders: number; createdAt: string; paidAt?: string;
};
export type QuoteAttachment = {
   type: "quote"; items: OrderItem[];
   subtotal: number; discount: number; shipping: number; total: number;
   currency: Currency; destination: string; deliveryDays: string;
};
export type Attachment =
   | QuoteAttachment
   | { type: "pay_link"; orderId: string; url: string;
       total: number; currency: Currency }
   | { type: "invoice"; orderId: string; url: string }
   | { type: "payment_confirmed"; orderId: string;
       total: number; currency: Currency };
export type Message = {
   id: string; conversationId: string;
   role: "customer" | "owner" | "agent";
   text: string; attachments?: Attachment[]; createdAt: string;
};
export type Channel = "dm" | "email" | "chat";
export type Conversation = {
   id: string; kind: "customer" | "owner"; customerName: string;
   channel: Channel; country?: string; messages: Message[];
};
export type ConversationSummary = {
   id: string; kind: "customer" | "owner"; customerName: string;
   channel: Channel; country?: string;
   lastText: string; updatedAt: string;
};
export type TimelineEntry = { at: string; event: string; detail: string };
export type PaymentRecord = {
   provider: "paypal"; orderId: string; captureId?: string;
   payerEmail?: string; amount: number; currency: Currency;
   paidAt: string;
};
export type EvidencePack = {
   order: Order; messages: Message[];
   timeline: TimelineEntry[];
   payment?: PaymentRecord;
};

/** Response shapes that the contract table spells out inline. */
export type Health = {
   llm: "anthropic" | "gemini" | "mock";
   paypal: "sandbox" | "mock";
};
export type CurrencyTotals = {
   currency: Currency; paid: number; unpaid: number;
};
export type Stats = {
   collectedInr: number; paidCount: number; unpaidCount: number;
   unpaidInr: number; byCurrency: CurrencyTotals[];
};
export type ChatBody = {
   conversationId: string; from: "customer" | "owner";
   text: string; customerName?: string;
   country?: string; channel?: Channel;
};
export type ChatReply = { messages: Message[] };
export type RemindReply = { order: Order; message: Message };
