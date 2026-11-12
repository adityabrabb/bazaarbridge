// -----------------------------------------------------------------------
// countries.ts
// Purpose: turn what a buyer types ("UK", "Germany", "London", "GB")
//          into an ISO-2 country code, and a code into a shipping zone.
// -----------------------------------------------------------------------

import {
   EU_COUNTRIES,
   SELLER_COUNTRY,
   ZONES,
   type Zone,
} from "../constants.ts";
import { tokenize } from "../catalog/catalog-search.ts";

// Names and common city names a buyer might type, mapped to ISO-2.
// Multi-word keys are matched before single words.
const COUNTRY_WORDS: Record<string, string> = {
   "united kingdom": "GB",
   "great britain": "GB",
   uk: "GB",
   gb: "GB",
   britain: "GB",
   england: "GB",
   scotland: "GB",
   wales: "GB",
   london: "GB",
   manchester: "GB",
   "united states": "US",
   usa: "US",
   us: "US",
   america: "US",
   "new york": "US",
   california: "US",
   texas: "US",
   canada: "CA",
   toronto: "CA",
   australia: "AU",
   sydney: "AU",
   melbourne: "AU",
   germany: "DE",
   deutschland: "DE",
   berlin: "DE",
   munich: "DE",
   france: "FR",
   paris: "FR",
   netherlands: "NL",
   holland: "NL",
   amsterdam: "NL",
   italy: "IT",
   spain: "ES",
   ireland: "IE",
   dublin: "IE",
   belgium: "BE",
   austria: "AT",
   sweden: "SE",
   denmark: "DK",
   portugal: "PT",
   "new zealand": "NZ",
   singapore: "SG",
   japan: "JP",
   uae: "AE",
   dubai: "AE",
   "united arab emirates": "AE",
   india: "IN",
};

const ISO2 = /^[a-z]{2}$/i;

// -----------------------------------------------------------------------
// countryFromText
// Purpose: the first country mentioned in free text, or "". "us" is
//          also an English word, so it counts only when written "US".
// -----------------------------------------------------------------------
export function countryFromText(text: string): string {
   const tokens = tokenize(text);
   const joined = ` ${tokens.join(" ")} `;
   const keys = Object.keys(COUNTRY_WORDS).sort(
      (a, b) => b.split(" ").length - a.split(" ").length,
   );
   for (const key of keys) {
      if (key === "us" && !/\bUS\b/.test(text)) {
         continue;
      }
      if (joined.includes(` ${key} `)) {
         return COUNTRY_WORDS[key] ?? "";
      }
   }
   return "";
}

// -----------------------------------------------------------------------
// normalizeCountry
// Purpose: accept an ISO-2 code or a country name; return ISO-2 or "".
// -----------------------------------------------------------------------
export function normalizeCountry(value: string | undefined): string {
   const raw = (value ?? "").trim();
   if (!raw) {
      return "";
   }
   if (ISO2.test(raw)) {
      const upper = raw.toUpperCase();
      return upper === "UK" ? "GB" : upper;
   }
   return COUNTRY_WORDS[raw.toLowerCase()] ?? countryFromText(raw);
}

// -----------------------------------------------------------------------
// zoneFor
// Purpose: shipping zone of an ISO-2 code. India returns undefined:
//          this desk is for buyers abroad (PayPal India has no
//          domestic payments).
// -----------------------------------------------------------------------
export function zoneFor(country: string): Zone | undefined {
   if (!country || country === SELLER_COUNTRY) {
      return undefined;
   }
   if (country === "GB") {
      return ZONES.UK;
   }
   if (EU_COUNTRIES.includes(country)) {
      return ZONES.EU;
   }
   if (country === "US" || country === "CA") {
      return ZONES.NA;
   }
   if (country === "AU") {
      return ZONES.AU;
   }
   return ZONES.ROW;
}
