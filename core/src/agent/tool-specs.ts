// -----------------------------------------------------------------------
// tool-specs.ts
// Purpose: the agent's tools as provider-neutral JSON-schema specs.
//          Buyers get quote tools; the seller gets money tools.
//          Each provider adapter translates these to its own format.
// -----------------------------------------------------------------------

import type { ConversationKind } from "../types.ts";

export type JsonSchema = {
   type: "object";
   properties: Record<string, unknown>;
   required: string[];
   additionalProperties: false;
};

export type ToolSpec = {
   name: ToolName;
   description: string;
   parameters: JsonSchema;
};

export type ToolName =
   | "search_catalog"
   | "get_quote"
   | "confirm_order"
   | "check_payment"
   | "send_invoice"
   | "list_unpaid"
   | "send_reminder"
   | "get_stats";

const NO_ARGS: JsonSchema = {
   type: "object",
   properties: {},
   required: [],
   additionalProperties: false,
};

const ORDER_ID_ARG: JsonSchema = {
   type: "object",
   properties: {
      orderId: {
         type: "string",
         description: "Order id like ord_abc123. Omit for the latest order.",
      },
   },
   required: [],
   additionalProperties: false,
};

export const ALL_TOOLS: ToolSpec[] = [
   {
      name: "search_catalog",
      description:
         "Find products by name or common word (cushion, diya, " +
         "scarf...). Returns sku, name, unit and category.",
      parameters: {
         type: "object",
         properties: { query: { type: "string" } },
         required: ["query"],
         additionalProperties: false,
      },
   },
   {
      name: "get_quote",
      description:
         "Price the buyer's items in THEIR currency with shipping, " +
         "delivery estimate and the seller's bulk discount, and show the " +
         "quote card. Needs the destination country: if unknown, ask the " +
         "buyer first. Pass ALL lines, not just new ones; whole-number " +
         "quantities. An empty list cancels the quote. Prices are " +
         "computed by the shop, never by you. If the buyer asks for a " +
         "discount, pass discountPct (their ask, or omit if they gave no " +
         "number); read discountNote in the result.",
      parameters: {
         type: "object",
         properties: {
            country: {
               type: "string",
               description: "Destination country name or ISO-2 code.",
            },
            discountPct: { type: "number", minimum: 0, maximum: 100 },
            items: {
               type: "array",
               items: {
                  type: "object",
                  properties: {
                     sku: { type: "string" },
                     qty: { type: "integer", minimum: 0 },
                  },
                  required: ["sku", "qty"],
                  additionalProperties: false,
               },
            },
         },
         required: ["items"],
         additionalProperties: false,
      },
   },
   {
      name: "confirm_order",
      description:
         "Buyer accepted the quote: create the PayPal order in their " +
         "currency and send the pay link. Only call after a clear yes.",
      parameters: NO_ARGS,
   },
   {
      name: "check_payment",
      description:
         "Check with PayPal whether an order is paid (captures it if the " +
         "buyer approved).",
      parameters: ORDER_ID_ARG,
   },
   {
      name: "send_invoice",
      description: "Send the PayPal invoice for a paid order.",
      parameters: ORDER_ID_ARG,
   },
   {
      name: "list_unpaid",
      description:
         "List orders still waiting for payment. Optional days " +
         "limits it to orders from the last N days (7 = this week).",
      parameters: {
         type: "object",
         properties: { days: { type: "integer", minimum: 1 } },
         required: [],
         additionalProperties: false,
      },
   },
   {
      name: "send_reminder",
      description:
         "Send a polite payment reminder with the PayPal pay link to the " +
         "customer of one unpaid order.",
      parameters: {
         type: "object",
         properties: { orderId: { type: "string" } },
         required: ["orderId"],
         additionalProperties: false,
      },
   },
   {
      name: "get_stats",
      description:
         "Seller totals: rupees collected, paid count, unpaid count, " +
         "unpaid rupees, and paid/unpaid amounts per buyer currency.",
      parameters: NO_ARGS,
   },
];

const CUSTOMER_TOOLS: ToolName[] = [
   "search_catalog",
   "get_quote",
   "confirm_order",
   "check_payment",
   "send_invoice",
];

const OWNER_TOOLS: ToolName[] = [
   "list_unpaid",
   "send_reminder",
   "get_stats",
   "check_payment",
   "send_invoice",
   "search_catalog",
];

// -----------------------------------------------------------------------
// toolsFor
// Purpose: the tool list a conversation kind is allowed to use. A
//          customer can never trigger reminders or read shop stats.
// -----------------------------------------------------------------------
export function toolsFor(kind: ConversationKind): ToolSpec[] {
   const allowed = kind === "owner" ? OWNER_TOOLS : CUSTOMER_TOOLS;
   return ALL_TOOLS.filter((t) => allowed.includes(t.name));
}
