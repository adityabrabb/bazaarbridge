// -----------------------------------------------------------------------
// quote-engine.ts
// Purpose: compute a buyer quote in code (the model never sets a
//          price): rupee catalog prices -> buyer currency via the fixed
//          rate table, rounded up to .00/.50; shipping by zone; the
//          seller's bulk discount; and the rupee value of the total.
// -----------------------------------------------------------------------

import {
   BULK_DISCOUNT_PCT,
   BULK_MIN_QTY,
   INR_PER_UNIT,
   MAX_ITEM_QTY,
   MAX_QUOTE_LINES,
   PERCENT,
   PRICE_STEP,
   RATES_AS_OF,
} from "../constants.ts";
import { fromCents, itemsSubtotal, toCents } from "../orders/money.ts";
import type { Currency, OrderItem, Product } from "../types.ts";
import { zoneFor } from "./countries.ts";

export type QuoteLine = { sku: string; qty: number };

export type Quote = {
   buyerCountry: string;
   destination: string;
   currency: Currency;
   items: OrderItem[];
   subtotal: number;
   discount: number;
   discountPct: number;
   shipping: number;
   total: number;
   totalInr: number;
   deliveryDays: string;
   ratesAsOf: string;
   // Set when the buyer asked for more than the seller allows.
   discountNote?: string;
};

// -----------------------------------------------------------------------
// QuoteError
// Purpose: bad quote input (unknown SKU, India, no country...). The
//          message is safe to show the model and the buyer.
// -----------------------------------------------------------------------
export class QuoteError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "QuoteError";
   }
}

// -----------------------------------------------------------------------
// convertUp
// Purpose: rupees -> buyer currency, rounded UP to the next .00/.50.
//          Works in cents so 12.5 never becomes 12.499999.
// -----------------------------------------------------------------------
export function convertUp(inr: number, currency: Currency): number {
   const stepCents = toCents(PRICE_STEP);
   const exactCents = (inr / INR_PER_UNIT[currency]) * toCents(1);
   // Tiny epsilon: an exact multiple must not round up a whole step.
   const EPSILON = 1e-6;
   const steps = Math.ceil(exactCents / stepCents - EPSILON);
   return fromCents(steps * stepCents);
}

// -----------------------------------------------------------------------
// toInr
// Purpose: buyer-currency amount -> whole rupees at the table rate.
// -----------------------------------------------------------------------
export function toInr(amount: number, currency: Currency): number {
   return Math.round(amount * INR_PER_UNIT[currency]);
}

// -----------------------------------------------------------------------
// mergeLines
// Purpose: validate lines against the catalog; merge duplicate SKUs
//          (last qty wins); drop qty 0. Quantities are whole numbers.
// -----------------------------------------------------------------------
function mergeLines(
   lines: QuoteLine[],
   catalog: Product[],
): Array<{ product: Product; qty: number }> {
   if (!Array.isArray(lines)) {
      throw new QuoteError("items must be a list of { sku, qty }");
   }
   const bySku = new Map<string, { product: Product; qty: number }>();
   for (const line of lines.slice(0, MAX_QUOTE_LINES)) {
      const sku = String(line?.sku ?? "").toUpperCase();
      const product = catalog.find((p) => p.sku === sku);
      if (!product) {
         throw new QuoteError(`unknown sku "${String(line?.sku)}"`);
      }
      const qty = Math.round(Number(line.qty));
      if (!Number.isFinite(qty) || qty < 0 || qty > MAX_ITEM_QTY) {
         throw new QuoteError(`qty for ${sku} must be 0-${MAX_ITEM_QTY}`);
      }
      if (qty === 0) {
         bySku.delete(sku);
      } else {
         bySku.set(sku, { product, qty });
      }
   }
   return [...bySku.values()];
}

// -----------------------------------------------------------------------
// buildQuote
// Purpose: the full quote for `lines` shipped to `country` (ISO-2).
//          requestedDiscountPct is what the buyer asked for; the seller's
//          rule caps it (BULK_DISCOUNT_PCT from BULK_MIN_QTY items).
// -----------------------------------------------------------------------
export function buildQuote(
   lines: QuoteLine[],
   catalog: Product[],
   country: string,
   requestedDiscountPct = 0,
): Quote {
   if (!country) {
      throw new QuoteError(
         "destination country unknown: ask the buyer where to ship",
      );
   }
   const zone = zoneFor(country);
   if (!zone) {
      throw new QuoteError(
         "this desk serves buyers outside India only",
      );
   }
   const merged = mergeLines(lines, catalog);
   if (merged.length === 0) {
      throw new QuoteError("no items to quote");
   }
   const currency = zone.currency;
   const items: OrderItem[] = merged.map(({ product, qty }) => ({
      sku: product.sku,
      name: product.name,
      qty,
      unitPrice: convertUp(product.priceInr, currency),
   }));
   const totalQty = merged.reduce((n, l) => n + l.qty, 0);
   const subtotal = itemsSubtotal(items);
   const allowedPct = totalQty >= BULK_MIN_QTY ? BULK_DISCOUNT_PCT : 0;
   const discountCents = Math.round((toCents(subtotal) * allowedPct) / PERCENT);
   const shippingInr = zone.flatInr + zone.perItemInr * totalQty;
   const shipping = convertUp(shippingInr, currency);
   const totalCents = toCents(subtotal) - discountCents + toCents(shipping);
   const total = fromCents(totalCents);
   const quote: Quote = {
      buyerCountry: country,
      destination: zone.label === "Rest of world" ? country : zone.label,
      currency,
      items,
      subtotal,
      discount: fromCents(discountCents),
      discountPct: allowedPct,
      shipping,
      total,
      totalInr: toInr(total, currency),
      deliveryDays: zone.deliveryDays,
      ratesAsOf: RATES_AS_OF,
   };
   const asked = Number(requestedDiscountPct) || 0;
   if (asked > allowedPct) {
      quote.discountNote =
         allowedPct > 0
            ? `The seller's best price is ${allowedPct}% off for ` +
              `${BULK_MIN_QTY}+ items; ${asked}% is not possible.`
            : `Discount needs ${BULK_MIN_QTY}+ items ` +
              `(${BULK_DISCOUNT_PCT}% off); none applies yet.`;
   }
   return quote;
}
