// -----------------------------------------------------------------------
// hinglish-parser.ts
// Purpose: rule-based understanding of short chat messages, so the demo
//          runs with no LLM key. Buyers write English ("2 block-print
//          cushion covers and the brass diya set"); the seller may write
//          Hinglish ("kis kis ka payment pending hai?"). It extracts
//          item lines, a discount request and simple intents (confirm,
//          paid, cancel, invoice; seller: unpaid, remind, stats). It is
//          deliberately simple and predictable.
// -----------------------------------------------------------------------

import { findAliasHits, tokenize } from "../../catalog/catalog-search.ts";
import type { Product } from "../../types.ts";

export type ParsedLine = { sku: string; qty: number };

export type CustomerIntent =
   | "items"
   | "discount"
   | "confirm"
   | "paid"
   | "cancel"
   | "invoice"
   | "other";

export type OwnerIntent = "remind" | "unpaid" | "stats" | "other";

// ----- Word lists --------------------------------------------------------
// Number words count when a unit or a product name follows ("two
// scarves"), because "do" (Hindi: give) must not be read as 2.
const NUMBER_WORDS: Record<string, number> = {
   a: 1,
   an: 1,
   one: 1,
   two: 2,
   three: 3,
   four: 4,
   five: 5,
   six: 6,
   seven: 7,
   eight: 8,
   nine: 9,
   ten: 10,
   twelve: 12,
};
const UNITS = new Set([
   "piece",
   "pieces",
   "pcs",
   "pair",
   "pairs",
   "set",
   "sets",
   "dozen",
]);
const DOZEN = 12;
const LOOKBACK_TOKENS = 4;
const LOOKAHEAD_TOKENS = 2;

const CONFIRM_WORDS = [
   "yes",
   "yep",
   "yeah",
   "ok",
   "okay",
   "confirm",
   "confirmed",
   "ahead",
   "proceed",
   "great",
   "perfect",
   "sure",
   "done",
   "haan",
   "theek",
];
const CANCEL_WORDS = ["cancel", "nahi", "nahin", "no", "nope", "stop"];
const INVOICE_WORDS = ["invoice", "bill", "receipt"];
const PAID_PAIRS = ["done", "made", "sent", "complete", "completed", "diya"];
const DISCOUNT_WORDS = [
   "discount",
   "discounts",
   "cheaper",
   "reduce",
   "lower",
   "bargain",
   "offer",
   "deal",
];
const REMIND_WORDS = [
   "remind",
   "reminder",
   "reminders",
   "yaad",
   "nudge",
   "bhejo",
   "send",
];
const UNPAID_WORDS = [
   "unpaid",
   "udhaar",
   "udhar",
   "pending",
   "baaki",
   "baki",
   "due",
   "hasn",
   "hasnt",
   "outstanding",
];
const STATS_WORDS = [
   "revenue",
   "sales",
   "kamai",
   "kamaya",
   "earn",
   "earned",
   "stats",
   "hisaab",
   "hisab",
   "income",
   "kitna",
   "collected",
];
const WEEK_WORDS = ["week", "hafte", "hafta", "saptah"];

// -----------------------------------------------------------------------
// hasAny
// Purpose: true if any token is in the word list.
// -----------------------------------------------------------------------
function hasAny(tokens: string[], words: string[]): boolean {
   return tokens.some((t) => words.includes(t));
}

// -----------------------------------------------------------------------
// numberAt
// Purpose: the quantity a token stands for, or NaN. Digits always count;
//          number words only when a unit or a product name follows.
// -----------------------------------------------------------------------
function numberAt(
   tokens: string[],
   i: number,
   hitStarts: Set<number>,
): number {
   const token = tokens[i] ?? "";
   if (/^\d+$/.test(token)) {
      return Number(token);
   }
   const word = NUMBER_WORDS[token];
   if (word === undefined) {
      return Number.NaN;
   }
   const next = tokens[i + 1] ?? "";
   return UNITS.has(next) || hitStarts.has(i + 1) ? word : Number.NaN;
}

// -----------------------------------------------------------------------
// parseItems
// Purpose: item lines found in a message. For each alias hit, look back
//          (then briefly ahead) for its quantity; default 1.
// -----------------------------------------------------------------------
export function parseItems(text: string, catalog: Product[]): ParsedLine[] {
   const tokens = tokenize(text);
   const hits = findAliasHits(tokens, catalog);
   const starts = new Set(hits.map((h) => h.start));
   const lines = new Map<string, number>();
   let floor = 0;
   for (let h = 0; h < hits.length; h += 1) {
      const hit = hits[h];
      if (!hit) {
         continue;
      }
      const nextStart = hits[h + 1]?.start ?? tokens.length;
      let qty = Number.NaN;
      let unit = "";
      const from = Math.max(floor, hit.start - LOOKBACK_TOKENS);
      for (let i = hit.start - 1; i >= from; i -= 1) {
         qty = numberAt(tokens, i, starts);
         if (!Number.isNaN(qty)) {
            unit = tokens[i + 1] ?? "";
            break;
         }
      }
      const end = hit.start + hit.length;
      if (Number.isNaN(qty)) {
         const to = Math.min(nextStart, end + LOOKAHEAD_TOKENS);
         for (let i = end; i < to; i += 1) {
            const n = numberAt(tokens, i, starts);
            // Take a trailing number only if it is not the next item's.
            if (!Number.isNaN(n) && i + 1 >= to) {
               qty = n;
               break;
            }
         }
      }
      floor = end;
      const scaled = unit === "dozen" ? qty * DOZEN : qty;
      const finalQty = Number.isNaN(scaled) ? 1 : Math.max(1, scaled);
      lines.set(hit.product.sku, Math.round(finalQty));
   }
   return [...lines].map(([sku, qty]) => ({ sku, qty }));
}

// -----------------------------------------------------------------------
// discountAsked
// Purpose: whether the buyer is asking for a discount, and how much:
//          { asked: true, pct: 20 } for "20% off", pct 0 when no number
//          was given.
// -----------------------------------------------------------------------
export function discountAsked(text: string): { asked: boolean; pct: number } {
   const tokens = tokenize(text);
   const pct = /(\d+(?:\.\d+)?)\s*(?:%|percent|per cent)/i.exec(text);
   const asked = hasAny(tokens, DISCOUNT_WORDS) || pct !== null;
   return { asked, pct: pct ? Number(pct[1]) : 0 };
}

// -----------------------------------------------------------------------
// customerIntent
// Purpose: what a buyer message wants. Items beat everything else, then
//          a discount request, then the short answers.
// -----------------------------------------------------------------------
export function customerIntent(
   text: string,
   catalog: Product[],
): CustomerIntent {
   const tokens = tokenize(text);
   if (parseItems(text, catalog).length > 0) {
      return "items";
   }
   const saysPay = hasAny(tokens, ["pay", "payment", "paying"]);
   if (tokens.includes("paid") || (saysPay && hasAny(tokens, PAID_PAIRS))) {
      return "paid";
   }
   if (hasAny(tokens, INVOICE_WORDS)) {
      return "invoice";
   }
   if (discountAsked(text).asked) {
      return "discount";
   }
   if (hasAny(tokens, CANCEL_WORDS)) {
      return "cancel";
   }
   if (hasAny(tokens, CONFIRM_WORDS)) {
      return "confirm";
   }
   return "other";
}

// -----------------------------------------------------------------------
// ownerIntent
// Purpose: what a seller message wants. "Remind" wins over "unpaid" so
//          "remind all unpaid" sends reminders.
// -----------------------------------------------------------------------
export function ownerIntent(text: string): OwnerIntent {
   const tokens = tokenize(text);
   const lower = text.toLowerCase();
   if (hasAny(tokens, REMIND_WORDS) || lower.includes("bhej do")) {
      return "remind";
   }
   const notPaid =
      lower.includes("not paid") ||
      lower.includes("nahi diya") ||
      lower.includes("hasn't paid") ||
      lower.includes("haven't paid");
   if (notPaid || hasAny(tokens, UNPAID_WORDS)) {
      return "unpaid";
   }
   if (hasAny(tokens, STATS_WORDS) || lower.includes("total")) {
      return "stats";
   }
   return "other";
}

// -----------------------------------------------------------------------
// mentionsWeek
// Purpose: "this week" / "is hafte" -> limit to 7 days.
// -----------------------------------------------------------------------
export function mentionsWeek(text: string): boolean {
   return hasAny(tokenize(text), WEEK_WORDS);
}
