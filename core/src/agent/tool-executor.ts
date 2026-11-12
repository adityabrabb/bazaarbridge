// -----------------------------------------------------------------------
// tool-executor.ts
// Purpose: run one agent tool call against the order service. Results
//          are small JSON objects for the model; chat cards (quote, pay
//          link, invoice) are collected on the context as attachments.
//          Bad arguments come back as { error } instead of throwing, so
//          the model can correct itself.
// -----------------------------------------------------------------------

import { searchCatalog } from "../catalog/catalog-search.ts";
import type { ConversationService } from "../chat/conversation-service.ts";
import { formatMoney } from "../orders/money.ts";
import type { OrderService } from "../orders/order-service.ts";
import { normalizeCountry } from "../quote/countries.ts";
import type { QuoteLine } from "../quote/quote-engine.ts";
import type {
   Attachment,
   ConversationKind,
   Order,
   Product,
} from "../types.ts";
import { toolsFor, type ToolName } from "./tool-specs.ts";

export type ToolContext = {
   conversationId: string;
   customerName: string;
   kind: ConversationKind;
   orders: OrderService;
   chats: ConversationService;
   catalog: Product[];
   attachments: Attachment[];
   calls: Array<{ name: string; args: unknown }>;
};

export type ToolOutcome = {
   ok: boolean;
   content: string;
};

type Args = Record<string, unknown>;

// -----------------------------------------------------------------------
// runTool
// Purpose: entry point used by every provider. Never throws.
// -----------------------------------------------------------------------
export async function runTool(
   ctx: ToolContext,
   name: string,
   rawArgs: unknown,
): Promise<ToolOutcome> {
   const args: Args =
      typeof rawArgs === "object" && rawArgs !== null ? (rawArgs as Args) : {};
   ctx.calls.push({ name, args });
   const allowed = toolsFor(ctx.kind).some((t) => t.name === name);
   if (!allowed) {
      return fail(`tool ${name} is not available in this chat`);
   }
   try {
      const result = await dispatch(ctx, name as ToolName, args);
      return { ok: true, content: JSON.stringify(result) };
   } catch (err) {
      return fail((err as Error).message);
   }
}

// -----------------------------------------------------------------------
// fail
// Purpose: a tool error the model can read and recover from.
// -----------------------------------------------------------------------
function fail(message: string): ToolOutcome {
   return { ok: false, content: JSON.stringify({ error: message }) };
}

// -----------------------------------------------------------------------
// dispatch
// Purpose: route a tool name to its handler.
// -----------------------------------------------------------------------
async function dispatch(
   ctx: ToolContext,
   name: ToolName,
   args: Args,
): Promise<unknown> {
   switch (name) {
      case "search_catalog":
         return findProducts(ctx, args);
      case "get_quote":
         return getQuote(ctx, args);
      case "confirm_order":
         return confirmOrder(ctx);
      case "check_payment":
         return checkPayment(ctx, args);
      case "send_invoice":
         return sendInvoice(ctx, args);
      case "list_unpaid":
         return listUnpaid(ctx, args);
      case "send_reminder":
         return sendReminder(ctx, args);
      case "get_stats":
         return ctx.orders.stats();
   }
}

// -----------------------------------------------------------------------
// findProducts
// Purpose: catalog search. Buyers never see rupee list prices (they get
//          quotes in their own currency); the seller does.
// -----------------------------------------------------------------------
function findProducts(ctx: ToolContext, args: Args) {
   const found = searchCatalog(String(args.query ?? ""), ctx.catalog);
   if (ctx.kind === "owner") {
      return found;
   }
   return found.map(({ sku, name, unit, category }) => ({
      sku,
      name,
      unit,
      category,
   }));
}

// -----------------------------------------------------------------------
// brief
// Purpose: the compact order view the model sees.
// -----------------------------------------------------------------------
function brief(order: Order) {
   const money = (n: number) => formatMoney(n, order.currency);
   return {
      orderId: order.id,
      customerName: order.customerName,
      buyerCountry: order.buyerCountry,
      status: order.status,
      items: order.items.map(
         (i) => `${i.qty} x ${i.name} @ ${money(i.unitPrice)}`,
      ),
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      total: order.total,
      currency: order.currency,
      totalInr: order.totalInr,
      deliveryDays: order.deliveryDays,
      reminders: order.reminders,
      createdAt: order.createdAt,
      payLink: order.approveUrl,
      invoiceUrl: order.invoiceUrl,
   };
}

// -----------------------------------------------------------------------
// getQuote
// Purpose: price the buyer's items in code and show the quote card.
//          The country comes from the tool call or the conversation; a
//          country given here is remembered for the rest of the chat.
//          A missing country is an error the model turns into a question.
//          Side effect: creates or updates the draft order.
// -----------------------------------------------------------------------
function getQuote(ctx: ToolContext, args: Args) {
   const lines = Array.isArray(args.items) ? (args.items as QuoteLine[]) : [];
   const given = normalizeCountry(
      typeof args.country === "string" ? args.country : "",
   );
   if (given) {
      ctx.chats.setCountry(ctx.conversationId, given);
   }
   const country = given || ctx.chats.get(ctx.conversationId)?.country || "";
   const { order, quote } = ctx.orders.setQuote(
      ctx.conversationId,
      ctx.customerName,
      lines,
      country,
      Number(args.discountPct) || 0,
   );
   if (order.status === "draft") {
      upsertCard(ctx, {
         type: "quote",
         items: order.items,
         subtotal: order.subtotal,
         discount: order.discount,
         shipping: order.shipping,
         total: order.total,
         currency: order.currency,
         destination: quote?.destination ?? order.buyerCountry,
         deliveryDays: order.deliveryDays,
      });
   }
   return {
      ...brief(order),
      destination: quote?.destination,
      discountPct: quote?.discountPct,
      discountNote: quote?.discountNote,
      ratesAsOf: quote?.ratesAsOf,
   };
}

// -----------------------------------------------------------------------
// upsertCard
// Purpose: keep at most one card of each type per reply (a model that
//          calls get_quote twice should show only the final quote).
// -----------------------------------------------------------------------
function upsertCard(ctx: ToolContext, card: Attachment): void {
   const at = ctx.attachments.findIndex((a) => a.type === card.type);
   if (at >= 0) {
      ctx.attachments[at] = card;
   } else {
      ctx.attachments.push(card);
   }
}

// -----------------------------------------------------------------------
// confirmOrder
// Purpose: create the PayPal order; adds the pay link card.
// -----------------------------------------------------------------------
async function confirmOrder(ctx: ToolContext) {
   const order = await ctx.orders.confirm(ctx.conversationId);
   upsertCard(ctx, {
      type: "pay_link",
      orderId: order.id,
      url: order.approveUrl ?? "",
      total: order.total,
      currency: order.currency,
   });
   return brief(order);
}

// -----------------------------------------------------------------------
// pickOrder
// Purpose: resolve an orderId argument. Customers may only touch their
//          own orders; without an id, use the chat's latest order.
// -----------------------------------------------------------------------
function pickOrder(ctx: ToolContext, args: Args): Order {
   const id = typeof args.orderId === "string" ? args.orderId.trim() : "";
   const order = id
      ? ctx.orders.require(id)
      : ctx.orders.latestFor(ctx.conversationId);
   if (!order) {
      throw new Error("no order found for this chat");
   }
   if (
      ctx.kind === "customer" &&
      order.conversationId !== ctx.conversationId
   ) {
      throw new Error("that order belongs to another customer");
   }
   return order;
}

// -----------------------------------------------------------------------
// checkPayment
// Purpose: refresh with PayPal. The paid message + cards are posted by
//          the order service itself, so no card is added here.
// -----------------------------------------------------------------------
async function checkPayment(ctx: ToolContext, args: Args) {
   const order = pickOrder(ctx, args);
   const fresh = await ctx.orders.refresh(order.id);
   return brief(fresh);
}

// -----------------------------------------------------------------------
// sendInvoice
// Purpose: (re)share the invoice of a paid order.
// -----------------------------------------------------------------------
async function sendInvoice(ctx: ToolContext, args: Args) {
   const order = pickOrder(ctx, args);
   if (order.status !== "paid") {
      throw new Error(`order ${order.id} is not paid yet`);
   }
   await ctx.orders.issueInvoice(order);
   if (!order.invoiceUrl) {
      throw new Error("invoice could not be created right now");
   }
   upsertCard(ctx, {
      type: "invoice",
      orderId: order.id,
      url: order.invoiceUrl,
   });
   return brief(order);
}

// -----------------------------------------------------------------------
// listUnpaid
// Purpose: the seller's list of unpaid orders.
// -----------------------------------------------------------------------
function listUnpaid(ctx: ToolContext, args: Args) {
   const days = Number(args.days);
   const list = ctx.orders.listUnpaid(Number.isFinite(days) ? days : 0);
   return { count: list.length, orders: list.map(brief) };
}

// -----------------------------------------------------------------------
// sendReminder
// Purpose: nudge one unpaid customer (posts into their chat).
// -----------------------------------------------------------------------
async function sendReminder(ctx: ToolContext, args: Args) {
   const id = typeof args.orderId === "string" ? args.orderId.trim() : "";
   if (!id) {
      throw new Error("orderId is required");
   }
   const { order } = await ctx.orders.remind(id);
   return { sent: true, ...brief(order) };
}
