// -----------------------------------------------------------------------
// constants.ts
// Purpose: every named constant the engine uses, in one place, so no
//          magic numbers or strings hide inside the logic files. The
//          seller's commercial rules (rates, shipping, discount) live
//          here so they can be changed without touching code.
// -----------------------------------------------------------------------

import type { Channel, Currency } from "./types.ts";

// ----- Seller ------------------------------------------------------------
export const SELLER_NAME = "Rangrez Studio";
export const SELLER_CITY = "Jaipur";

// ----- HTTP server -------------------------------------------------------
export const DEFAULT_PORT = 8787;
export const DEFAULT_WEB_ORIGIN = "http://localhost:3000";
// Next.js may also be opened on 127.0.0.1, so allow that twin by default.
export const EXTRA_WEB_ORIGINS = ["http://127.0.0.1:3000"];
export const MAX_BODY_BYTES = 100_000;
export const SSE_KEEPALIVE_MS = 15_000;

// ----- Money and exchange -------------------------------------------------
// Fixed demo rates: rupees per 1 unit of the buyer currency. A real
// seller would refresh these; quotes say which date they are from.
export const RATES_AS_OF = "2026-11-11";
export const INR_PER_UNIT: Record<Currency, number> = {
   USD: 88,
   GBP: 116,
   EUR: 102,
   AUD: 58,
};
export const SUPPORTED_CURRENCIES: Currency[] = ["USD", "GBP", "EUR", "AUD"];
// Buyer prices are rounded UP to the next .00 or .50.
export const PRICE_STEP = 0.5;
export const CENTS_PER_UNIT = 100;
export const MAX_ITEM_QTY = 50;
// Shown in chat text and mock pages; PayPal gets ISO codes, not symbols.
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
   USD: "$",
   GBP: "£",
   EUR: "€",
   AUD: "A$",
};
export const RUPEE_SYMBOL = "₹";
export const MAX_QUOTE_LINES = 20;

// ----- Discount rule (set by the seller) ----------------------------------
export const BULK_DISCOUNT_PCT = 10;
export const BULK_MIN_QTY = 4;
export const PERCENT = 100;

// ----- Shipping zones -------------------------------------------------------
export type ZoneId = "UK" | "EU" | "NA" | "AU" | "ROW";

export type Zone = {
   id: ZoneId;
   label: string;
   currency: Currency;
   // Shipping is costed in rupees, then converted like prices.
   flatInr: number;
   perItemInr: number;
   deliveryDays: string;
};

export const ZONES: Record<ZoneId, Zone> = {
   UK: {
      id: "UK",
      label: "United Kingdom",
      currency: "GBP",
      flatInr: 1_800,
      perItemInr: 300,
      deliveryDays: "7-10",
   },
   EU: {
      id: "EU",
      label: "European Union",
      currency: "EUR",
      flatInr: 2_000,
      perItemInr: 350,
      deliveryDays: "8-12",
   },
   NA: {
      id: "NA",
      label: "US / Canada",
      currency: "USD",
      flatInr: 2_200,
      perItemInr: 350,
      deliveryDays: "8-12",
   },
   AU: {
      id: "AU",
      label: "Australia",
      currency: "AUD",
      flatInr: 2_400,
      perItemInr: 400,
      deliveryDays: "10-14",
   },
   ROW: {
      id: "ROW",
      label: "Rest of world",
      currency: "USD",
      flatInr: 2_800,
      perItemInr: 450,
      deliveryDays: "12-18",
   },
};

// ISO-2 codes per zone (anything else is ROW; India is refused).
export const EU_COUNTRIES = [
   "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
   "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
   "SI", "ES", "SE",
];
export const SELLER_COUNTRY = "IN";

// ----- Store -----------------------------------------------------------------
export const DATA_DIR_NAME = "data";
export const DB_FILE_NAME = "db.json";
export const OWNER_CONVERSATION_ID = "owner";
export const DEFAULT_CUSTOMER_NAME = "Buyer";
export const OWNER_DISPLAY_NAME = "Seller";
export const CHANNELS: Channel[] = ["dm", "email", "chat"];
export const DEFAULT_CHANNEL: Channel = "chat";
export const MAX_NAME_LENGTH = 60;
export const MAX_TEXT_LENGTH = 2_000;
export const ID_RANDOM_CHARS = 10;
export const MS_PER_DAY = 86_400_000;

// ----- LLM -------------------------------------------------------------------
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
// ----- Tried in order when the chosen model is overloaded or slow.
export const GEMINI_FALLBACK_MODELS: readonly string[] = [
   "gemini-3.5-flash-lite",
   "gemini-3.5-flash",
];
// ----- A model that failed is skipped for this long, so a rate-limited
//       or overloaded model does not delay every reply.
export const GEMINI_COOLDOWN_MS = 120_000;
// ----- Per-model wait; short so a fallback still answers in time.
export const GEMINI_ATTEMPT_TIMEOUT_MS = 10_000;
export const GEMINI_INTERACTIONS_URL =
   "https://generativelanguage.googleapis.com/v1beta/interactions";
// Opt in to the steps-based response schema documented for May 2026.
export const GEMINI_API_REVISION = "2026-05-20";
export const LLM_MAX_OUTPUT_TOKENS = 2_048;
export const LLM_MAX_TOOL_STEPS = 6;
export const LLM_HISTORY_MESSAGES = 20;
export const LLM_TIMEOUT_MS = 45_000;

// ----- PayPal ----------------------------------------------------------------
export const PAYPAL_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
export const PAYPAL_TIMEOUT_MS = 20_000;
// Refresh the OAuth token a minute before PayPal says it expires.
export const PAYPAL_TOKEN_MARGIN_S = 60;
export const PAYPAL_BRAND_NAME = SELLER_NAME;
export const PAYPAL_ITEM_NAME_MAX = 127;
export const MOCK_PAYPAL_PREFIX = "MOCK-";
export const MOCK_INVOICE_PREFIX = "MOCK-INV-";
export const MOCK_CAPTURE_PREFIX = "MOCK-CAP-";
// Fake payer shown on mock payments so the evidence pack is complete.
export const MOCK_PAYER_EMAIL = "mock.buyer@example.test";

// ----- Evidence timeline event names -----------------------------------------
export const EVENT_QUOTE_CREATED = "quote_created";
export const EVENT_QUOTE_UPDATED = "quote_updated";
export const EVENT_QUOTE_CANCELLED = "quote_cancelled";
export const EVENT_PAY_LINK = "pay_link_created";
export const EVENT_PAYMENT = "payment_captured";
export const EVENT_INVOICE = "invoice_issued";
export const EVENT_REMINDER = "reminder_sent";

// ----- Prefix of invoices issued by this app when PayPal Invoicing is
//       not available.
export const OWN_INVOICE_PREFIX = "BB-";
