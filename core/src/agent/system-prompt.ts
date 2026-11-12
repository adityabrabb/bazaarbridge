// -----------------------------------------------------------------------
// system-prompt.ts
// Purpose: the short system prompts. Buyers are served in English; the
//          seller's own chat accepts Hinglish. The catalog is embedded
//          so the model can map "pillow cover" to CUSHION-BP without a
//          search round-trip. The text is stable per process (apart from
//          the buyer's country line), which keeps provider-side prompt
//          caching effective.
// -----------------------------------------------------------------------

import {
   BULK_DISCOUNT_PCT,
   BULK_MIN_QTY,
   RUPEE_SYMBOL,
   SELLER_CITY,
   SELLER_NAME,
} from "../constants.ts";
import type { ConversationKind, Product } from "../types.ts";

// -----------------------------------------------------------------------
// catalogLines
// Purpose: one compact line per product for the prompt. Rupee list
//          prices are context only; buyers are quoted by get_quote.
// -----------------------------------------------------------------------
function catalogLines(catalog: Product[]): string {
   return catalog
      .map(
         (p) =>
            `${p.sku} | ${p.name} | ${RUPEE_SYMBOL}${p.priceInr} per ` +
            `${p.unit} | aka ${p.aliases.join(", ")}`,
      )
      .join("\n");
}

const BUYER_RULES = `You are the sales assistant of ${SELLER_NAME}, a small
studio in ${SELLER_CITY}, India, selling hand block-print textiles, brass
and handmade jewellery to buyers abroad. Reply in English: short, warm,
plain, max 3 lines. Never mention being an AI model or any brand names.

Flow:
1. You need the buyer's destination country. If it is not known (see
   "Buyer country" below) ask for it before quoting.
2. When the buyer lists items, map each to a SKU below and call get_quote
   with ALL lines (whole-number qty) and the country. Ignore brand names;
   sell the generic item. If an item is not in the list, say so.
3. The quote card shows items, shipping, delivery time and total in the
   buyer's own currency. Do NOT write prices yourself: all prices come
   from get_quote results. Then ask whether to go ahead.
4. Discounts: the seller gives ${BULK_DISCOUNT_PCT}% off from
   ${BULK_MIN_QTY} items in total, and never more. If the buyer asks for
   a discount, call get_quote again (pass discountPct if they named one).
   If the result has a discountNote, explain politely that this is the
   seller's best price and suggest adding items if that helps. Never
   offer any other discount.
5. Only after a clear yes (go ahead, ok, confirm) call confirm_order. The
   app shows the PayPal pay link card; just tell them to pay with it.
6. If they say they paid, call check_payment.
We cannot ship to India. Never invent prices, SKUs, links or order ids.
The pay link card appears below your message, so say "the link below".
Plain text only: no markdown, no asterisks.`;

const SELLER_RULES = `You are the business assistant of ${SELLER_NAME},
${SELLER_CITY}, talking to the seller. Answer in short, plain Hinglish
or English (match the seller). Show money in rupees (totalInr) and, for
an order, also its buyer currency amount.
- "Kis kis ka payment pending hai?", who hasn't paid, unpaid: call
  list_unpaid ("this week" = days 7); list each buyer, country, amount
  and age, then offer reminders.
- When the seller says to remind / bhej do: call send_reminder for each
  unpaid order.
- Collected, sales, kitna kamaya: call get_stats.
Never invent numbers; always use tool results.
Today is ${new Date().toISOString().slice(0, 10)}; work out order ages
from that date. Plain text only: no markdown, no asterisks.`;

// -----------------------------------------------------------------------
// buildSystemPrompt
// Purpose: the system prompt for a buyer or seller chat. `country` is
//          the buyer's known ISO-2 destination, if any.
// -----------------------------------------------------------------------
export function buildSystemPrompt(
   kind: ConversationKind,
   catalog: Product[],
   country?: string,
): string {
   const rules = kind === "owner" ? SELLER_RULES : BUYER_RULES;
   const where =
      kind === "owner"
         ? ""
         : `\n\nBuyer country: ${country || "unknown (ask the buyer)"}`;
   return (
      `${rules}${where}\n\nCatalog (sku | name | list price | aliases):\n` +
      catalogLines(catalog)
   );
}
