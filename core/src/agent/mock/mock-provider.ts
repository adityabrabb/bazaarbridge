// -----------------------------------------------------------------------
// mock-provider.ts
// Purpose: an LlmProvider with no LLM: the message parser decides which
//          tools to call (through the same runTool path as a real
//          model), and fixed templates write the reply. Buyers get
//          English; the seller's chat gets short Hinglish.
// -----------------------------------------------------------------------

import {
   BULK_DISCOUNT_PCT,
   BULK_MIN_QTY,
   MS_PER_DAY,
} from "../../constants.ts";
import { formatInr, formatMoney } from "../../orders/money.ts";
import { countryFromText } from "../../quote/countries.ts";
import type { Currency } from "../../types.ts";
import type { LlmProvider, ReplyRequest } from "../llm-provider.ts";
import type { ToolOutcome } from "../tool-executor.ts";
import {
   customerIntent,
   discountAsked,
   mentionsWeek,
   ownerIntent,
   parseItems,
   type ParsedLine,
} from "./hinglish-parser.ts";

const WEEK_DAYS = 7;

type OrderBrief = {
   orderId: string;
   customerName: string;
   buyerCountry: string;
   status: string;
   total: number;
   currency: Currency;
   totalInr: number;
   discount: number;
   discountPct?: number;
   discountNote?: string;
   deliveryDays: string;
   destination?: string;
   createdAt: string;
   error?: string;
};

// -----------------------------------------------------------------------
// readJson
// Purpose: parse a tool outcome; errors become { error }.
// -----------------------------------------------------------------------
function readJson<T>(outcome: ToolOutcome): T & { error?: string } {
   try {
      return JSON.parse(outcome.content) as T & { error?: string };
   } catch {
      return { error: "bad tool output" } as T & { error?: string };
   }
}

// -----------------------------------------------------------------------
// daysAgo
// Purpose: "aaj" / "2 din pehle" for the seller's list.
// -----------------------------------------------------------------------
function daysAgo(iso: string): string {
   const days = Math.floor((Date.now() - Date.parse(iso)) / MS_PER_DAY);
   return days <= 0 ? "aaj" : `${days} din pehle`;
}

export class MockProvider implements LlmProvider {
   readonly mode = "mock" as const;

   // --------------------------------------------------------------------
   // reply
   // Purpose: route to the buyer or seller script.
   // --------------------------------------------------------------------
   async reply(req: ReplyRequest): Promise<string> {
      const last = req.history[req.history.length - 1];
      const text = last?.role === "user" ? last.text : "";
      if (req.kind === "owner") {
         return this.ownerReply(req, text);
      }
      return this.customerReply(req, text);
   }

   // --------------------------------------------------------------------
   // customerReply
   // Purpose: items / discount -> get_quote, yes -> confirm_order,
   //          paid -> check_payment, cancel -> empty quote,
   //          invoice -> send_invoice.
   // --------------------------------------------------------------------
   private async customerReply(
      req: ReplyRequest,
      text: string,
   ): Promise<string> {
      const intent = customerIntent(text, req.catalog);
      const country = req.country || countryFromText(text);
      // A bare country answer ("UK") continues an earlier items message.
      if (intent === "other" && countryFromText(text) && !req.draft) {
         const earlier = this.earlierItems(req);
         if (earlier.length > 0) {
            return this.quote(req, earlier, country, text);
         }
      }
      if (intent === "items") {
         const items = this.mergeDraft(req, parseItems(text, req.catalog));
         if (!country) {
            return this.askCountry();
         }
         return this.quote(req, items, country, text);
      }
      if (intent === "discount") {
         if (!req.draft) {
            return "Happy to help. What would you like to order?";
         }
         return this.quote(req, this.mergeDraft(req, []), country, text);
      }
      if (intent === "confirm" && req.draft) {
         const order = readJson<OrderBrief>(
            await req.runTool("confirm_order", {}),
         );
         if (order.error) {
            return (
               "Sorry, the PayPal link could not be created just now. " +
               "Please say 'go ahead' again in a moment."
            );
         }
         const total = formatMoney(order.total, order.currency);
         return (
            `Wonderful! Your total is ${total}. ` +
            "Please pay with the PayPal link below."
         );
      }
      if (intent === "cancel" && req.draft) {
         await req.runTool("get_quote", { items: [] });
         return "No problem, I have cancelled that quote. Anything else?";
      }
      if (intent === "paid") {
         const order = readJson<OrderBrief>(
            await req.runTool("check_payment", {}),
         );
         if (order.error) {
            return "I could not find a pending order for you.";
         }
         return order.status === "paid"
            ? "Yes, your payment has arrived. Thank you!"
            : "I cannot see the payment yet. Please finish paying with " +
                 "the link, then check again in a moment.";
      }
      if (intent === "invoice") {
         const order = readJson<OrderBrief>(
            await req.runTool("send_invoice", {}),
         );
         return order.error
            ? "Your invoice is available once the payment is complete."
            : "Here is your invoice.";
      }
      return (
         "Hello! I can quote block-print cushion covers, table runners, " +
         "napkins, quilts, scarves and tote bags, brass diyas, bells and " +
         "incense holders, and handmade jewellery. What would you like, " +
         "and which country should we ship to?"
      );
   }

   // --------------------------------------------------------------------
   // askCountry
   // Purpose: the quote needs a destination before any price is shown.
   // --------------------------------------------------------------------
   private askCountry(): string {
      return (
         "Lovely choice! Which country should we ship to? I will " +
         "quote in your currency."
      );
   }

   // --------------------------------------------------------------------
   // mergeDraft
   // Purpose: new items replace the draft's quantity for the same SKU;
   //          everything else in the draft stays.
   // --------------------------------------------------------------------
   private mergeDraft(req: ReplyRequest, fresh: ParsedLine[]): ParsedLine[] {
      const merged = new Map<string, number>();
      for (const item of req.draft?.items ?? []) {
         merged.set(item.sku, item.qty);
      }
      for (const line of fresh) {
         merged.set(line.sku, line.qty);
      }
      return [...merged].map(([sku, qty]) => ({ sku, qty }));
   }

   // --------------------------------------------------------------------
   // earlierItems
   // Purpose: items from the most recent earlier buyer message that named
   //          some (used after the buyer answers "which country?").
   // --------------------------------------------------------------------
   private earlierItems(req: ReplyRequest): ParsedLine[] {
      const users = req.history.filter((t) => t.role === "user").slice(0, -1);
      for (let i = users.length - 1; i >= 0; i -= 1) {
         const found = parseItems(users[i]?.text ?? "", req.catalog);
         if (found.length > 0) {
            return found;
         }
      }
      return [];
   }

   // --------------------------------------------------------------------
   // quote
   // Purpose: call get_quote and phrase the result. The numbers come
   //          from the tool, never from this text.
   // --------------------------------------------------------------------
   private async quote(
      req: ReplyRequest,
      items: ParsedLine[],
      country: string,
      text: string,
   ): Promise<string> {
      const ask = discountAsked(text);
      // A bare "any discount?" asks for the seller's standard offer.
      const pct = ask.asked ? ask.pct || BULK_DISCOUNT_PCT : 0;
      const order = readJson<OrderBrief>(
         await req.runTool("get_quote", {
            items,
            country,
            ...(pct > 0 ? { discountPct: pct } : {}),
         }),
      );
      if (order.error) {
         return `Sorry, I could not prepare that quote: ${order.error}.`;
      }
      const total = formatMoney(order.total, order.currency);
      const lead = `Here is your quote to ${order.destination ?? ""}`.trim();
      let line = `${lead}: ${total} in total, delivery in about ` +
         `${order.deliveryDays} days.`;
      if (order.discount > 0) {
         line +=
            ` I have taken ${order.discountPct}% off ` +
            `(${formatMoney(order.discount, order.currency)}) for ordering ` +
            `${BULK_MIN_QTY}+ items.`;
      }
      if (order.discountNote) {
         line += ` ${order.discountNote}`;
      } else if (ask.asked && order.discount === 0) {
         line += ` The seller offers ${BULK_DISCOUNT_PCT}% off from ` +
            `${BULK_MIN_QTY} items.`;
      }
      return `${line} Shall I go ahead?`;
   }

   // --------------------------------------------------------------------
   // ownerReply
   // Purpose: unpaid list, reminders for all unpaid, or stats.
   // --------------------------------------------------------------------
   private async ownerReply(req: ReplyRequest, text: string): Promise<string> {
      const intent = ownerIntent(text);
      if (intent === "unpaid" || intent === "remind") {
         const days = mentionsWeek(text) ? WEEK_DAYS : undefined;
         const list = readJson<{ count: number; orders: OrderBrief[] }>(
            await req.runTool("list_unpaid", days ? { days } : {}),
         );
         const orders = list.orders ?? [];
         if (orders.length === 0) {
            return "Sabne payment kar diya hai. Kuch pending nahi!";
         }
         if (intent === "remind") {
            return this.remindAll(req, orders);
         }
         const lines = orders.map(
            (o) =>
               `- ${o.customerName} (${o.buyerCountry}): ` +
               `${formatMoney(o.total, o.currency)} ` +
               `(${formatInr(o.totalInr)}), ${daysAgo(o.createdAt)}`,
         );
         return (
            `${orders.length} invoice pending hain:\n${lines.join("\n")}` +
            "\nSabko reminder bhej doon?"
         );
      }
      if (intent === "stats") {
         const s = readJson<{
            collectedInr: number;
            paidCount: number;
            unpaidCount: number;
            unpaidInr: number;
         }>(await req.runTool("get_stats", {}));
         return (
            `${formatInr(s.collectedInr)} collect hua, ${s.paidCount} paid ` +
            `orders se. ${s.unpaidCount} pending hain: ` +
            `${formatInr(s.unpaidInr)} baaki.`
         );
      }
      return (
         "Poochiye: 'kis kis ka payment pending hai?', 'reminder bhej do' " +
         "ya 'kitna collect hua?'"
      );
   }

   // --------------------------------------------------------------------
   // remindAll
   // Purpose: send_reminder for every unpaid order; report who got one.
   // --------------------------------------------------------------------
   private async remindAll(
      req: ReplyRequest,
      orders: OrderBrief[],
   ): Promise<string> {
      const sent: string[] = [];
      for (const o of orders) {
         const r = readJson<OrderBrief>(
            await req.runTool("send_reminder", { orderId: o.orderId }),
         );
         if (!r.error) {
            const amount = formatMoney(o.total, o.currency);
            sent.push(`${o.customerName} (${amount})`);
         }
      }
      if (sent.length === 0) {
         return "Reminder abhi nahi ja paaye. Thodi der mein try kariye.";
      }
      return (
         `Reminder bhej diya: ${sent.join(", ")}. PayPal link ` +
         "unke chat mein hai."
      );
   }
}
