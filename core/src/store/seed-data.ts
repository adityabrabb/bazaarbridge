// -----------------------------------------------------------------------
// seed-data.ts
// Purpose: the demo world of the fictional seller Rangrez Studio,
//          Jaipur: a 12-item rupee catalog, Emma (London, new empty
//          chat) for the live storyline, one unpaid US order (USD), one
//          unpaid German order (EUR) and two older paid orders, so the
//          dashboard does not start at zero. Generic product names
//          only; the demo video cannot show brands.
// -----------------------------------------------------------------------

import {
   EVENT_INVOICE,
   EVENT_PAY_LINK,
   EVENT_PAYMENT,
   EVENT_QUOTE_CREATED,
   MOCK_CAPTURE_PREFIX,
   MOCK_PAYER_EMAIL,
   MOCK_PAYPAL_PREFIX,
   MS_PER_DAY,
   OWNER_CONVERSATION_ID,
   OWNER_DISPLAY_NAME,
} from "../constants.ts";
import { buildQuote, type Quote } from "../quote/quote-engine.ts";
import type {
   Channel,
   Conversation,
   Database,
   Order,
   OrderEvent,
   Product,
} from "../types.ts";

// ----- Catalog -----------------------------------------------------------
// Prices are rupees; the quote engine converts them per buyer currency.
// Aliases are what a buyer abroad would type; longest first is not
// required (the matcher sorts), but it keeps the list readable.
export const SEED_CATALOG: Product[] = [
   {
      sku: "CUSHION-BP",
      name: "Block-print cushion cover",
      aliases: [
         "block print cushion covers",
         "block print cushion cover",
         "cushion covers",
         "cushion cover",
         "pillow covers",
         "pillow cover",
         "cushions",
         "cushion",
         "covers",
         "cover",
      ],
      unit: "piece",
      priceInr: 750,
      category: "textiles",
   },
   {
      sku: "RUNNER-BP",
      name: "Block-print table runner",
      aliases: [
         "block print table runner",
         "table runners",
         "table runner",
         "runners",
         "runner",
      ],
      unit: "piece",
      priceInr: 1_100,
      category: "textiles",
   },
   {
      sku: "NAPKIN-BP",
      name: "Block-print napkin set",
      aliases: [
         "block print napkin set",
         "napkin sets",
         "napkin set",
         "napkins",
         "napkin",
      ],
      unit: "set of 4",
      priceInr: 900,
      category: "textiles",
   },
   {
      sku: "QUILT-HQ",
      name: "Hand-quilted cotton quilt",
      aliases: [
         "hand quilted cotton quilt",
         "cotton quilt",
         "quilts",
         "quilt",
         "razai",
         "rajai",
         "throw",
      ],
      unit: "piece",
      priceInr: 3_800,
      category: "textiles",
   },
   {
      sku: "SCARF-BP",
      name: "Block-print cotton scarf",
      aliases: [
         "block print cotton scarf",
         "block print scarf",
         "scarves",
         "scarfs",
         "scarf",
         "stole",
         "stoles",
      ],
      unit: "piece",
      priceInr: 650,
      category: "textiles",
   },
   {
      sku: "TOTE-BP",
      name: "Block-print canvas tote bag",
      aliases: [
         "block print tote bag",
         "tote bags",
         "tote bag",
         "totes",
         "tote",
         "shopping bag",
      ],
      unit: "piece",
      priceInr: 550,
      category: "textiles",
   },
   {
      sku: "DIYA-BRASS",
      name: "Brass diya set",
      aliases: [
         "brass diya set",
         "brass diyas",
         "diya sets",
         "diya set",
         "diyas",
         "diya",
         "oil lamp",
         "oil lamps",
      ],
      unit: "set of 4",
      priceInr: 1_200,
      category: "brass",
   },
   {
      sku: "BELL-BRASS",
      name: "Brass temple bell",
      aliases: [
         "brass temple bell",
         "temple bell",
         "brass bell",
         "brass bells",
         "bells",
         "bell",
      ],
      unit: "piece",
      priceInr: 850,
      category: "brass",
   },
   {
      sku: "INCENSE-BRASS",
      name: "Brass incense holder",
      aliases: [
         "brass incense holder",
         "incense holders",
         "incense holder",
         "incense stand",
         "agarbatti stand",
      ],
      unit: "piece",
      priceInr: 450,
      category: "brass",
   },
   {
      sku: "EARRING-JHUMKA",
      name: "Meenakari jhumka earrings",
      aliases: [
         "meenakari jhumka earrings",
         "jhumka earrings",
         "earrings",
         "earring",
         "jhumkas",
         "jhumka",
         "jhumki",
      ],
      unit: "pair",
      priceInr: 900,
      category: "jewellery",
   },
   {
      sku: "NECKLACE-BEAD",
      name: "Beaded tribal necklace",
      aliases: [
         "beaded tribal necklace",
         "beaded necklace",
         "necklaces",
         "necklace",
      ],
      unit: "piece",
      priceInr: 1_200,
      category: "jewellery",
   },
   {
      sku: "BANGLE-LAC",
      name: "Lac bangle set",
      aliases: [
         "lac bangle set",
         "lac bangles",
         "bangle sets",
         "bangle set",
         "bangles",
         "bangle",
      ],
      unit: "set of 6",
      priceInr: 800,
      category: "jewellery",
   },
];

// ----- Seed people -------------------------------------------------------
type SeedOrder = {
   id: string;
   conversationId: string;
   customerName: string;
   channel: Channel;
   country: string;
   lines: Array<{ sku: string; qty: number }>;
   daysAgo: number;
   paid: boolean;
   customerText: string;
   payerEmail?: string;
};

const SEED_ORDERS: SeedOrder[] = [
   {
      id: "ord_seed_hannah",
      conversationId: "c_hannah",
      customerName: "Hannah Brooks",
      channel: "email",
      country: "US",
      lines: [
         { sku: "SCARF-BP", qty: 3 },
         { sku: "QUILT-HQ", qty: 1 },
      ],
      daysAgo: 2,
      paid: false,
      customerText: "Hello, 3 block-print scarves and a quilt to the US?",
   },
   {
      id: "ord_seed_lukas",
      conversationId: "c_lukas",
      customerName: "Lukas Bauer",
      channel: "chat",
      country: "DE",
      lines: [
         { sku: "BELL-BRASS", qty: 2 },
         { sku: "INCENSE-BRASS", qty: 2 },
         { sku: "EARRING-JHUMKA", qty: 1 },
      ],
      daysAgo: 4,
      paid: false,
      customerText: "Two brass bells, two incense holders and jhumka earrings.",
   },
   {
      id: "ord_seed_chloe",
      conversationId: "c_chloe",
      customerName: "Chloe Wilson",
      channel: "dm",
      country: "AU",
      lines: [
         { sku: "NAPKIN-BP", qty: 2 },
         { sku: "RUNNER-BP", qty: 1 },
      ],
      daysAgo: 8,
      paid: true,
      customerText: "2 napkin sets and a table runner, shipping to Sydney?",
      payerEmail: "chloe.wilson@example.test",
   },
   {
      id: "ord_seed_daniel",
      conversationId: "c_daniel",
      customerName: "Daniel Roy",
      channel: "email",
      country: "CA",
      lines: [
         { sku: "TOTE-BP", qty: 2 },
         { sku: "BANGLE-LAC", qty: 2 },
      ],
      daysAgo: 6,
      paid: true,
      customerText: "2 tote bags and 2 lac bangle sets, Toronto please.",
      payerEmail: "daniel.roy@example.test",
   },
];

const HOUR_MS = 3_600_000;

// -----------------------------------------------------------------------
// eventsOf
// Purpose: the timeline of a seed order (feeds the evidence pack).
// -----------------------------------------------------------------------
function eventsOf(order: Order): OrderEvent[] {
   const at = (hours: number) =>
      new Date(Date.parse(order.createdAt) + hours * HOUR_MS).toISOString();
   const events: OrderEvent[] = [
      {
         orderId: order.id,
         at: order.createdAt,
         event: EVENT_QUOTE_CREATED,
         detail:
            `Quote ${order.currency} ${order.total.toFixed(2)} ` +
            `to ${order.buyerCountry}`,
      },
   ];
   if (order.paidAt) {
      events.push(
         {
            orderId: order.id,
            at: at(0.1),
            event: EVENT_PAY_LINK,
            detail: "PayPal pay link sent in chat",
         },
         {
            orderId: order.id,
            at: order.paidAt,
            event: EVENT_PAYMENT,
            detail: `Payment captured (${order.captureId ?? "no id"})`,
         },
         {
            orderId: order.id,
            at: at(1.1),
            event: EVENT_INVOICE,
            detail: "Receipt shared with the buyer",
         },
      );
   }
   return events;
}

// -----------------------------------------------------------------------
// seedOrder
// Purpose: one seed order + its chat, priced through the real quote
//          engine so the seed can never disagree with what the agent
//          would quote.
// -----------------------------------------------------------------------
function seedOrder(
   seed: SeedOrder,
   now: Date,
): { order: Order; quote: Quote; convo: Conversation } {
   const created = new Date(now.getTime() - seed.daysAgo * MS_PER_DAY);
   const createdAt = created.toISOString();
   const quote = buildQuote(seed.lines, SEED_CATALOG, seed.country);
   const order: Order = {
      id: seed.id,
      conversationId: seed.conversationId,
      customerName: seed.customerName,
      buyerCountry: seed.country,
      items: quote.items,
      subtotal: quote.subtotal,
      discount: quote.discount,
      shipping: quote.shipping,
      total: quote.total,
      currency: quote.currency,
      totalInr: quote.totalInr,
      deliveryDays: quote.deliveryDays,
      status: seed.paid ? "paid" : "awaiting_payment",
      reminders: 0,
      createdAt,
   };
   if (seed.paid) {
      // Paid an hour after ordering; mock ids keep the record complete.
      order.paidAt = new Date(created.getTime() + HOUR_MS).toISOString();
      order.paypalOrderId = `${MOCK_PAYPAL_PREFIX}${seed.id}`;
      order.captureId = `${MOCK_CAPTURE_PREFIX}${seed.id}`;
      order.payerEmail = seed.payerEmail ?? MOCK_PAYER_EMAIL;
   }
   const convo: Conversation = {
      id: seed.conversationId,
      kind: "customer",
      customerName: seed.customerName,
      channel: seed.channel,
      country: seed.country,
      messages: [
         {
            id: `msg_${seed.id}_1`,
            conversationId: seed.conversationId,
            role: "customer",
            text: seed.customerText,
            createdAt,
         },
         {
            id: `msg_${seed.id}_2`,
            conversationId: seed.conversationId,
            role: "agent",
            text: seed.paid
               ? "Payment received, thank you! Your order is being packed."
               : "Here is your quote. Shall I go ahead?",
            attachments: [
               {
                  type: "quote",
                  items: quote.items,
                  subtotal: quote.subtotal,
                  discount: quote.discount,
                  shipping: quote.shipping,
                  total: quote.total,
                  currency: quote.currency,
                  destination: quote.destination,
                  deliveryDays: quote.deliveryDays,
               },
            ],
            createdAt,
         },
      ],
   };
   return { order, quote, convo };
}

// -----------------------------------------------------------------------
// buildSeedDatabase
// Purpose: create a fresh Database relative to `now`, so "this week"
//          questions always find the two unpaid orders.
// -----------------------------------------------------------------------
export function buildSeedDatabase(now: Date = new Date()): Database {
   const orders: Order[] = [];
   const conversations: Conversation[] = [];
   const events: OrderEvent[] = [];
   for (const seed of SEED_ORDERS) {
      const made = seedOrder(seed, now);
      orders.push(made.order);
      events.push(...eventsOf(made.order));
      conversations.push(made.convo);
   }
   // Emma opens the live storyline: a brand-new, empty chat from London.
   conversations.push({
      id: "c_emma",
      kind: "customer",
      customerName: "Emma",
      channel: "dm",
      country: "GB",
      messages: [],
   });
   conversations.push({
      id: OWNER_CONVERSATION_ID,
      kind: "owner",
      customerName: OWNER_DISPLAY_NAME,
      channel: "chat",
      messages: [],
   });
   // Newest first, matching GET /api/orders.
   orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
   return {
      catalog: SEED_CATALOG.map((p) => ({ ...p, aliases: [...p.aliases] })),
      orders,
      conversations,
      events,
   };
}
