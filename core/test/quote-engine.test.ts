// -----------------------------------------------------------------------
// quote-engine.test.ts
// Purpose: unit tests for the code-computed quote: rounding, currency
//          by country, shipping zones, the seller's bulk-discount rule,
//          the rupee value, and bad input (errors, never crashes).
// -----------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
   BULK_DISCOUNT_PCT,
   BULK_MIN_QTY,
   INR_PER_UNIT,
} from "../src/constants.ts";
import {
   countryFromText,
   normalizeCountry,
   zoneFor,
} from "../src/quote/countries.ts";
import {
   buildQuote,
   convertUp,
   QuoteError,
   toInr,
} from "../src/quote/quote-engine.ts";
import { SEED_CATALOG } from "../src/store/seed-data.ts";

const COVER = "CUSHION-BP";
const DIYA = "DIYA-BRASS";

describe("convertUp", () => {
   it("rounds up to the next .00 or .50", () => {
      // 750 / 116 = 6.465 -> 6.50
      assert.equal(convertUp(750, "GBP"), 6.5);
      // 1200 / 116 = 10.34 -> 10.50
      assert.equal(convertUp(1_200, "GBP"), 10.5);
      // 1100 / 88 = 12.5 exactly: must stay 12.50, not jump to 13.
      assert.equal(convertUp(1_100, "USD"), 12.5);
      assert.equal(convertUp(88, "USD"), 1);
   });

   it("never rounds below the exact conversion", () => {
      for (const currency of ["USD", "GBP", "EUR", "AUD"] as const) {
         for (const inr of [1, 99, 450, 3_800, 12_345]) {
            const out = convertUp(inr, currency);
            assert.ok(out * INR_PER_UNIT[currency] >= inr - 1e-6);
            assert.ok(out - inr / INR_PER_UNIT[currency] < 0.5 + 1e-6);
            assert.equal(Math.round(out * 2), out * 2, "multiple of .50");
         }
      }
   });

   it("converts back to whole rupees", () => {
      assert.equal(toInr(6.5, "GBP"), 754);
   });
});

describe("buildQuote", () => {
   it("quotes the storyline's first message in GBP", () => {
      const q = buildQuote(
         [
            { sku: COVER, qty: 2 },
            { sku: DIYA, qty: 1 },
         ],
         SEED_CATALOG,
         "GB",
      );
      assert.equal(q.currency, "GBP");
      assert.equal(q.destination, "United Kingdom");
      assert.deepEqual(
         q.items.map((i) => [i.sku, i.qty, i.unitPrice]),
         [
            [COVER, 2, 6.5],
            [DIYA, 1, 10.5],
         ],
      );
      assert.equal(q.subtotal, 23.5);
      assert.equal(q.discount, 0);
      // (1800 + 3 x 300) / 116 = 23.28 -> 23.50
      assert.equal(q.shipping, 23.5);
      assert.equal(q.total, 47);
      assert.equal(q.totalInr, 5_452);
      assert.equal(q.deliveryDays, "7-10");
   });

   it("applies the bulk discount from the minimum quantity", () => {
      const q = buildQuote(
         [
            { sku: COVER, qty: 4 },
            { sku: DIYA, qty: 1 },
         ],
         SEED_CATALOG,
         "GB",
      );
      assert.equal(q.discountPct, BULK_DISCOUNT_PCT);
      assert.equal(q.subtotal, 36.5);
      assert.equal(q.discount, 3.65);
      assert.equal(q.shipping, 28.5);
      assert.equal(q.total, 61.35);
      const below = buildQuote(
         [{ sku: COVER, qty: BULK_MIN_QTY - 1 }],
         SEED_CATALOG,
         "GB",
      );
      assert.equal(below.discount, 0);
      const exact = buildQuote(
         [{ sku: COVER, qty: BULK_MIN_QTY }],
         SEED_CATALOG,
         "GB",
      );
      assert.ok(exact.discount > 0);
   });

   it("refuses a bigger discount than the seller's floor", () => {
      const q = buildQuote([{ sku: COVER, qty: 5 }], SEED_CATALOG, "GB", 25);
      assert.equal(q.discountPct, BULK_DISCOUNT_PCT, "capped, not 25");
      assert.match(q.discountNote ?? "", /best price/);
      const same = buildQuote([{ sku: COVER, qty: 5 }], SEED_CATALOG, "GB", 10);
      assert.equal(same.discountNote, undefined);
   });

   it("explains that a discount needs the minimum quantity", () => {
      const q = buildQuote([{ sku: COVER, qty: 2 }], SEED_CATALOG, "GB", 10);
      assert.equal(q.discount, 0);
      assert.match(q.discountNote ?? "", /4\+ items/);
   });

   it("picks currency and zone from the country", () => {
      const pick = (c: string) =>
         buildQuote([{ sku: COVER, qty: 1 }], SEED_CATALOG, c);
      assert.equal(pick("US").currency, "USD");
      assert.equal(pick("CA").currency, "USD");
      assert.equal(pick("DE").currency, "EUR");
      assert.equal(pick("AU").currency, "AUD");
      // UAE and others: USD, with the country name kept as destination.
      assert.equal(pick("AE").currency, "USD");
      assert.equal(pick("AE").destination, "AE");
      assert.equal(pick("DE").deliveryDays, "8-12");
   });

   it("merges duplicate SKUs (last wins) and drops qty 0", () => {
      const q = buildQuote(
         [
            { sku: COVER, qty: 1 },
            { sku: DIYA, qty: 2 },
            { sku: COVER.toLowerCase(), qty: 3 },
            { sku: DIYA, qty: 0 },
         ],
         SEED_CATALOG,
         "US",
      );
      assert.deepEqual(
         q.items.map((i) => [i.sku, i.qty]),
         [[COVER, 3]],
      );
   });

   it("returns errors for bad input", () => {
      const cat = SEED_CATALOG;
      assert.throws(
         () => buildQuote([{ sku: COVER, qty: 1 }], cat, ""),
         QuoteError,
      );
      assert.throws(
         () => buildQuote([{ sku: COVER, qty: 1 }], cat, "IN"),
         /outside India/,
      );
      assert.throws(
         () => buildQuote([{ sku: "NOPE", qty: 1 }], cat, "GB"),
         /unknown sku/,
      );
      assert.throws(
         () => buildQuote([{ sku: COVER, qty: 999 }], cat, "GB"),
         /qty/,
      );
      assert.throws(
         () => buildQuote([{ sku: COVER, qty: Number.NaN }], cat, "GB"),
         QuoteError,
      );
      assert.throws(() => buildQuote([], cat, "GB"), /no items/);
      assert.throws(
         () => buildQuote("junk" as never, cat, "GB"),
         QuoteError,
      );
   });
});

describe("countries", () => {
   it("finds countries in free text", () => {
      assert.equal(countryFromText("Do you ship to the UK?"), "GB");
      assert.equal(countryFromText("send it to Berlin"), "DE");
      assert.equal(countryFromText("I live in New York"), "US");
      assert.equal(countryFromText("tell us what you want"), "");
      assert.equal(countryFromText("2 covers please"), "");
   });

   it("normalizes codes and names", () => {
      assert.equal(normalizeCountry("uk"), "GB");
      assert.equal(normalizeCountry("de"), "DE");
      assert.equal(normalizeCountry("Germany"), "DE");
      assert.equal(normalizeCountry(""), "");
      assert.equal(normalizeCountry(undefined), "");
   });

   it("maps zones; India has none", () => {
      assert.equal(zoneFor("GB")?.id, "UK");
      assert.equal(zoneFor("FR")?.id, "EU");
      assert.equal(zoneFor("BR")?.id, "ROW");
      assert.equal(zoneFor("IN"), undefined);
      assert.equal(zoneFor(""), undefined);
   });
});
