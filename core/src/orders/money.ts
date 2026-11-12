// -----------------------------------------------------------------------
// money.ts
// Purpose: cent-safe money helpers. Amounts are summed in integer cents
//          so float errors never reach PayPal, which rejects amounts
//          whose breakdown does not add up exactly. All four buyer
//          currencies (USD, GBP, EUR, AUD) use two decimal places.
// -----------------------------------------------------------------------

import {
   CENTS_PER_UNIT,
   CURRENCY_SYMBOLS,
   RUPEE_SYMBOL,
} from "../constants.ts";
import type { Currency, OrderItem } from "../types.ts";

// -----------------------------------------------------------------------
// toCents
// Purpose: amount (number) -> integer cents, rounded half away from 0.
// -----------------------------------------------------------------------
export function toCents(amount: number): number {
   return Math.round(amount * CENTS_PER_UNIT);
}

// -----------------------------------------------------------------------
// fromCents
// Purpose: integer cents -> amount with at most 2 decimals.
// -----------------------------------------------------------------------
export function fromCents(cents: number): number {
   return cents / CENTS_PER_UNIT;
}

// -----------------------------------------------------------------------
// formatAmount
// Purpose: PayPal wants money as a string with exactly two decimals.
// -----------------------------------------------------------------------
export function formatAmount(amount: number): string {
   return fromCents(toCents(amount)).toFixed(2);
}

// -----------------------------------------------------------------------
// sumAmounts
// Purpose: add amounts without float drift.
// -----------------------------------------------------------------------
export function sumAmounts(values: number[]): number {
   let cents = 0;
   for (const value of values) {
      cents += toCents(value);
   }
   return fromCents(cents);
}

// -----------------------------------------------------------------------
// itemsSubtotal
// Purpose: sum of unit price x qty over all lines (what PayPal checks
//          as item_total).
// -----------------------------------------------------------------------
export function itemsSubtotal(items: OrderItem[]): number {
   let cents = 0;
   for (const item of items) {
      cents += toCents(item.unitPrice) * item.qty;
   }
   return fromCents(cents);
}

// -----------------------------------------------------------------------
// formatMoney
// Purpose: "£6.50" style text for chat and pages. Symbols are for
//          people only; PayPal always gets the ISO code.
// -----------------------------------------------------------------------
export function formatMoney(amount: number, currency: Currency): string {
   return `${CURRENCY_SYMBOLS[currency]}${formatAmount(amount)}`;
}

// -----------------------------------------------------------------------
// formatInr
// Purpose: rupees with Indian digit grouping, for the seller's view.
// -----------------------------------------------------------------------
export function formatInr(amount: number): string {
   return `${RUPEE_SYMBOL}${Math.round(amount).toLocaleString("en-IN")}`;
}
