// -----------------------------------------------------------------------
// types.ts
// Purpose: the shared data shapes. The first block mirrors the API
//          contract (SPEC.md "SPEC v2 - BazaarBridge", plus section 5
//          for anything v2 leaves unchanged); do not change it without
//          going through Fable.
// -----------------------------------------------------------------------

// ----- API contract ---------------------------------------------------
// Buyer currencies PayPal supports for an Indian seller's buyers abroad.
export type Currency = "USD" | "GBP" | "EUR" | "AUD";

export type Product = {
   sku: string;
   name: string;
   aliases: string[];
   unit: string;
   priceInr: number;
   category: string;
};

// unitPrice is in the order's buyer currency.
export type OrderItem = {
   sku: string;
   name: string;
   qty: number;
   unitPrice: number;
};

export type OrderStatus = "draft" | "awaiting_payment" | "paid" | "cancelled";

export type Order = {
   id: string;
   conversationId: string;
   customerName: string;
   buyerCountry: string;
   items: OrderItem[];
   subtotal: number;
   discount: number;
   shipping: number;
   total: number;
   currency: Currency;
   totalInr: number;
   deliveryDays: string;
   status: OrderStatus;
   paypalOrderId?: string;
   approveUrl?: string;
   invoiceId?: string;
   invoiceUrl?: string;
   payerEmail?: string;
   captureId?: string;
   reminders: number;
   createdAt: string;
   paidAt?: string;
};

export type QuoteAttachment = {
   type: "quote";
   items: OrderItem[];
   subtotal: number;
   discount: number;
   shipping: number;
   total: number;
   currency: Currency;
   destination: string;
   deliveryDays: string;
};

export type Attachment =
   | QuoteAttachment
   | {
        type: "pay_link";
        orderId: string;
        url: string;
        total: number;
        currency: Currency;
     }
   | { type: "invoice"; orderId: string; url: string }
   | {
        type: "payment_confirmed";
        orderId: string;
        total: number;
        currency: Currency;
     };

export type MessageRole = "customer" | "owner" | "agent";

export type Message = {
   id: string;
   conversationId: string;
   role: MessageRole;
   text: string;
   attachments?: Attachment[];
   createdAt: string;
};

export type ConversationKind = "customer" | "owner";
export type Channel = "dm" | "email" | "chat";

export type Conversation = {
   id: string;
   kind: ConversationKind;
   customerName: string;
   channel: Channel;
   country?: string;
   messages: Message[];
};

export type ConversationSummary = {
   id: string;
   kind: ConversationKind;
   customerName: string;
   channel: Channel;
   country?: string;
   lastText: string;
   updatedAt: string;
};

export type Stats = {
   collectedInr: number;
   paidCount: number;
   unpaidCount: number;
   unpaidInr: number;
   byCurrency: Array<{ currency: Currency; paid: number; unpaid: number }>;
};

export type TimelineEntry = { at: string; event: string; detail: string };

export type EvidencePack = {
   order: Order;
   messages: Message[];
   timeline: TimelineEntry[];
   payment?: {
      provider: "paypal";
      orderId: string;
      captureId?: string;
      payerEmail?: string;
      amount: number;
      currency: Currency;
      paidAt: string;
   };
};

// ----- Internal shapes ------------------------------------------------
// One audit-trail line for an order (feeds the evidence timeline).
export type OrderEvent = TimelineEntry & { orderId: string };

// Everything persisted to /data/db.json.
export type Database = {
   catalog: Product[];
   orders: Order[];
   conversations: Conversation[];
   events: OrderEvent[];
};

export type LlmMode = "anthropic" | "gemini" | "mock";
export type PaypalMode = "sandbox" | "mock";
