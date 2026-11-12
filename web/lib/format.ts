/**
 * Small formatting helpers shared by chat cards, grid and the
 * evidence pack.
 */
import {
   COUNTRY_NAME, CURRENCY_SYMBOL, HOURS_PER_DAY, MINUTES_PER_HOUR,
   MS_PER_MINUTE, RUPEE_SYMBOL,
} from "./constants";
import type { Currency } from "./types";

/** Formats an amount in the buyer's currency, e.g. "£59.70". */
export function money(amount: number, currency: Currency): string {
   return `${CURRENCY_SYMBOL[currency] ?? ""}${amount.toFixed(2)}`;
}

/** Formats rupees with Indian digit grouping, e.g. "₹6,284". */
export function inr(amount: number): string {
   return `${RUPEE_SYMBOL}${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Country name from an ISO-2 code; falls back to the code. */
export function countryName(code?: string): string {
   if (!code) return "Unknown";
   return COUNTRY_NAME[code.toUpperCase()] ?? code.toUpperCase();
}

/** Turns an ISO timestamp into "5m", "3h" or "2d" (for the grid). */
export function ageOf(iso: string, now: number = Date.now()): string {
   const minutes = Math.max(
      0, Math.floor((now - new Date(iso).getTime()) / MS_PER_MINUTE));
   if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
   const hours = Math.floor(minutes / MINUTES_PER_HOUR);
   if (hours < HOURS_PER_DAY) return `${hours}h`;
   return `${Math.floor(hours / HOURS_PER_DAY)}d`;
}

/** Clock time for a chat bubble, e.g. "10:42 PM". */
export function clock(iso: string): string {
   return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "numeric", minute: "2-digit",
   });
}

/** Date and time for the evidence pack, e.g. "12 Nov, 10:42 PM". */
export function stamp(iso: string): string {
   return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "numeric",
      minute: "2-digit",
   });
}

/** Short order number like "No. 0007" from an order id. */
export function billNo(orderId: string): string {
   const digits = orderId.replace(/\D/g, "");
   return `No. ${(digits || orderId).slice(-4).padStart(4, "0")}`;
}
